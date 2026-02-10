/** Firebase Crashlytics integration — queries crash data via REST API with gcloud auth. */

import * as vscode from 'vscode';
import { execFile } from 'child_process';
import { getLogDirectoryUri } from './config';
import { parseEventResponse } from './crashlytics-event-parser';

export interface CrashlyticsIssue {
    readonly id: string;
    readonly title: string;
    readonly subtitle: string;
    readonly eventCount: number;
    readonly userCount: number;
    readonly isFatal: boolean;
    readonly state: 'OPEN' | 'CLOSED' | 'REGRESSION' | 'UNKNOWN';
    readonly firstVersion?: string;
    readonly lastVersion?: string;
}

export interface FirebaseContext {
    readonly available: boolean;
    readonly setupHint?: string;
    /** Which setup step failed — drives the wizard UI in the panel. */
    readonly setupStep?: 'gcloud' | 'token' | 'config';
    readonly issues: readonly CrashlyticsIssue[];
    readonly consoleUrl?: string;
    readonly queriedAt?: number;
}

export interface CrashlyticsStackFrame {
    readonly text: string;
    readonly fileName?: string;
    readonly lineNumber?: number;
}

interface CrashlyticsThread { readonly name: string; readonly frames: readonly CrashlyticsStackFrame[]; }

export interface CrashlyticsEventDetail {
    readonly issueId: string;
    readonly crashThread?: CrashlyticsThread;
    readonly appThreads: readonly CrashlyticsThread[];
    readonly deviceModel?: string;
    readonly osVersion?: string;
    readonly eventTime?: string;
    readonly customKeys?: readonly { readonly key: string; readonly value: string }[];
    readonly logs?: readonly { readonly timestamp?: string; readonly message: string }[];
}

export interface CrashlyticsIssueEvents {
    readonly issueId: string;
    readonly events: readonly CrashlyticsEventDetail[];
    readonly currentIndex: number;
}

interface FirebaseConfig { readonly projectId: string; readonly appId: string; }

let gcloudAvailable: boolean | undefined;
let cachedToken: { token: string; expires: number } | undefined;
let cachedIssueRows: { rows: Record<string, unknown>[]; expires: number } | undefined;
const tokenTtl = 30 * 60_000;
const issueListTtl = 5 * 60_000;
const apiTimeout = 10_000;
const apiBase = 'https://firebasecrashlytics.googleapis.com/v1beta1';

async function isGcloudAvailable(): Promise<boolean> {
    if (gcloudAvailable !== undefined) { return gcloudAvailable; }
    try {
        await runCmd('gcloud', ['--version']);
        gcloudAvailable = true;
    } catch { gcloudAvailable = false; }
    return gcloudAvailable;
}

/** Get a gcloud access token (cached 30 min). */
export async function getAccessToken(): Promise<string | undefined> {
    if (cachedToken && Date.now() < cachedToken.expires) { return cachedToken.token; }
    try {
        const token = await runCmd('gcloud', ['auth', 'application-default', 'print-access-token']);
        if (!token) { return undefined; }
        cachedToken = { token, expires: Date.now() + tokenTtl };
        return token;
    } catch { return undefined; }
}

/** Detect Firebase config from workspace google-services.json or extension settings. */
export async function detectFirebaseConfig(): Promise<FirebaseConfig | undefined> {
    const cfg = vscode.workspace.getConfiguration('saropaLogCapture.firebase');
    const projectId = cfg.get<string>('projectId', '');
    const appId = cfg.get<string>('appId', '');
    if (projectId && appId) { return { projectId, appId }; }
    return scanGoogleServicesJson(projectId, appId);
}

async function scanGoogleServicesJson(fallbackProject: string, fallbackApp: string): Promise<FirebaseConfig | undefined> {
    const files = await vscode.workspace.findFiles('**/google-services.json', '**/node_modules/**', 3);
    if (files.length === 0) { return undefined; }
    try {
        const raw = await vscode.workspace.fs.readFile(files[0]);
        const json = JSON.parse(Buffer.from(raw).toString('utf-8'));
        const projectId = fallbackProject || json.project_info?.project_id;
        const client = json.client?.[0];
        const appId = fallbackApp || client?.client_info?.mobilesdk_app_id;
        return projectId && appId ? { projectId, appId } : undefined;
    } catch { return undefined; }
}

/** Clear all cached state so the next query re-checks gcloud, token, and issues. */
export function clearIssueListCache(): void {
    gcloudAvailable = undefined;
    cachedToken = undefined;
    cachedIssueRows = undefined;
}

/** Install page for the Google Cloud CLI (gcloud), required for Crashlytics API access. */
export const gcloudInstallUrl = 'https://docs.cloud.google.com/sdk/docs/install-sdk';

/** Query Firebase Crashlytics for issues matching error tokens. */
export async function getFirebaseContext(errorTokens: readonly string[]): Promise<FirebaseContext> {
    if (!await isGcloudAvailable()) {
        return { available: false, setupStep: 'gcloud', setupHint: `Install Google Cloud CLI from ${gcloudInstallUrl}`, issues: [] };
    }
    const token = await getAccessToken();
    if (!token) {
        return { available: false, setupStep: 'token', setupHint: 'Run: gcloud auth application-default login', issues: [] };
    }
    const config = await detectFirebaseConfig();
    if (!config) {
        return { available: false, setupStep: 'config', setupHint: 'Add google-services.json to workspace or set firebase.projectId/appId', issues: [] };
    }
    const consoleUrl = `https://console.firebase.google.com/project/${config.projectId}/crashlytics/app/${config.appId}/issues`;
    const issues = await queryTopIssues(config, token, errorTokens).catch(() => []);
    return { available: true, issues, consoleUrl, queriedAt: Date.now() };
}

function getTimeRange(): string {
    const cfg = vscode.workspace.getConfiguration('saropaLogCapture.firebase');
    return cfg.get<string>('timeRange', 'LAST_7_DAYS');
}

// Re-export for consumers that imported from here previously.
export { detectAppVersion } from './app-version';
import { detectAppVersion } from './app-version';

async function queryTopIssues(config: FirebaseConfig, token: string, errorTokens: readonly string[]): Promise<CrashlyticsIssue[]> {
    if (cachedIssueRows && Date.now() < cachedIssueRows.expires) {
        return matchIssues(cachedIssueRows.rows, errorTokens);
    }
    const url = `${apiBase}/projects/${config.projectId}/apps/${config.appId}/reports/topIssues:query`;
    const filters: Record<string, unknown> = { issueErrorTypes: ['FATAL', 'NON_FATAL'] };
    const ver = await detectAppVersion();
    if (ver) { filters.versions = [ver]; }
    const body = JSON.stringify({
        issueFilters: filters,
        pageSize: 20,
        eventTimePeriod: getTimeRange(),
    });
    const data = await fetchJson(url, token, body);
    if (!data?.rows || !Array.isArray(data.rows)) { return []; }
    cachedIssueRows = { rows: data.rows as Record<string, unknown>[], expires: Date.now() + issueListTtl };
    return matchIssues(cachedIssueRows.rows, errorTokens);
}

function parseIssueState(raw: unknown): CrashlyticsIssue['state'] {
    const s = String(raw ?? '').toUpperCase();
    if (s === 'CLOSED') { return 'CLOSED'; }
    if (s === 'REGRESSION' || s === 'REGRESSED') { return 'REGRESSION'; }
    if (s === 'OPEN') { return 'OPEN'; }
    return 'UNKNOWN';
}

function matchIssues(rows: Record<string, unknown>[], errorTokens: readonly string[]): CrashlyticsIssue[] {
    const lowerTokens = errorTokens.map(t => t.toLowerCase()).filter(t => t.length > 0);
    const results: CrashlyticsIssue[] = [];
    for (const row of rows) {
        const issue = row.issue as Record<string, unknown> | undefined;
        if (!issue) { continue; }
        const title = String(issue.title ?? '');
        const subtitle = String(issue.subtitle ?? '');
        // When no tokens provided, include all issues (sidebar panel use case)
        if (lowerTokens.length > 0) {
            const combined = (title + ' ' + subtitle).toLowerCase();
            if (!lowerTokens.some(t => combined.includes(t))) { continue; }
        }
        const errorType = String(issue.type ?? issue.issueType ?? '').toUpperCase();
        results.push({
            id: String(issue.id ?? ''),
            title, subtitle,
            eventCount: Number(row.eventCount ?? 0),
            userCount: Number(row.impactedUsers ?? 0),
            isFatal: errorType === 'FATAL' || errorType === 'CRASH',
            state: parseIssueState(issue.state ?? issue.issueState),
            firstVersion: issue.firstSeenVersion ? String(issue.firstSeenVersion) : undefined,
            lastVersion: issue.lastSeenVersion ? String(issue.lastSeenVersion) : undefined,
        });
    }
    return results.slice(0, 5);
}

/** Update a Crashlytics issue state (close or mute). Returns true on success. */
export async function updateIssueState(issueId: string, state: 'CLOSED' | 'MUTED'): Promise<boolean> {
    const token = await getAccessToken();
    if (!token) { return false; }
    const config = await detectFirebaseConfig();
    if (!config) { return false; }
    const url = `${apiBase}/projects/${config.projectId}/apps/${config.appId}/issues/${issueId}?updateMask=state`;
    const result = await fetchJson(url, token, JSON.stringify({ state }), 'PATCH');
    return result !== undefined;
}

function fetchJson(url: string, token: string, body?: string, method?: string): Promise<Record<string, unknown> | undefined> {
    return new Promise((resolve) => {
        const https = require('https') as typeof import('https');
        const parsed = new URL(url);
        const req = https.request({
            hostname: parsed.hostname, path: parsed.pathname + parsed.search,
            method: method ?? (body ? 'POST' : 'GET'), timeout: apiTimeout,
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        }, (res) => {
            let data = '';
            res.on('data', (chunk: string) => { data += chunk; });
            res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve(undefined); } });
        });
        req.on('error', () => resolve(undefined));
        req.on('timeout', () => { req.destroy(); resolve(undefined); });
        if (body) { req.write(body); }
        req.end();
    });
}

function getCacheUri(issueId: string): vscode.Uri | undefined {
    const ws = vscode.workspace.workspaceFolders?.[0];
    if (!ws) { return undefined; }
    return vscode.Uri.joinPath(getLogDirectoryUri(ws), '.crashlytics', `${issueId}.json`);
}

async function readCachedEvents(issueId: string): Promise<CrashlyticsIssueEvents | undefined> {
    const uri = getCacheUri(issueId);
    if (!uri) { return undefined; }
    try {
        const raw = await vscode.workspace.fs.readFile(uri);
        const parsed = JSON.parse(Buffer.from(raw).toString('utf-8'));
        if (parsed.events && Array.isArray(parsed.events)) { return parsed as CrashlyticsIssueEvents; }
        // Migrate v1 single-event cache to multi-event format
        const detail = parsed as CrashlyticsEventDetail;
        return { issueId, events: [detail], currentIndex: 0 };
    } catch { return undefined; }
}

async function writeCacheEvents(issueId: string, data: CrashlyticsIssueEvents): Promise<void> {
    const uri = getCacheUri(issueId);
    if (!uri) { return; }
    await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(uri, '..'));
    await vscode.workspace.fs.writeFile(uri, Buffer.from(JSON.stringify(data, null, 2)));
}

/** Fetch crash events for a specific issue, returning multi-event structure with pagination. */
export async function getCrashEventDetail(issueId: string): Promise<CrashlyticsEventDetail | undefined> {
    const multi = await getCrashEvents(issueId);
    return multi?.events[multi.currentIndex];
}

/** Fetch multiple crash events for an issue (cached). */
export async function getCrashEvents(issueId: string): Promise<CrashlyticsIssueEvents | undefined> {
    const cached = await readCachedEvents(issueId);
    if (cached) { return cached; }
    const token = await getAccessToken();
    if (!token) { return undefined; }
    const config = await detectFirebaseConfig();
    if (!config) { return undefined; }
    const url = `${apiBase}/projects/${config.projectId}/apps/${config.appId}/issues/${issueId}/events?pageSize=5`;
    const data = await fetchJson(url, token);
    if (!data) { return undefined; }
    const events = parseMultipleEvents(issueId, data);
    if (events.length === 0) { return undefined; }
    const result: CrashlyticsIssueEvents = { issueId, events, currentIndex: 0 };
    writeCacheEvents(issueId, result).catch(() => {});
    return result;
}

function parseMultipleEvents(issueId: string, data: Record<string, unknown>): CrashlyticsEventDetail[] {
    const raw = data.events ?? data.crashEvents;
    if (!Array.isArray(raw) || raw.length === 0) {
        const single = parseEventResponse(issueId, data);
        return single ? [single] : [];
    }
    return raw.map((_, i) => parseEventResponse(issueId, { events: [raw[i]] })).filter((e): e is CrashlyticsEventDetail => e !== undefined);
}

function runCmd(cmd: string, args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
        execFile(cmd, args, { timeout: apiTimeout }, (err, stdout) => {
            if (err) { reject(err); return; }
            resolve((stdout ?? '').trim());
        });
    });
}

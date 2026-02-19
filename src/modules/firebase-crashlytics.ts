/** Firebase Crashlytics integration — queries crash data via REST API with gcloud auth. */

import * as vscode from 'vscode';
import { detectAppVersion } from './app-version';
import { apiTimeout, runCmd, readCachedEvents, writeCacheEvents } from './crashlytics-io';
import { parseEventResponse } from './crashlytics-event-parser';
import { logCrashlytics, classifyGcloudError, classifyTokenError, classifyHttpStatus, type DiagnosticDetails } from './crashlytics-diagnostics';
import type { CrashlyticsIssue, CrashlyticsIssueEvents, CrashlyticsEventDetail, FirebaseContext } from './crashlytics-types';
export type { CrashlyticsIssue, CrashlyticsStackFrame, CrashlyticsEventDetail, CrashlyticsIssueEvents, FirebaseContext } from './crashlytics-types';

interface FirebaseConfig { readonly projectId: string; readonly appId: string; }

let gcloudAvailable: boolean | undefined;
let cachedToken: { token: string; expires: number } | undefined;
let cachedIssueRows: { rows: Record<string, unknown>[]; expires: number } | undefined;
let lastDiagnostic: DiagnosticDetails | undefined;
const tokenTtl = 30 * 60_000;
const issueListTtl = 5 * 60_000;
const apiBase = 'https://firebasecrashlytics.googleapis.com/v1beta1';

async function isGcloudAvailable(): Promise<boolean> {
    if (gcloudAvailable !== undefined) { return gcloudAvailable; }
    try {
        await runCmd('gcloud', ['--version']);
        gcloudAvailable = true;
        logCrashlytics('info', 'Google Cloud CLI found');
    } catch (err) {
        gcloudAvailable = false;
        lastDiagnostic = classifyGcloudError(err);
        logCrashlytics('error', `gcloud check: ${lastDiagnostic.message}`);
    }
    return gcloudAvailable;
}

/** Get a gcloud access token (cached 30 min). */
export async function getAccessToken(): Promise<string | undefined> {
    if (cachedToken && Date.now() < cachedToken.expires) { return cachedToken.token; }
    try {
        const token = await runCmd('gcloud', ['auth', 'application-default', 'print-access-token']);
        if (!token) {
            lastDiagnostic = { step: 'token', errorType: 'auth', message: 'gcloud returned empty token', checkedAt: Date.now() };
            logCrashlytics('error', 'gcloud returned empty access token');
            return undefined;
        }
        cachedToken = { token, expires: Date.now() + tokenTtl };
        logCrashlytics('info', 'Access token retrieved');
        return token;
    } catch (err) {
        lastDiagnostic = classifyTokenError(err);
        logCrashlytics('error', `Token fetch: ${lastDiagnostic.message}`);
        return undefined;
    }
}

/** Detect Firebase config from workspace google-services.json or extension settings. */
export async function detectFirebaseConfig(): Promise<FirebaseConfig | undefined> {
    const cfg = vscode.workspace.getConfiguration('saropaLogCapture.firebase');
    const projectId = cfg.get<string>('projectId', '');
    const appId = cfg.get<string>('appId', '');
    if (projectId && appId) {
        logCrashlytics('info', `Config from settings: project=${projectId}`);
        return { projectId, appId };
    }
    return scanGoogleServicesJson(projectId, appId);
}

async function scanGoogleServicesJson(fallbackProject: string, fallbackApp: string): Promise<FirebaseConfig | undefined> {
    const files = await vscode.workspace.findFiles('**/google-services.json', '**/node_modules/**', 3);
    if (files.length === 0) {
        logCrashlytics('info', 'No google-services.json found in workspace');
        lastDiagnostic = { step: 'config', errorType: 'config', message: 'No google-services.json found in workspace', checkedAt: Date.now() };
        return undefined;
    }
    try {
        const raw = await vscode.workspace.fs.readFile(files[0]);
        const json = JSON.parse(Buffer.from(raw).toString('utf-8'));
        const projectId = fallbackProject || json.project_info?.project_id;
        const client = json.client?.[0];
        const appId = fallbackApp || client?.client_info?.mobilesdk_app_id;
        if (projectId && appId) {
            logCrashlytics('info', `Config from google-services.json: project=${projectId}`);
            return { projectId, appId };
        }
        const missing = !projectId ? 'projectId' : 'appId';
        logCrashlytics('error', `google-services.json missing ${missing}`);
        lastDiagnostic = { step: 'config', errorType: 'config', message: `google-services.json found but missing ${missing}`, checkedAt: Date.now() };
        return undefined;
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logCrashlytics('error', `Failed to parse google-services.json: ${msg}`);
        lastDiagnostic = { step: 'config', errorType: 'config', message: `Failed to parse google-services.json`, technicalDetails: msg, checkedAt: Date.now() };
        return undefined;
    }
}

/** Clear all cached state so the next query re-checks gcloud, token, and issues. */
export function clearIssueListCache(): void {
    gcloudAvailable = undefined;
    cachedToken = undefined;
    cachedIssueRows = undefined;
    lastDiagnostic = undefined;
}

/** Install page for the Google Cloud CLI (gcloud), required for Crashlytics API access. */
export const gcloudInstallUrl = 'https://docs.cloud.google.com/sdk/docs/install-sdk';

/** Query Firebase Crashlytics for issues matching error tokens. */
export async function getFirebaseContext(errorTokens: readonly string[]): Promise<FirebaseContext> {
    lastDiagnostic = undefined;
    if (!await isGcloudAvailable()) {
        return { available: false, setupStep: 'gcloud', setupHint: `Install Google Cloud CLI from ${gcloudInstallUrl}`, issues: [], diagnostics: lastDiagnostic };
    }
    const token = await getAccessToken();
    if (!token) {
        return { available: false, setupStep: 'token', setupHint: 'Run: gcloud auth application-default login', issues: [], diagnostics: lastDiagnostic };
    }
    const config = await detectFirebaseConfig();
    if (!config) {
        return { available: false, setupStep: 'config', setupHint: 'Add google-services.json to workspace or set firebase.projectId/appId', issues: [], diagnostics: lastDiagnostic };
    }
    const consoleUrl = `https://console.firebase.google.com/project/${config.projectId}/crashlytics/app/${config.appId}/issues`;
    try {
        const issues = await queryTopIssues(config, token, errorTokens);
        logCrashlytics('info', `Fetched ${issues.length} Crashlytics issues`);
        // When API succeeds but returns no issues, attach any diagnostic from fetchJson (e.g. HTTP 403)
        const diag = issues.length === 0 ? lastDiagnostic : undefined;
        return { available: true, issues, consoleUrl, queriedAt: Date.now(), diagnostics: diag };
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logCrashlytics('error', `Issue query failed: ${msg}`);
        if (!lastDiagnostic) {
            lastDiagnostic = { step: 'api', errorType: 'network', message: msg, checkedAt: Date.now() };
        }
        return { available: true, issues: [], consoleUrl, queriedAt: Date.now(), diagnostics: lastDiagnostic };
    }
}

function getTimeRange(): string {
    const cfg = vscode.workspace.getConfiguration('saropaLogCapture.firebase');
    return cfg.get<string>('timeRange', 'LAST_7_DAYS');
}

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
            res.on('end', () => {
                const status = res.statusCode ?? 0;
                if (status >= 400) {
                    const msg = classifyHttpStatus(status, data);
                    logCrashlytics('error', `HTTP ${status} from ${parsed.pathname}: ${msg}`);
                    lastDiagnostic = { step: 'api', errorType: 'http', message: msg, httpStatus: status, checkedAt: Date.now(), technicalDetails: data.slice(0, 300) };
                    resolve(undefined);
                    return;
                }
                try { resolve(JSON.parse(data)); } catch {
                    logCrashlytics('error', `Invalid JSON from ${parsed.pathname}: ${data.slice(0, 200)}`);
                    resolve(undefined);
                }
            });
        });
        req.on('error', (err) => {
            logCrashlytics('error', `Network error for ${parsed.pathname}: ${err.message}`);
            lastDiagnostic = { step: 'api', errorType: 'network', message: `Network error: ${err.message}`, checkedAt: Date.now() };
            resolve(undefined);
        });
        req.on('timeout', () => {
            logCrashlytics('error', `Request timeout for ${parsed.pathname}`);
            lastDiagnostic = { step: 'api', errorType: 'timeout', message: 'Request timed out', checkedAt: Date.now() };
            req.destroy();
            resolve(undefined);
        });
        if (body) { req.write(body); }
        req.end();
    });
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


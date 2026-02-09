/** Firebase Crashlytics integration — queries crash data via REST API with gcloud auth. */

import * as vscode from 'vscode';
import { execFile } from 'child_process';
import { getLogDirectoryUri } from './config';

export interface CrashlyticsIssue {
    readonly id: string;
    readonly title: string;
    readonly subtitle: string;
    readonly eventCount: number;
    readonly userCount: number;
}

export interface FirebaseContext {
    readonly available: boolean;
    readonly setupHint?: string;
    readonly issues: readonly CrashlyticsIssue[];
    readonly consoleUrl?: string;
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
}

interface FirebaseConfig { readonly projectId: string; readonly appId: string; }

let gcloudAvailable: boolean | undefined;
let cachedToken: { token: string; expires: number } | undefined;
const tokenTtl = 30 * 60_000;
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

async function getAccessToken(): Promise<string | undefined> {
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

/** Query Firebase Crashlytics for issues matching error tokens. */
export async function getFirebaseContext(errorTokens: readonly string[]): Promise<FirebaseContext> {
    if (!await isGcloudAvailable()) {
        return { available: false, setupHint: 'Install gcloud CLI from https://cloud.google.com/sdk', issues: [] };
    }
    const token = await getAccessToken();
    if (!token) {
        return { available: false, setupHint: 'Run: gcloud auth application-default login', issues: [] };
    }
    const config = await detectFirebaseConfig();
    if (!config) {
        return { available: false, setupHint: 'Add google-services.json to workspace or set firebase.projectId/appId', issues: [] };
    }
    const consoleUrl = `https://console.firebase.google.com/project/${config.projectId}/crashlytics/app/${config.appId}/issues`;
    const issues = await queryTopIssues(config, token, errorTokens).catch(() => []);
    return { available: true, issues, consoleUrl };
}

async function queryTopIssues(config: FirebaseConfig, token: string, errorTokens: readonly string[]): Promise<CrashlyticsIssue[]> {
    const url = `${apiBase}/projects/${config.projectId}/apps/${config.appId}/reports/topIssues:query`;
    const body = JSON.stringify({
        issueFilters: { issueErrorTypes: ['FATAL', 'NON_FATAL'] },
        pageSize: 20,
    });
    const data = await fetchJson(url, token, body);
    if (!data?.rows || !Array.isArray(data.rows)) { return []; }
    return matchIssues(data.rows as Record<string, unknown>[], errorTokens);
}

function matchIssues(rows: Record<string, unknown>[], errorTokens: readonly string[]): CrashlyticsIssue[] {
    const lowerTokens = errorTokens.map(t => t.toLowerCase());
    const results: CrashlyticsIssue[] = [];
    for (const row of rows) {
        const issue = row.issue as Record<string, unknown> | undefined;
        if (!issue) { continue; }
        const title = String(issue.title ?? '');
        const subtitle = String(issue.subtitle ?? '');
        const combined = (title + ' ' + subtitle).toLowerCase();
        if (!lowerTokens.some(t => combined.includes(t))) { continue; }
        results.push({
            id: String(issue.id ?? ''),
            title, subtitle,
            eventCount: Number(row.eventCount ?? 0),
            userCount: Number(row.impactedUsers ?? 0),
        });
    }
    return results.slice(0, 5);
}

function fetchJson(url: string, token: string, body?: string): Promise<Record<string, unknown> | undefined> {
    return new Promise((resolve) => {
        const https = require('https') as typeof import('https');
        const parsed = new URL(url);
        const req = https.request({
            hostname: parsed.hostname, path: parsed.pathname + parsed.search,
            method: body ? 'POST' : 'GET', timeout: apiTimeout,
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

async function readCachedDetail(issueId: string): Promise<CrashlyticsEventDetail | undefined> {
    const uri = getCacheUri(issueId);
    if (!uri) { return undefined; }
    try {
        const raw = await vscode.workspace.fs.readFile(uri);
        return JSON.parse(Buffer.from(raw).toString('utf-8')) as CrashlyticsEventDetail;
    } catch { return undefined; }
}

async function writeCacheDetail(issueId: string, detail: CrashlyticsEventDetail): Promise<void> {
    const uri = getCacheUri(issueId);
    if (!uri) { return; }
    await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(uri, '..'));
    await vscode.workspace.fs.writeFile(uri, Buffer.from(JSON.stringify(detail, null, 2)));
}

/** Fetch the latest crash event for a specific issue, returning parsed stack trace. */
export async function getCrashEventDetail(issueId: string): Promise<CrashlyticsEventDetail | undefined> {
    const cached = await readCachedDetail(issueId);
    if (cached) { return cached; }
    const token = await getAccessToken();
    if (!token) { return undefined; }
    const config = await detectFirebaseConfig();
    if (!config) { return undefined; }
    const url = `${apiBase}/projects/${config.projectId}/apps/${config.appId}/issues/${issueId}/events?pageSize=1`;
    const data = await fetchJson(url, token);
    if (!data) { return undefined; }
    const detail = parseEventResponse(issueId, data);
    if (detail) { writeCacheDetail(issueId, detail).catch(() => {}); }
    return detail;
}

const maxFramesPerThread = 50;
const frameLineRe = /^\s+at\s+(.+)/;
const javaFrameRe = /^([\w.$]+)\(([\w.]+):(\d+)\)$/;

function parseEventResponse(issueId: string, data: Record<string, unknown>): CrashlyticsEventDetail | undefined {
    const events = data.events ?? data.crashEvents;
    if (!Array.isArray(events) || events.length === 0) { return parseRawTrace(issueId, data); }
    const event = events[0] as Record<string, unknown>;
    const threads = event.threads ?? event.executionThreads;
    if (Array.isArray(threads)) { return parseStructuredThreads(issueId, threads); }
    const trace = event.stackTrace ?? event.exception;
    if (typeof trace === 'string') { return parseRawTrace(issueId, { stackTrace: trace }); }
    return parseRawTrace(issueId, data);
}

function parseStructuredThreads(issueId: string, threads: unknown[]): CrashlyticsEventDetail {
    let crashThread: CrashlyticsThread | undefined;
    const appThreads: CrashlyticsThread[] = [];
    for (const t of threads) {
        const thread = t as Record<string, unknown>;
        const name = String(thread.name ?? thread.threadName ?? 'Unknown');
        const rawFrames = (thread.frames ?? thread.stackFrames) as unknown[] | undefined;
        if (!Array.isArray(rawFrames)) { continue; }
        const frames = rawFrames.slice(0, maxFramesPerThread).map(parseStructuredFrame);
        const parsed: CrashlyticsThread = { name, frames };
        if (!crashThread && (thread.crashed === true || /fatal|exception/i.test(name))) { crashThread = parsed; }
        else { appThreads.push(parsed); }
    }
    return { issueId, crashThread, appThreads };
}

function parseStructuredFrame(raw: unknown): CrashlyticsStackFrame {
    const f = raw as Record<string, unknown>;
    const symbol = String(f.symbol ?? f.className ?? '');
    const method = f.methodName ? `.${f.methodName}` : '';
    const file = f.file ?? f.fileName;
    const line = Number(f.line ?? f.lineNumber ?? 0);
    const text = file ? `at ${symbol}${method}(${file}:${line})` : `at ${symbol}${method}`;
    return { text, fileName: file ? String(file) : undefined, lineNumber: line || undefined };
}

function parseRawTrace(issueId: string, data: Record<string, unknown>): CrashlyticsEventDetail | undefined {
    const raw = String(data.stackTrace ?? '');
    if (!raw || raw.length < 10) { return undefined; }
    const lines = raw.split(/\r?\n/);
    const frames: CrashlyticsStackFrame[] = [];
    for (const line of lines) {
        const m = frameLineRe.exec(line);
        if (!m) { continue; }
        const frameText = m[1].trim();
        const jm = javaFrameRe.exec(frameText);
        frames.push({
            text: `at ${frameText}`,
            fileName: jm?.[2],
            lineNumber: jm ? Number(jm[3]) : undefined,
        });
        if (frames.length >= maxFramesPerThread) { break; }
    }
    if (frames.length === 0) { return undefined; }
    return { issueId, crashThread: { name: 'Fatal Exception', frames }, appThreads: [] };
}

function runCmd(cmd: string, args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
        execFile(cmd, args, { timeout: apiTimeout }, (err, stdout) => {
            if (err) { reject(err); return; }
            resolve((stdout ?? '').trim());
        });
    });
}

/** Firebase Crashlytics integration — queries crash data via REST API with gcloud auth. */

import * as vscode from 'vscode';
import { execFile } from 'child_process';

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

function fetchJson(url: string, token: string, body: string): Promise<Record<string, unknown> | undefined> {
    return new Promise((resolve) => {
        const https = require('https') as typeof import('https');
        const parsed = new URL(url);
        const req = https.request({
            hostname: parsed.hostname, path: parsed.pathname + parsed.search,
            method: 'POST', timeout: apiTimeout,
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        }, (res) => {
            let data = '';
            res.on('data', (chunk: string) => { data += chunk; });
            res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve(undefined); } });
        });
        req.on('error', () => resolve(undefined));
        req.on('timeout', () => { req.destroy(); resolve(undefined); });
        req.write(body);
        req.end();
    });
}

function runCmd(cmd: string, args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
        execFile(cmd, args, { timeout: apiTimeout }, (err, stdout) => {
            if (err) { reject(err); return; }
            resolve((stdout ?? '').trim());
        });
    });
}

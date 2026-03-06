/** Firebase Crashlytics REST API query functions. */

import * as vscode from 'vscode';
import { detectAppVersion } from '../misc/app-version';
import { apiTimeout, readCachedEvents, writeCacheEvents } from './crashlytics-io';
import { parseEventResponse } from './crashlytics-event-parser';
import { logCrashlytics, classifyHttpStatus, type DiagnosticDetails } from './crashlytics-diagnostics';
import type { CrashlyticsIssue, CrashlyticsIssueEvents, CrashlyticsEventDetail, FirebaseConfig } from './crashlytics-types';

const apiBase = 'https://firebasecrashlytics.googleapis.com/v1beta1';
const issueListTtl = 5 * 60_000;
let cachedIssueRows: { rows: Record<string, unknown>[]; expires: number } | undefined;

let lastApiDiagnostic: DiagnosticDetails | undefined;

/** Get last diagnostic detail from API operations (for error reporting by caller). */
export function getLastApiDiagnostic(): DiagnosticDetails | undefined { return lastApiDiagnostic; }

/** Reset cached issue list (called when the parent module clears all caches). */
export function clearApiCache(): void {
    cachedIssueRows = undefined;
    lastApiDiagnostic = undefined;
}

function getTimeRange(): string {
    const cfg = vscode.workspace.getConfiguration('saropaLogCapture.firebase');
    return cfg.get<string>('timeRange', 'LAST_7_DAYS');
}

/** Never throws; returns [] on any failure. */
export async function queryTopIssues(config: FirebaseConfig, token: string, errorTokens: readonly string[]): Promise<CrashlyticsIssue[]> {
    try {
        if (cachedIssueRows && Date.now() < cachedIssueRows.expires) {
            return matchIssues(cachedIssueRows.rows, errorTokens);
        }
        if (!config?.projectId || !config?.appId || typeof token !== 'string') { return []; }
        const url = `${apiBase}/projects/${config.projectId}/apps/${config.appId}/reports/topIssues:query`;
        const filters: Record<string, unknown> = { issueErrorTypes: ['FATAL', 'NON_FATAL'] };
        try {
            const ver = await detectAppVersion();
            if (ver) { filters.versions = [ver]; }
        } catch {
            // Proceed without version filter
        }
        const body = JSON.stringify({
            issueFilters: filters,
            pageSize: 20,
            eventTimePeriod: getTimeRange(),
        });
        const data = await fetchJson(url, token, body);
        if (!data?.rows || !Array.isArray(data.rows)) { return []; }
        cachedIssueRows = { rows: data.rows as Record<string, unknown>[], expires: Date.now() + issueListTtl };
        return matchIssues(cachedIssueRows.rows, errorTokens);
    } catch {
        return [];
    }
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

/** Update a Crashlytics issue state (close or mute). Returns true on success. Never throws. */
export async function updateIssueState(config: FirebaseConfig, token: string, issueId: string, state: 'CLOSED' | 'MUTED'): Promise<boolean> {
    try {
        if (!config?.projectId || !config?.appId || !issueId) { return false; }
        const url = `${apiBase}/projects/${config.projectId}/apps/${config.appId}/issues/${encodeURIComponent(issueId)}?updateMask=state`;
        const result = await fetchJson(url, token, JSON.stringify({ state }), 'PATCH');
        return result !== undefined;
    } catch {
        return false;
    }
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
                    lastApiDiagnostic = { step: 'api', errorType: 'http', message: msg, httpStatus: status, checkedAt: Date.now(), technicalDetails: data.slice(0, 300) };
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
            lastApiDiagnostic = { step: 'api', errorType: 'network', message: `Network error: ${err.message}`, checkedAt: Date.now() };
            resolve(undefined);
        });
        req.on('timeout', () => {
            logCrashlytics('error', `Request timeout for ${parsed.pathname}`);
            lastApiDiagnostic = { step: 'api', errorType: 'timeout', message: 'Request timed out', checkedAt: Date.now() };
            req.destroy();
            resolve(undefined);
        });
        if (body) { req.write(body); }
        req.end();
    });
}

/** Fetch crash events for a specific issue, returning the first event detail. */
export async function getCrashEventDetail(token: string, config: FirebaseConfig, issueId: string): Promise<CrashlyticsEventDetail | undefined> {
    const multi = await getCrashEvents(token, config, issueId);
    return multi?.events[multi.currentIndex];
}

/** Fetch multiple crash events for an issue (cached). */
export async function getCrashEvents(token: string, config: FirebaseConfig, issueId: string): Promise<CrashlyticsIssueEvents | undefined> {
    const cached = await readCachedEvents(issueId);
    if (cached) { return cached; }
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

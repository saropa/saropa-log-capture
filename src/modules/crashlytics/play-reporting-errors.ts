/**
 * Google Play Developer Reporting — error issues & reports client (the REAL public crash API).
 *
 * Why this exists (bug_008 W3): `firebasecrashlytics.googleapis.com`'s read endpoints return a Google
 * frontend HTML 404 — they are not a public API. Play Developer Reporting `vitals.errors` is the
 * documented public surface for crash/ANR/non-fatal issues and their stacks.
 *
 * Auth (bug_008 W4): requires the `playdeveloperreporting` OAuth scope, which the default ADC token
 * lacks (403 ACCESS_TOKEN_SCOPE_INSUFFICIENT). The diagnostic surfaces the exact re-auth command.
 *
 * Silent-failure rule (bug_008): every failure returns a populated `diagnostic` so a caller can tell
 * "no crashes" (empty + no diagnostic) apart from "the call failed" (empty + diagnostic).
 */

import * as https from 'https';
import { classifyHttpStatus, type DiagnosticDetails } from './crashlytics-diagnostics';
import { mapErrorIssue, mapErrorReport, issueShortId } from './play-reporting-mappers';
import type { CrashlyticsIssue, CrashlyticsEventDetail } from './crashlytics-types';

const apiBase = 'https://playdeveloperreporting.googleapis.com/v1beta1';
const timeoutMs = 15_000;

/** Result wrapper: data plus an optional diagnostic that is set on ANY failure (never a silent empty). */
export interface PlayResult<T> {
    readonly data: T;
    readonly diagnostic?: DiagnosticDetails;
}

/** Shared inputs for a Play Reporting query (kept as one object to stay within the param limit). */
export interface PlayQuery {
    readonly packageName: string;
    readonly token: string;
    readonly timeRange: string;
}

/** Map the firebase.timeRange setting to a day count for the required reporting interval. */
function rangeDays(range: string): number {
    switch (range) {
        case 'LAST_24_HOURS': return 1;
        case 'LAST_30_DAYS': return 30;
        case 'LAST_90_DAYS': return 90;
        default: return 7;
    }
}

/** Build the required `interval.startTime.*` / `interval.endTime.*` query params (full UTC days). */
function intervalQuery(days: number): string {
    const part = (d: Date, key: string): string =>
        `interval.${key}.year=${d.getUTCFullYear()}&interval.${key}.month=${d.getUTCMonth() + 1}&interval.${key}.day=${d.getUTCDate()}`;
    const end = new Date();
    const start = new Date(Date.now() - days * 86_400_000);
    return `${part(start, 'startTime')}&${part(end, 'endTime')}`;
}

/** GET a URL with a bearer token; resolves with status + raw body (status 0 = transport error). */
function getJson(url: string, token: string): Promise<{ status: number; body: string }> {
    return new Promise((resolve) => {
        const u = new URL(url);
        const req = https.request(
            { hostname: u.hostname, path: u.pathname + u.search, method: 'GET', timeout: timeoutMs, headers: { Authorization: `Bearer ${token}` } },
            (res) => {
                let data = '';
                res.on('data', (chunk: string) => { data += chunk; });
                res.on('end', () => resolve({ status: res.statusCode ?? 0, body: data }));
            },
        );
        req.on('error', (err) => resolve({ status: 0, body: err.message }));
        req.on('timeout', () => { req.destroy(); resolve({ status: 0, body: 'Request timed out' }); });
        req.end();
    });
}

/** Build a diagnostic from a non-200 response; classifyHttpStatus decodes scope/disabled/etc. */
function failure(status: number, body: string): DiagnosticDetails {
    return {
        step: 'api',
        errorType: status === 0 ? 'network' : 'http',
        httpStatus: status || undefined,
        message: status === 0 ? `Network error: ${body.slice(0, 120)}` : classifyHttpStatus(status, body),
        technicalDetails: body.slice(0, 300),
        checkedAt: Date.now(),
    };
}

/** Top error issues for an app, ordered by report count. Never throws; diagnostic set on failure. */
export async function fetchPlayErrorIssues(q: PlayQuery, pageSize: number): Promise<PlayResult<CrashlyticsIssue[]>> {
    const params = `${intervalQuery(rangeDays(q.timeRange))}&pageSize=${pageSize}&orderBy=${encodeURIComponent('errorReportCount desc')}`;
    const url = `${apiBase}/apps/${encodeURIComponent(q.packageName)}/errorIssues:search?${params}`;
    const { status, body } = await getJson(url, q.token);
    if (status !== 200) { return { data: [], diagnostic: failure(status, body) }; }
    try {
        const json = JSON.parse(body) as { errorIssues?: Record<string, unknown>[] };
        return { data: (json.errorIssues ?? []).map(mapErrorIssue) };
    } catch {
        return { data: [], diagnostic: failure(status, body) };
    }
}

/** Sample error reports (stacks) for one issue. Never throws; diagnostic set on failure. */
export async function fetchPlayErrorReports(q: PlayQuery, issueResourceName: string, limit: number): Promise<PlayResult<CrashlyticsEventDetail[]>> {
    const filter = encodeURIComponent(`errorIssueId = ${issueShortId(issueResourceName)}`);
    const params = `${intervalQuery(rangeDays(q.timeRange))}&pageSize=${limit}&filter=${filter}`;
    const url = `${apiBase}/apps/${encodeURIComponent(q.packageName)}/errorReports:search?${params}`;
    const { status, body } = await getJson(url, q.token);
    if (status !== 200) { return { data: [], diagnostic: failure(status, body) }; }
    try {
        const json = JSON.parse(body) as { errorReports?: Record<string, unknown>[] };
        return { data: (json.errorReports ?? []).map(r => mapErrorReport(issueResourceName, r)) };
    } catch {
        return { data: [], diagnostic: failure(status, body) };
    }
}

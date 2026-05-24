/**
 * Google Play Developer Reporting — error count metric set (true device/OS aggregates per issue).
 *
 * Unlike the sampled-event estimate, this returns real aggregate counts. Verified recipe (bug_008 /
 * plan 054): the query REQUIRES the `reportType` dimension, supports an `issueId` filter for per-issue
 * breakdowns, and `timelineSpec.endTime` must be ≤ the metric set's freshness (else 400). We read the
 * freshness from the descriptor and clamp to it.
 */

import * as https from 'https';
import { classifyHttpStatus, type DiagnosticDetails } from './crashlytics-diagnostics';
import { issueShortId } from './play-reporting-mappers';
import type { PlayQuery } from './play-reporting-errors';

const apiBase = 'https://playdeveloperreporting.googleapis.com/v1beta1';
const timeoutMs = 15_000;

export interface StatEntry { readonly name: string; readonly count: number; }
export interface IssueBreakdown {
    readonly devices: readonly StatEntry[];
    readonly os: readonly StatEntry[];
    readonly diagnostic?: DiagnosticDetails;
}

interface Ymd { readonly year: number; readonly month: number; readonly day: number; }

function rangeDays(range: string): number {
    switch (range) { case 'LAST_24_HOURS': return 1; case 'LAST_30_DAYS': return 30; case 'LAST_90_DAYS': return 90; default: return 7; }
}

function toYmd(d: Date): Ymd { return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() }; }

function minusDays(end: Ymd, days: number): Ymd {
    return toYmd(new Date(Date.UTC(end.year, end.month - 1, end.day) - days * 86_400_000));
}

/** Read/POST helper: returns parsed JSON or a diagnostic on any non-200 / transport error. */
function request(path: string, q: PlayQuery, body?: string): Promise<{ json?: Record<string, unknown>; diagnostic?: DiagnosticDetails }> {
    return new Promise((resolve) => {
        const u = new URL(`${apiBase}/apps/${encodeURIComponent(q.packageName)}/${path}`);
        const headers: Record<string, string> = { Authorization: `Bearer ${q.token}`, 'Content-Type': 'application/json' };
        if (q.quotaProject) { headers['X-Goog-User-Project'] = q.quotaProject; }
        const req = https.request({ hostname: u.hostname, path: u.pathname + u.search, method: body ? 'POST' : 'GET', timeout: timeoutMs, headers }, (res) => {
            let data = ''; res.on('data', (c: string) => { data += c; });
            res.on('end', () => {
                const status = res.statusCode ?? 0;
                if (status !== 200) { resolve({ diagnostic: { step: 'api', errorType: 'http', httpStatus: status, checkedAt: Date.now(), message: classifyHttpStatus(status, data), technicalDetails: data.slice(0, 300) } }); return; }
                try { resolve({ json: JSON.parse(data) }); } catch { resolve({ diagnostic: { step: 'api', errorType: 'http', checkedAt: Date.now(), message: 'Invalid JSON from metric set' } }); }
            });
        });
        req.on('error', (e) => resolve({ diagnostic: { step: 'api', errorType: 'network', checkedAt: Date.now(), message: `Network error: ${e.message}` } }));
        req.on('timeout', () => { req.destroy(); resolve({ diagnostic: { step: 'api', errorType: 'timeout', checkedAt: Date.now(), message: 'Metric set request timed out' } }); });
        if (body) { req.write(body); }
        req.end();
    });
}

/** FULL_RANGE freshness end date from the descriptor; falls back to two days ago if unavailable. */
async function freshnessEnd(q: PlayQuery): Promise<Ymd> {
    const { json } = await request('errorCountMetricSet', q);
    const freshnesses = (json?.freshnessInfo as { freshnesses?: { aggregationPeriod?: string; latestEndTime?: Ymd }[] } | undefined)?.freshnesses ?? [];
    const full = freshnesses.find(f => f.aggregationPeriod === 'FULL_RANGE') ?? freshnesses[0];
    return full?.latestEndTime ?? minusDays(toYmd(new Date()), 2);
}

/** Read one dimension value off a metric-set row (the value field varies by dimension type). */
function dimValue(dim: Record<string, unknown> | undefined): string {
    if (!dim) { return ''; }
    return String(dim.stringValue ?? dim.int64Value ?? dim.valueLabel ?? '').trim();
}

/** Parse metric-set rows into sorted StatEntry[] for one grouping dimension. Pure (testable). */
export function parseMetricRows(json: Record<string, unknown> | undefined, dimName: string): StatEntry[] {
    const rows = (json?.rows as Record<string, unknown>[] | undefined) ?? [];
    const out: StatEntry[] = [];
    for (const row of rows) {
        const dims = (row.dimensions as Record<string, unknown>[] | undefined) ?? [];
        const metrics = (row.metrics as Record<string, unknown>[] | undefined) ?? [];
        const name = dimValue(dims.find(d => d.dimension === dimName));
        const metric = metrics.find(m => m.metric === 'errorReportCount');
        const count = Number((metric?.decimalValue as { value?: string } | undefined)?.value ?? 0);
        if (name && count > 0) { out.push({ name, count }); }
    }
    return out.sort((a, b) => b.count - a.count).slice(0, 12);
}

async function queryDimension(q: PlayQuery, ts: object, dim: string, filter: string): Promise<{ entries: StatEntry[]; diagnostic?: DiagnosticDetails }> {
    const body = JSON.stringify({ timelineSpec: ts, dimensions: ['reportType', dim], metrics: ['errorReportCount'], filter, pageSize: 50 });
    const { json, diagnostic } = await request('errorCountMetricSet:query', q, body);
    return { entries: diagnostic ? [] : parseMetricRows(json, dim), diagnostic };
}

/** Fetch true device + OS aggregates for one issue. Never throws; diagnostic set on failure. */
export async function fetchIssueBreakdown(q: PlayQuery, issueResourceName: string): Promise<IssueBreakdown> {
    const end = await freshnessEnd(q);
    const ts = { aggregationPeriod: 'FULL_RANGE', startTime: minusDays(end, rangeDays(q.timeRange)), endTime: end };
    const filter = `issueId = ${issueShortId(issueResourceName)}`;
    const [dev, os] = await Promise.all([
        queryDimension(q, ts, 'deviceBrand', filter),
        queryDimension(q, ts, 'apiLevel', filter),
    ]);
    return {
        devices: dev.entries,
        os: os.entries.map(e => ({ name: `API ${e.name}`, count: e.count })),
        diagnostic: dev.diagnostic ?? os.diagnostic,
    };
}

/** Google Play Developer Reporting API integration — queries Vitals metrics. */

import { getAccessToken } from './firebase-crashlytics';
import { detectPackageName } from '../misc/app-identity';
import { classifyHttpStatus, logCrashlytics, type DiagnosticDetails } from './crashlytics-diagnostics';
import type { VitalsQueryResponse, VitalsSnapshot } from './google-play-vitals-types';
import { latestMetric, metricSeries } from './vitals-metrics';

const apiBase = 'https://playdeveloperreporting.googleapis.com/v1beta1';
const cacheTtl = 15 * 60_000;
const apiTimeout = 15_000;

let cached: { snapshot: VitalsSnapshot; expires: number } | undefined;
// Last failure reason, so a blank Vitals panel can explain WHY (e.g. missing scope) instead of a
// silent "N/A" — the vitals path previously swallowed every error (bug_008 silent-failure fix).
let lastVitalsDiagnostic: DiagnosticDetails | undefined;

/** Last Vitals failure diagnostic (undefined after a successful query). */
export function getVitalsDiagnostic(): DiagnosticDetails | undefined { return lastVitalsDiagnostic; }

/** Query crash rate and ANR rate from Google Play Vitals. Cached for 15 min. */
export async function queryVitals(): Promise<VitalsSnapshot | undefined> {
    if (cached && Date.now() < cached.expires) { return cached.snapshot; }
    lastVitalsDiagnostic = undefined;
    const packageName = await detectPackageName();
    if (!packageName) {
        lastVitalsDiagnostic = { step: 'config', errorType: 'config', checkedAt: Date.now(), message: 'No Android package name found for Vitals.' };
        return undefined;
    }
    const token = await getAccessToken();
    if (!token) {
        lastVitalsDiagnostic = { step: 'token', errorType: 'auth', checkedAt: Date.now(), message: 'Not signed in — cannot query Vitals.' };
        return undefined;
    }
    const [crashData, anrData] = await Promise.all([
        queryMetricSet(packageName, 'crashRateMetricSet', token),
        queryMetricSet(packageName, 'anrRateMetricSet', token),
    ]);
    const snapshot: VitalsSnapshot = {
        crashRate: latestMetric(crashData, 'crashRate'),
        userCrashRate: latestMetric(crashData, 'userPerceivedCrashRate'),
        anrRate: latestMetric(anrData, 'anrRate'),
        crashRateSeries: metricSeries(crashData, 'crashRate'),
        anrRateSeries: metricSeries(anrData, 'anrRate'),
        queriedAt: Date.now(),
        packageName,
    };
    cached = { snapshot, expires: Date.now() + cacheTtl };
    return snapshot;
}

/** Clear the Vitals cache. */
export function clearVitalsCache(): void { cached = undefined; }

/** Bad-behavior thresholds from Google Play Console. */
export const thresholds = {
    crashRate: 1.09,
    anrRate: 0.47,
} as const;

async function queryMetricSet(
    packageName: string, metricSet: string, token: string,
): Promise<VitalsQueryResponse | undefined> {
    const url = `${apiBase}/apps/${packageName}/${metricSet}:query`;
    // Crash query also asks for the distinct-user rate (userPerceivedCrashRate) so the panel can show
    // crash-free USERS alongside crash-free sessions — both come back in one call.
    const metrics = metricSet === 'crashRateMetricSet' ? ['crashRate', 'userPerceivedCrashRate'] : ['anrRate'];
    // The API rejects (400) any timelineSpec.endTime later than the metric set's freshness, which lags
    // "today" by 1-2 days — so query up to the descriptor's reported freshness, not today(). Without
    // this clamp the crash-free panel comes back empty whenever the latest day isn't aggregated yet.
    const end = await freshnessEnd(packageName, metricSet, token);
    const body = JSON.stringify({
        timelineSpec: { aggregationPeriod: 'DAILY', startTime: minusDays(end, 7), endTime: end },
        metrics,
        dimensions: [],
    });
    return fetchJson(url, token, body) as Promise<VitalsQueryResponse | undefined>;
}

type Ymd = { year: number; month: number; day: number };

/** DAILY freshness end date from the metric-set descriptor; falls back to two days ago if unavailable. */
async function freshnessEnd(packageName: string, metricSet: string, token: string): Promise<Ymd> {
    const json = await fetchJson(`${apiBase}/apps/${packageName}/${metricSet}`, token);
    const freshnesses = (json?.freshnessInfo as { freshnesses?: { aggregationPeriod?: string; latestEndTime?: Ymd }[] } | undefined)?.freshnesses ?? [];
    const daily = freshnesses.find((f) => f.aggregationPeriod === 'DAILY') ?? freshnesses[0];
    return daily?.latestEndTime ?? daysAgo(2);
}

function daysAgo(n: number): Ymd {
    const d = new Date(Date.now() - n * 86400000);
    return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

function minusDays(end: Ymd, n: number): Ymd {
    const d = new Date(Date.UTC(end.year, end.month - 1, end.day) - n * 86400000);
    return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

function fetchJson(url: string, token: string, body?: string): Promise<Record<string, unknown> | undefined> {
    return new Promise((resolve) => {
        const https = require('https') as typeof import('https');
        const parsed = new URL(url);
        // POST a query body when one is given; otherwise GET (used to read a metric-set descriptor).
        const req = https.request({
            hostname: parsed.hostname, path: parsed.pathname + parsed.search,
            method: body === undefined ? 'GET' : 'POST', timeout: apiTimeout,
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        }, (res) => {
            let data = '';
            res.on('data', (chunk: string) => { data += chunk; });
            res.on('end', () => {
                const status = res.statusCode ?? 0;
                if (status >= 400) {
                    // Record the reason (classifyHttpStatus decodes a missing scope / disabled API)
                    // so the panel can show it rather than a silent "N/A". (bug_008)
                    const message = classifyHttpStatus(status, data);
                    lastVitalsDiagnostic = { step: 'api', errorType: 'http', httpStatus: status, checkedAt: Date.now(), message, technicalDetails: data.slice(0, 300) };
                    logCrashlytics('error', `Vitals HTTP ${status}: ${message}`);
                    resolve(undefined);
                    return;
                }
                try { resolve(JSON.parse(data)); } catch { resolve(undefined); }
            });
        });
        req.on('error', (err) => {
            lastVitalsDiagnostic = { step: 'api', errorType: 'network', checkedAt: Date.now(), message: `Network error: ${err.message}` };
            resolve(undefined);
        });
        req.on('timeout', () => { req.destroy(); lastVitalsDiagnostic = { step: 'api', errorType: 'timeout', checkedAt: Date.now(), message: 'Vitals request timed out' }; resolve(undefined); });
        if (body !== undefined) { req.write(body); }
        req.end();
    });
}

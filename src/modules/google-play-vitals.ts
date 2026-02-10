/** Google Play Developer Reporting API integration — queries Vitals metrics. */

import { getAccessToken } from './firebase-crashlytics';
import { detectPackageName } from './app-identity';
import type { VitalsQueryResponse, VitalsSnapshot } from './google-play-vitals-types';

const apiBase = 'https://playdeveloperreporting.googleapis.com/v1beta1';
const cacheTtl = 15 * 60_000;
const apiTimeout = 15_000;

let cached: { snapshot: VitalsSnapshot; expires: number } | undefined;

/** Query crash rate and ANR rate from Google Play Vitals. Cached for 15 min. */
export async function queryVitals(): Promise<VitalsSnapshot | undefined> {
    if (cached && Date.now() < cached.expires) { return cached.snapshot; }
    const packageName = await detectPackageName();
    if (!packageName) { return undefined; }
    const token = await getAccessToken();
    if (!token) { return undefined; }
    const [crashData, anrData] = await Promise.all([
        queryMetricSet(packageName, 'crashRateMetricSet', token),
        queryMetricSet(packageName, 'anrRateMetricSet', token),
    ]);
    const snapshot: VitalsSnapshot = {
        crashRate: extractLatestRate(crashData),
        anrRate: extractLatestRate(anrData),
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
    const body = JSON.stringify({
        timelineSpec: { aggregationPeriod: 'DAILY', startTime: daysAgo(7), endTime: today() },
        metrics: [metricSet === 'crashRateMetricSet' ? 'crashRate' : 'anrRate'],
        dimensions: [],
    });
    return fetchJson(url, token, body) as Promise<VitalsQueryResponse | undefined>;
}

function extractLatestRate(data: VitalsQueryResponse | undefined): number | undefined {
    if (!data?.rows || data.rows.length === 0) { return undefined; }
    const last = data.rows[data.rows.length - 1];
    const metric = last.metrics ? Object.values(last.metrics)[0] : undefined;
    const raw = metric?.decimalValue?.value;
    if (!raw) { return undefined; }
    const val = parseFloat(raw);
    return isNaN(val) ? undefined : val * 100;
}

function daysAgo(n: number): { year: number; month: number; day: number } {
    const d = new Date(Date.now() - n * 86400000);
    return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

function today(): { year: number; month: number; day: number } { return daysAgo(0); }

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

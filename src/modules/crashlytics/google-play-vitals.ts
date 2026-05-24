/** Google Play Developer Reporting API integration — queries Vitals metrics. */

import { getAccessToken } from './firebase-crashlytics';
import { detectPackageName } from '../misc/app-identity';
import { classifyHttpStatus, logCrashlytics, type DiagnosticDetails } from './crashlytics-diagnostics';
import type { VitalsQueryResponse, VitalsSnapshot } from './google-play-vitals-types';

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
        req.write(body);
        req.end();
    });
}

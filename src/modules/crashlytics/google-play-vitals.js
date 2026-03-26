"use strict";
/** Google Play Developer Reporting API integration — queries Vitals metrics. */
Object.defineProperty(exports, "__esModule", { value: true });
exports.thresholds = void 0;
exports.queryVitals = queryVitals;
exports.clearVitalsCache = clearVitalsCache;
const firebase_crashlytics_1 = require("./firebase-crashlytics");
const app_identity_1 = require("../misc/app-identity");
const apiBase = 'https://playdeveloperreporting.googleapis.com/v1beta1';
const cacheTtl = 15 * 60_000;
const apiTimeout = 15_000;
let cached;
/** Query crash rate and ANR rate from Google Play Vitals. Cached for 15 min. */
async function queryVitals() {
    if (cached && Date.now() < cached.expires) {
        return cached.snapshot;
    }
    const packageName = await (0, app_identity_1.detectPackageName)();
    if (!packageName) {
        return undefined;
    }
    const token = await (0, firebase_crashlytics_1.getAccessToken)();
    if (!token) {
        return undefined;
    }
    const [crashData, anrData] = await Promise.all([
        queryMetricSet(packageName, 'crashRateMetricSet', token),
        queryMetricSet(packageName, 'anrRateMetricSet', token),
    ]);
    const snapshot = {
        crashRate: extractLatestRate(crashData),
        anrRate: extractLatestRate(anrData),
        queriedAt: Date.now(),
        packageName,
    };
    cached = { snapshot, expires: Date.now() + cacheTtl };
    return snapshot;
}
/** Clear the Vitals cache. */
function clearVitalsCache() { cached = undefined; }
/** Bad-behavior thresholds from Google Play Console. */
exports.thresholds = {
    crashRate: 1.09,
    anrRate: 0.47,
};
async function queryMetricSet(packageName, metricSet, token) {
    const url = `${apiBase}/apps/${packageName}/${metricSet}:query`;
    const body = JSON.stringify({
        timelineSpec: { aggregationPeriod: 'DAILY', startTime: daysAgo(7), endTime: today() },
        metrics: [metricSet === 'crashRateMetricSet' ? 'crashRate' : 'anrRate'],
        dimensions: [],
    });
    return fetchJson(url, token, body);
}
function extractLatestRate(data) {
    if (!data?.rows || data.rows.length === 0) {
        return undefined;
    }
    const last = data.rows[data.rows.length - 1];
    const metric = last.metrics ? Object.values(last.metrics)[0] : undefined;
    const raw = metric?.decimalValue?.value;
    if (!raw) {
        return undefined;
    }
    const val = parseFloat(raw);
    return isNaN(val) ? undefined : val * 100;
}
function daysAgo(n) {
    const d = new Date(Date.now() - n * 86400000);
    return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}
function today() { return daysAgo(0); }
function fetchJson(url, token, body) {
    return new Promise((resolve) => {
        const https = require('https');
        const parsed = new URL(url);
        const req = https.request({
            hostname: parsed.hostname, path: parsed.pathname + parsed.search,
            method: 'POST', timeout: apiTimeout,
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        }, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => { try {
                resolve(JSON.parse(data));
            }
            catch {
                resolve(undefined);
            } });
        });
        req.on('error', () => resolve(undefined));
        req.on('timeout', () => { req.destroy(); resolve(undefined); });
        req.write(body);
        req.end();
    });
}
//# sourceMappingURL=google-play-vitals.js.map
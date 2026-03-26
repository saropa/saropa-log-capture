"use strict";
/** Aggregate stats for a Crashlytics issue — device/OS distribution from the stats endpoint. */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getIssueStats = getIssueStats;
const firebase_crashlytics_1 = require("./firebase-crashlytics");
const apiBase = 'https://firebasecrashlytics.googleapis.com/v1beta1';
const statsTtl = 5 * 60_000;
let statsCache;
/** Query aggregate device/OS stats for a specific Crashlytics issue (cached 5 min per issue). */
async function getIssueStats(issueId) {
    const cached = statsCache?.get(issueId);
    if (cached && Date.now() < cached.expires) {
        return cached.stats;
    }
    const token = await (0, firebase_crashlytics_1.getAccessToken)();
    if (!token) {
        return undefined;
    }
    const config = await (0, firebase_crashlytics_1.detectFirebaseConfig)();
    if (!config) {
        return undefined;
    }
    const url = `${apiBase}/projects/${config.projectId}/apps/${config.appId}/issues/${issueId}:getStats`;
    try {
        const https = require('https');
        const data = await fetchStatsJson(https, url, token);
        if (!data) {
            return undefined;
        }
        const stats = {
            issueId,
            deviceStats: parseStatEntries(data.deviceStats ?? data.devices),
            osStats: parseStatEntries(data.osStats ?? data.osVersions),
        };
        if (!statsCache) {
            statsCache = new Map();
        }
        statsCache.set(issueId, { stats, expires: Date.now() + statsTtl });
        return stats;
    }
    catch {
        return undefined;
    }
}
function parseStatEntries(raw) {
    if (!Array.isArray(raw)) {
        return [];
    }
    return raw.slice(0, 20).map(e => {
        const entry = e;
        return { name: String(entry.model ?? entry.version ?? entry.name ?? ''), count: Number(entry.count ?? entry.eventCount ?? 0) };
    }).filter(e => e.name && e.count > 0);
}
function fetchStatsJson(https, url, token) {
    return new Promise((resolve) => {
        const parsed = new URL(url);
        const req = https.request({
            hostname: parsed.hostname, path: parsed.pathname + parsed.search,
            method: 'GET', timeout: 10_000,
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
        req.end();
    });
}
//# sourceMappingURL=crashlytics-stats.js.map
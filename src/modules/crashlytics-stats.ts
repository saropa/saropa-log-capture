/** Aggregate stats for a Crashlytics issue — device/OS distribution from the stats endpoint. */

import { detectFirebaseConfig } from './firebase-crashlytics';

const apiBase = 'https://firebasecrashlytics.googleapis.com/v1beta1';

export interface StatEntry { readonly name: string; readonly count: number; }

export interface IssueStats {
    readonly issueId: string;
    readonly deviceStats: readonly StatEntry[];
    readonly osStats: readonly StatEntry[];
}

/** Query aggregate device/OS stats for a specific Crashlytics issue. */
export async function getIssueStats(issueId: string, token: string): Promise<IssueStats | undefined> {
    const config = await detectFirebaseConfig();
    if (!config) { return undefined; }
    const url = `${apiBase}/projects/${config.projectId}/apps/${config.appId}/issues/${issueId}:getStats`;
    try {
        const https = require('https') as typeof import('https');
        const data = await fetchStatsJson(https, url, token);
        if (!data) { return undefined; }
        return {
            issueId,
            deviceStats: parseStatEntries(data.deviceStats ?? data.devices),
            osStats: parseStatEntries(data.osStats ?? data.osVersions),
        };
    } catch { return undefined; }
}

function parseStatEntries(raw: unknown): StatEntry[] {
    if (!Array.isArray(raw)) { return []; }
    return raw.slice(0, 20).map(e => {
        const entry = e as Record<string, unknown>;
        return { name: String(entry.model ?? entry.version ?? entry.name ?? ''), count: Number(entry.count ?? entry.eventCount ?? 0) };
    }).filter(e => e.name && e.count > 0);
}

function fetchStatsJson(https: typeof import('https'), url: string, token: string): Promise<Record<string, unknown> | undefined> {
    return new Promise((resolve) => {
        const parsed = new URL(url);
        const req = https.request({
            hostname: parsed.hostname, path: parsed.pathname + parsed.search,
            method: 'GET', timeout: 10_000,
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        }, (res) => {
            let data = '';
            res.on('data', (chunk: string) => { data += chunk; });
            res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve(undefined); } });
        });
        req.on('error', () => resolve(undefined));
        req.on('timeout', () => { req.destroy(); resolve(undefined); });
        req.end();
    });
}

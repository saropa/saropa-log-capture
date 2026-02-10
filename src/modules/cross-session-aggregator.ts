/**
 * Cross-session aggregator: read all sidecar metadata files and build
 * aggregated insights — hot files and recurring error patterns.
 */

import * as vscode from 'vscode';
import { getConfig, getLogDirectoryUri } from './config';
import type { SessionMeta } from './session-metadata';
import type { CrashCategory, FingerprintEntry } from './error-fingerprint';

/** A source file mentioned across multiple sessions. */
export interface HotFile {
    readonly filename: string;
    readonly sessionCount: number;
    readonly sessions: readonly { readonly filename: string; readonly uri: string }[];
}

/** A recurring error group across sessions. */
export interface RecurringError {
    readonly hash: string;
    readonly normalizedText: string;
    readonly exampleLine: string;
    readonly sessionCount: number;
    readonly totalOccurrences: number;
    readonly firstSeen: string;
    readonly lastSeen: string;
    readonly firstSeenVersion?: string;
    readonly lastSeenVersion?: string;
    readonly category?: CrashCategory;
    readonly timeline: readonly { readonly session: string; readonly count: number }[];
}

/** Environment distribution entry from session headers. */
export interface EnvironmentStat {
    readonly value: string;
    readonly sessionCount: number;
}

/** Aggregated cross-session insights. */
export interface CrossSessionInsights {
    readonly hotFiles: readonly HotFile[];
    readonly recurringErrors: readonly RecurringError[];
    readonly sessionCount: number;
    readonly platforms: readonly EnvironmentStat[];
    readonly sdkVersions: readonly EnvironmentStat[];
    readonly queriedAt: number;
}

/** Time window for filtering sessions by age. */
export type TimeRange = '24h' | '7d' | '30d' | 'all';

const maxHotFiles = 20;
const maxErrors = 30;
const timeRangeMs: Record<string, number> = { '24h': 86400000, '7d': 604800000, '30d': 2592000000 };

/** Aggregate insights across all session metadata files. */
export async function aggregateInsights(timeRange: TimeRange = 'all'): Promise<CrossSessionInsights> {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) { return { hotFiles: [], recurringErrors: [], sessionCount: 0, platforms: [], sdkVersions: [], queriedAt: Date.now() }; }
    const logDir = getLogDirectoryUri(folder);
    const entries = await listMetaFiles(logDir);
    const metas = await Promise.all(entries.map(e => loadMeta(logDir, e)));
    const valid = metas.filter((m): m is LoadedMeta => m !== undefined);
    const filtered = filterByTime(valid, timeRange);
    const envStats = buildEnvironmentStats(filtered);
    return {
        hotFiles: buildHotFiles(filtered),
        recurringErrors: buildRecurringErrors(filtered),
        sessionCount: filtered.length,
        ...envStats,
        queriedAt: Date.now(),
    };
}

interface LoadedMeta { readonly filename: string; readonly meta: SessionMeta }

function parseSessionDate(filename: string): number {
    const m = filename.match(/^(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})/);
    if (!m) { return 0; }
    return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]).getTime();
}

function filterByTime(metas: readonly LoadedMeta[], range: TimeRange): readonly LoadedMeta[] {
    if (range === 'all') { return metas; }
    const cutoff = Date.now() - (timeRangeMs[range] ?? 0);
    return metas.filter(m => parseSessionDate(m.filename) >= cutoff);
}

const maxScanDepth = 10;

async function listMetaFiles(logDir: vscode.Uri): Promise<string[]> {
    const { includeSubfolders } = getConfig();
    return collectMetaFiles(logDir, includeSubfolders ? maxScanDepth : 0, '');
}

async function collectMetaFiles(dir: vscode.Uri, depth: number, prefix: string): Promise<string[]> {
    let entries: [string, vscode.FileType][];
    try { entries = await vscode.workspace.fs.readDirectory(dir); } catch { return []; }
    const results: string[] = [];
    for (const [name, type] of entries) {
        const rel = prefix ? `${prefix}/${name}` : name;
        if (type === vscode.FileType.File && name.endsWith('.meta.json')) { results.push(rel); }
        // Skip dotfiles (.git, .vscode, etc.)
        else if (depth > 0 && type === vscode.FileType.Directory && !name.startsWith('.')) {
            results.push(...await collectMetaFiles(vscode.Uri.joinPath(dir, name), depth - 1, rel));
        }
    }
    return results;
}

async function loadMeta(logDir: vscode.Uri, filename: string): Promise<LoadedMeta | undefined> {
    try {
        const uri = vscode.Uri.joinPath(logDir, filename);
        const data = await vscode.workspace.fs.readFile(uri);
        const meta = JSON.parse(Buffer.from(data).toString('utf-8')) as SessionMeta;
        const sessionFilename = filename.replace(/\.meta\.json$/, '');
        return { filename: sessionFilename, meta };
    } catch { return undefined; }
}

function buildHotFiles(metas: readonly LoadedMeta[]): HotFile[] {
    const fileMap = new Map<string, { sessions: { filename: string; uri: string }[] }>();
    for (const { filename, meta } of metas) {
        for (const tag of meta.correlationTags ?? []) {
            if (!tag.startsWith('file:')) { continue; }
            const name = tag.slice(5);
            let entry = fileMap.get(name);
            if (!entry) { entry = { sessions: [] }; fileMap.set(name, entry); }
            entry.sessions.push({ filename, uri: '' });
        }
    }
    return [...fileMap.entries()]
        .map(([name, { sessions }]) => ({ filename: name, sessionCount: sessions.length, sessions }))
        .sort((a, b) => b.sessionCount - a.sessionCount)
        .slice(0, maxHotFiles);
}

type ErrorAccum = {
    n: string; e: string; total: number;
    timeline: { session: string; count: number }[];
    firstVer?: string; lastVer?: string;
    cat?: CrashCategory;
};

function buildRecurringErrors(metas: readonly LoadedMeta[]): RecurringError[] {
    const errorMap = new Map<string, ErrorAccum>();
    for (const { filename, meta } of metas) {
        const ver = meta.appVersion;
        for (const fp of meta.fingerprints ?? []) { accumulateFingerprint(fp, filename, errorMap, ver); }
    }
    return [...errorMap.entries()]
        .map(([hash, { n, e, total, timeline, firstVer, lastVer, cat }]) => ({
            hash, normalizedText: n, exampleLine: e,
            sessionCount: timeline.length, totalOccurrences: total,
            firstSeen: timeline[0].session, lastSeen: timeline[timeline.length - 1].session,
            firstSeenVersion: firstVer, lastSeenVersion: lastVer,
            category: cat, timeline,
        }))
        .sort((a, b) => (b.sessionCount * b.totalOccurrences) - (a.sessionCount * a.totalOccurrences))
        .slice(0, maxErrors);
}

function accumulateFingerprint(fp: FingerprintEntry, filename: string, errorMap: Map<string, ErrorAccum>, version?: string): void {
    const existing = errorMap.get(fp.h);
    if (existing) {
        existing.total += fp.c;
        if (!existing.timeline.some(t => t.session === filename)) { existing.timeline.push({ session: filename, count: fp.c }); }
        if (version) { existing.lastVer = version; }
    } else {
        errorMap.set(fp.h, {
            n: fp.n, e: fp.e, total: fp.c,
            timeline: [{ session: filename, count: fp.c }],
            firstVer: version, lastVer: version, cat: fp.cat,
        });
    }
}

const platformTagRe = /^(?:platform|os|device|runtime)$/i;
const sdkTagRe = /^(?:sdk|flutter|dart|node|python|java|go)/i;

function buildEnvironmentStats(metas: readonly LoadedMeta[]): { platforms: EnvironmentStat[]; sdkVersions: EnvironmentStat[] } {
    const platformMap = new Map<string, number>();
    const sdkMap = new Map<string, number>();
    for (const { meta } of metas) {
        for (const tag of meta.autoTags ?? []) {
            const lower = tag.toLowerCase();
            if (platformTagRe.test(lower.split(':')[0] ?? '')) { incr(platformMap, tag); }
            else if (sdkTagRe.test(lower.split(':')[0] ?? '') || sdkTagRe.test(lower)) { incr(sdkMap, tag); }
        }
        for (const tag of meta.tags ?? []) {
            const lower = tag.toLowerCase();
            if (lower.includes('android') || lower.includes('ios') || lower.includes('web') || lower.includes('linux') || lower.includes('macos') || lower.includes('windows')) { incr(platformMap, tag); }
        }
    }
    return { platforms: toStats(platformMap), sdkVersions: toStats(sdkMap) };
}

function incr(map: Map<string, number>, key: string): void { map.set(key, (map.get(key) ?? 0) + 1); }

function toStats(map: Map<string, number>): EnvironmentStat[] {
    return [...map.entries()].map(([value, sessionCount]) => ({ value, sessionCount })).sort((a, b) => b.sessionCount - a.sessionCount).slice(0, 10);
}

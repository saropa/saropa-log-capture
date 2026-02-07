/**
 * Cross-session aggregator: read all sidecar metadata files and build
 * aggregated insights — hot files and recurring error patterns.
 */

import * as vscode from 'vscode';
import { getLogDirectoryUri } from './config';
import type { SessionMeta } from './session-metadata';
import type { FingerprintEntry } from './error-fingerprint';

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
}

/** Aggregated cross-session insights. */
export interface CrossSessionInsights {
    readonly hotFiles: readonly HotFile[];
    readonly recurringErrors: readonly RecurringError[];
    readonly sessionCount: number;
}

const maxHotFiles = 20;
const maxErrors = 30;

/** Aggregate insights across all session metadata files. */
export async function aggregateInsights(): Promise<CrossSessionInsights> {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) { return { hotFiles: [], recurringErrors: [], sessionCount: 0 }; }
    const logDir = getLogDirectoryUri(folder);
    const entries = await listMetaFiles(logDir);
    const metas = await Promise.all(entries.map(e => loadMeta(logDir, e)));
    const valid = metas.filter((m): m is LoadedMeta => m !== undefined);
    return {
        hotFiles: buildHotFiles(valid),
        recurringErrors: buildRecurringErrors(valid),
        sessionCount: valid.length,
    };
}

interface LoadedMeta { readonly filename: string; readonly meta: SessionMeta }

async function listMetaFiles(logDir: vscode.Uri): Promise<string[]> {
    try {
        const all = await vscode.workspace.fs.readDirectory(logDir);
        return all.filter(([n, t]) => t === vscode.FileType.File && n.endsWith('.meta.json')).map(([n]) => n);
    } catch { return []; }
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

function buildRecurringErrors(metas: readonly LoadedMeta[]): RecurringError[] {
    const errorMap = new Map<string, { n: string; e: string; total: number; sessions: string[] }>();
    for (const { filename, meta } of metas) {
        for (const fp of meta.fingerprints ?? []) { accumulateFingerprint(fp, filename, errorMap); }
    }
    return [...errorMap.entries()]
        .map(([hash, { n, e, total, sessions }]) => ({
            hash, normalizedText: n, exampleLine: e,
            sessionCount: sessions.length, totalOccurrences: total,
            firstSeen: sessions[0], lastSeen: sessions[sessions.length - 1],
        }))
        .sort((a, b) => b.sessionCount - a.sessionCount || b.totalOccurrences - a.totalOccurrences)
        .slice(0, maxErrors);
}

function accumulateFingerprint(
    fp: FingerprintEntry, filename: string,
    errorMap: Map<string, { n: string; e: string; total: number; sessions: string[] }>,
): void {
    const existing = errorMap.get(fp.h);
    if (existing) {
        existing.total += fp.c;
        if (!existing.sessions.includes(filename)) { existing.sessions.push(filename); }
    } else {
        errorMap.set(fp.h, { n: fp.n, e: fp.e, total: fp.c, sessions: [filename] });
    }
}

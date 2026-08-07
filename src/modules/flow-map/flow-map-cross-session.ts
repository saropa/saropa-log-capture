/**
 * Captures of the same screen in OTHER sessions (plan direction 2 — cross-session comparison).
 *
 * The flow map's lightbox can already compare two captures of one screen within one session. The
 * question a reader actually arrives with is usually older than that — "did this screen regress
 * since yesterday's build" — and the join that answers it is the one `joinShotsToScreens` already
 * does, run against a different log.
 *
 * Deliberately lazy: listing candidate sessions is cheap (a directory read plus a `stat`), but
 * resolving one costs a full log read and parse, so that only happens when the reader picks a
 * session. A report that is never compared pays for the listing alone.
 */

import * as vscode from 'vscode';
import { parseLog } from './flow-map-log-parser';
import { joinShotsToScreens, screenKeyOf, type FlowShot, type ShotWithSource } from './flow-map-screenshots';
import { stripAnsi } from './flow-map-format';
import { readScreenshotSidecar, screenshotDirUri, screenshotSidecarUri } from '../screenshot/screenshot-store';

/**
 * How many other sessions the compare selector offers. Every one of these opens a `localResourceRoot`
 * and shows in a dropdown, so this is a bound on both the panel's security surface and the reader's
 * choice fatigue — not a limit on how much history exists.
 */
export const MAX_COMPARE_SESSIONS = 8;

/** One other session a screen can be compared against. */
export interface CompareSession {
    /** Absolute path of that session's log — the identity the webview sends back on a pick. */
    readonly logFsPath: string;
    /** File name without extension, which is what the picker shows (logs are named by timestamp). */
    readonly label: string;
    /** Newest capture in that session, for ordering most-recent-first. */
    readonly lastCaptureMs: number;
}

/** PNG names the store generates; anything else is refused before it reaches `Uri.joinPath`. */
const SAFE_SHOT_FILE = /^[\w-]+\.png$/;

/** `foo.log` → `foo`, the label the picker shows. */
function labelOf(logFsPath: string): string {
    return (logFsPath.split(/[\\/]/).pop() ?? logFsPath).replace(/\.log$/i, '');
}

/** True when this log has a screenshot sidecar — i.e. there is anything to compare against. */
async function hasCaptures(logFsPath: string): Promise<boolean> {
    try {
        await vscode.workspace.fs.stat(screenshotSidecarUri(logFsPath));
        return true;
    } catch {
        return false;
    }
}

/**
 * Other logs beside `logUri` that carry captures, newest first, capped at `MAX_COMPARE_SESSIONS`.
 * Ordering is by the log's own name because these files are timestamp-named (`YYYYMMDD_HHMMSS_…`),
 * so a lexical sort IS a chronological one and costs no extra `stat` per candidate.
 */
export async function findCompareSessions(logUri: vscode.Uri): Promise<CompareSession[]> {
    const dir = vscode.Uri.joinPath(logUri, '..');
    let entries: [string, vscode.FileType][];
    try {
        entries = await vscode.workspace.fs.readDirectory(dir);
    } catch {
        return [];
    }
    const self = logUri.fsPath;
    const logs = entries
        .filter(([name, type]) => type === vscode.FileType.File && /\.log$/i.test(name))
        .map(([name]) => vscode.Uri.joinPath(dir, name).fsPath)
        .filter(p => p !== self)
        .sort()
        .reverse();
    const out: CompareSession[] = [];
    for (const logFsPath of logs) {
        if (out.length >= MAX_COMPARE_SESSIONS) { break; }
        if (await hasCaptures(logFsPath)) {
            out.push({ logFsPath, label: labelOf(logFsPath), lastCaptureMs: 0 });
        }
    }
    return out;
}

/** Resolve one sidecar entry to a renderable source, or undefined when the PNG is unusable. */
async function sourceFor(logFsPath: string, file: string): Promise<{ src: string; path: string } | undefined> {
    if (!SAFE_SHOT_FILE.test(file)) { return undefined; }
    const uri = vscode.Uri.joinPath(screenshotDirUri(logFsPath), file);
    try {
        await vscode.workspace.fs.stat(uri);
        return { src: uri.toString(), path: uri.fsPath };
    } catch {
        return undefined;
    }
}

/**
 * That session's captures, joined to the screens they were taken on. Reads and parses the log
 * because a sidecar entry knows its log LINE, not its screen — the screen comes from the last
 * node-creating event before it, which only the parser can supply.
 */
export async function loadSessionShots(logFsPath: string): Promise<FlowShot[]> {
    const entries = await readScreenshotSidecar(logFsPath);
    if (entries.length === 0) { return []; }
    const withSources: ShotWithSource[] = [];
    for (const entry of entries) {
        const found = await sourceFor(logFsPath, entry.file);
        if (found) { withSources.push({ ...entry, ...found }); }
    }
    if (withSources.length === 0) { return []; }
    const bytes = await vscode.workspace.fs.readFile(vscode.Uri.file(logFsPath));
    const parsed = parseLog(Buffer.from(bytes).toString('utf-8').split(/\r?\n/));
    return joinShotsToScreens(withSources, parsed.events);
}

/**
 * That session's captures OF ONE SCREEN, matched by the same normalized key the diagram nodes and
 * the gallery figures use. Comparing by key rather than by raw label is what lets two sessions agree
 * on "Emergency Dashboard" when one of them logged it with different spacing or casing.
 */
export function shotsForScreen(shots: readonly FlowShot[], screenKey: string): FlowShot[] {
    if (!screenKey) { return []; }
    return shots.filter(s => s.screenLabel && screenKeyOf(stripAnsi(s.screenLabel)) === screenKey);
}

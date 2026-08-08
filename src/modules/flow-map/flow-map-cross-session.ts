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

/**
 * A candidate log this big is not read for a comparison. Picking a session parses a whole log
 * synchronously in the extension host, and the reader can pick repeatedly from a dropdown — an
 * unbounded read behind a repeatable control is how a UI stops responding.
 */
const MAX_COMPARE_LOG_BYTES = 32 * 1024 * 1024;

/** One other session a screen can be compared against. */
export interface CompareSession {
    /** Absolute path of that session's log — the identity the webview sends back on a pick. */
    readonly logFsPath: string;
    /** File name without extension, which is what the picker shows (logs are named by timestamp). */
    readonly label: string;
    /** When that session last captured, for ordering most-recent-first. */
    readonly lastCaptureMs: number;
}

/** PNG names the store generates; anything else is refused before it reaches `Uri.joinPath`. */
const SAFE_SHOT_FILE = /^[\w-]+\.png$/;

/** `foo.log` → `foo`, the label the picker shows. */
function labelOf(logFsPath: string): string {
    return (logFsPath.split(/[\\/]/).pop() ?? logFsPath).replace(/\.log$/i, '');
}

/**
 * When this log last captured, or undefined when it never did. The sidecar's own mtime IS the last
 * capture time — the store rewrites it whole on every save.
 */
async function lastCaptureAt(logFsPath: string): Promise<number | undefined> {
    try {
        return (await vscode.workspace.fs.stat(screenshotSidecarUri(logFsPath))).mtime;
    } catch {
        return undefined;
    }
}

/**
 * Other logs beside `logUri` that carry captures, most recently captured first, capped at
 * `MAX_COMPARE_SESSIONS`.
 *
 * Ordered by the sidecar's mtime rather than by filename. Logs are usually timestamp-named, so a
 * lexical sort is usually chronological — but "usually" silently misorders a renamed or copied log
 * with no signal to the reader, and the `stat` that answers it is one this scan already performs to
 * decide whether the session has captures at all. Same cost, no assumption.
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
        .filter(p => p !== self);
    const found: CompareSession[] = [];
    for (const logFsPath of logs) {
        const mtime = await lastCaptureAt(logFsPath);
        if (mtime !== undefined) {
            found.push({ logFsPath, label: labelOf(logFsPath), lastCaptureMs: mtime });
        }
    }
    // Sort AFTER collecting, not while scanning: the newest sessions are not necessarily the ones
    // the directory listing reaches first, so an early cap would drop the very sessions worth showing.
    return found.sort((a, b) => b.lastCaptureMs - a.lastCaptureMs).slice(0, MAX_COMPARE_SESSIONS);
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
    const logUri = vscode.Uri.file(logFsPath);
    // Checked before the read, not after: the point is to never pull the file into memory at all.
    // An over-size candidate returns empty, which the picker reports as "no capture of this screen"
    // — imprecise, but the honest alternative (freezing the panel) is worse.
    const stat = await vscode.workspace.fs.stat(logUri);
    if (stat.size > MAX_COMPARE_LOG_BYTES) { return []; }
    const bytes = await vscode.workspace.fs.readFile(logUri);
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

/**
 * Codebase integration for crash stacks (plan 054 WOW): for each app stack frame that resolves to a
 * file in the workspace, fetch the actual source line and `git blame` (last author · when · short SHA).
 *
 * This ties a crash frame to the code and who last touched it — something the Android Studio panel and
 * the Play Console web UI can't do, because only the editor has the working tree + git.
 */

import * as path from 'path';
import { execFile } from 'node:child_process';
import * as vscode from 'vscode';
import { extractSourceReference } from '../source/source-linker';
import { isFrameworkFrame } from '../analysis/stack-parser';
import type { CrashlyticsEventDetail } from './crashlytics-types';

/** Source/git context for one frame, keyed by the same file/line the stack renderer emits. */
export interface FrameContext {
    readonly file: string;
    readonly line: number;
    readonly code?: string;
    readonly blame?: string;
}

// Bound the work: git blame is a subprocess per frame, so cap how many frames we enrich.
const MAX_FRAMES = 8;

/** App frames (skipping framework) with a resolvable source ref, de-duped, capped. */
function appFrameRefs(event: CrashlyticsEventDetail, wsPath: string): { file: string; line: number }[] {
    const frames = event.crashThread?.frames ?? [];
    const seen = new Set<string>();
    const refs: { file: string; line: number }[] = [];
    for (const frame of frames) {
        if (isFrameworkFrame(frame.text, wsPath)) { continue; }
        const ref = extractSourceReference(frame.text);
        if (!ref || ref.line === undefined) { continue; }
        const key = `${ref.filePath}:${ref.line}`;
        if (seen.has(key)) { continue; }
        seen.add(key);
        refs.push({ file: ref.filePath, line: ref.line });
        if (refs.length >= MAX_FRAMES) { break; }
    }
    return refs;
}

async function uriExists(uri: vscode.Uri): Promise<boolean> {
    try { await vscode.workspace.fs.stat(uri); return true; } catch { return false; }
}

/** Resolve a frame's file to a workspace URI (absolute, workspace-relative, then basename search). */
export async function resolveFile(file: string, wsUri: vscode.Uri): Promise<vscode.Uri | undefined> {
    if (path.isAbsolute(file)) { const u = vscode.Uri.file(file); return (await uriExists(u)) ? u : undefined; }
    const rel = vscode.Uri.joinPath(wsUri, file);
    if (await uriExists(rel)) { return rel; }
    const base = file.split(/[\\/]/).pop();
    if (!base) { return undefined; }
    const found = await vscode.workspace.findFiles(`**/${base}`, '**/node_modules/**', 1);
    return found[0];
}

/** The trimmed source line at `line` (1-based), or undefined. */
async function readLine(uri: vscode.Uri, line: number): Promise<string | undefined> {
    try {
        const raw = await vscode.workspace.fs.readFile(uri);
        const text = Buffer.from(raw).toString('utf-8').split('\n')[line - 1];
        return text !== undefined ? text.trim().slice(0, 200) : undefined;
    } catch { return undefined; }
}

/** Compact relative time ("3d ago", "5h ago", "just now") from an epoch-ms timestamp. */
function relativeTime(ms: number): string {
    const sec = Math.max(0, Math.floor((Date.now() - ms) / 1000));
    if (sec < 60) { return 'just now'; }
    const units: [number, string][] = [[86400, 'd'], [3600, 'h'], [60, 'm']];
    for (const [size, label] of units) { if (sec >= size) { return `${Math.floor(sec / size)}${label} ago`; } }
    return 'just now';
}

/** Parse `git blame --porcelain` for one line into "author · when · sha". */
function parseBlame(porcelain: string): string | undefined {
    const lines = porcelain.split('\n');
    const sha = lines[0]?.split(' ')[0]?.slice(0, 7);
    if (!sha || /^0+$/.test(sha)) { return undefined; }
    let author = '';
    let when = 0;
    for (const line of lines) {
        if (line.startsWith('author ')) { author = line.slice(7); }
        else if (line.startsWith('author-time ')) { when = Number(line.slice(12)) * 1000; }
    }
    return [author, when ? relativeTime(when) : '', sha].filter(Boolean).join(' · ');
}

/** `git blame` one line; undefined if not tracked / git unavailable. Never throws. */
function gitBlame(cwd: string, filePath: string, line: number): Promise<string | undefined> {
    return new Promise((resolve) => {
        execFile('git', ['blame', '-L', `${line},${line}`, '--porcelain', '--', filePath], { cwd, timeout: 5000 }, (err, stdout) => {
            resolve(err || !stdout ? undefined : parseBlame(stdout));
        });
    });
}

/**
 * Resolve source line + git blame for an event's app frames. Never throws; returns only the frames
 * that resolved to something useful. Keyed by the original file/line so the webview can match frames.
 */
export async function getFrameContexts(event: CrashlyticsEventDetail): Promise<FrameContext[]> {
    const ws = vscode.workspace.workspaceFolders?.[0];
    if (!ws) { return []; }
    const out: FrameContext[] = [];
    for (const ref of appFrameRefs(event, ws.uri.fsPath)) {
        const uri = await resolveFile(ref.file, ws.uri);
        if (!uri) { continue; }
        const code = await readLine(uri, ref.line);
        const blame = await gitBlame(ws.uri.fsPath, uri.fsPath, ref.line);
        if (code || blame) { out.push({ file: ref.file, line: ref.line, code, blame }); }
    }
    return out;
}

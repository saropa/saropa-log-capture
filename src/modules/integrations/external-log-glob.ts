/**
 * Glob / "latest file" resolution for external-log paths. A configured path may
 * use `*`/`?` wildcards in its FINAL segment (e.g. `logs/*.log`); the most
 * recently modified match is chosen. The directory portion is literal. Pure
 * matching (globToRegExp, pickLatestMatch) is separated from fs access so it can
 * be unit-tested without a real directory.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { WorkspaceFolder } from 'vscode';
import { resolveWorkspaceFileUri } from './workspace-path';

/** True when the final path segment contains a glob wildcard. */
export function isGlobPattern(p: string): boolean {
    const base = p.split(/[/\\]/g).filter(Boolean).pop() ?? '';
    return /[*?[]/.test(base);
}

/** Convert a simple filename glob (`*`, `?`) to an anchored RegExp. */
export function globToRegExp(pattern: string): RegExp {
    const escaped = pattern.replace(/[.+^${}()|\\]/g, '\\$&');
    const body = escaped.replace(/\*/g, '.*').replace(/\?/g, '.');
    return new RegExp(`^${body}$`);
}

/** A directory entry candidate: filename plus its modified time (ms). */
export interface GlobCandidate {
    readonly name: string;
    readonly mtimeMs: number;
}

/** Pick the most recently modified filename matching the glob, or undefined. */
export function pickLatestMatch(candidates: readonly GlobCandidate[], pattern: string): string | undefined {
    const re = globToRegExp(pattern);
    let best: GlobCandidate | undefined;
    for (const c of candidates) {
        if (!re.test(c.name)) { continue; }
        if (!best || c.mtimeMs > best.mtimeMs) { best = c; }
    }
    return best?.name;
}

/** Stat one directory entry into a candidate, or undefined if not a readable file. */
function fileCandidate(dirPath: string, name: string): GlobCandidate | undefined {
    try {
        const st = fs.statSync(path.join(dirPath, name));
        return st.isFile() ? { name, mtimeMs: st.mtimeMs } : undefined;
    } catch {
        return undefined;
    }
}

/** Read a directory's regular-file candidates with mtimes; [] on any error. */
function listFileCandidates(dirPath: string): GlobCandidate[] {
    try {
        const out: GlobCandidate[] = [];
        for (const name of fs.readdirSync(dirPath)) {
            const candidate = fileCandidate(dirPath, name);
            if (candidate) { out.push(candidate); }
        }
        return out;
    } catch {
        return [];
    }
}

/**
 * Resolve a configured external-log path to an absolute file path. Non-glob
 * paths resolve against the workspace as before. Glob paths resolve the literal
 * directory, then pick the latest-modified matching file. Returns undefined when
 * a glob currently has no match (a tail worker may still watch for it to appear).
 */
export function resolveExternalLogPath(workspaceFolder: WorkspaceFolder, relPath: string): string | undefined {
    if (!isGlobPattern(relPath)) {
        return resolveWorkspaceFileUri(workspaceFolder, relPath).fsPath;
    }
    const segments = relPath.split(/[/\\]/g).filter(Boolean);
    const pattern = segments.pop() ?? '';
    const dirRel = segments.join('/');
    const dirPath = dirRel
        ? resolveWorkspaceFileUri(workspaceFolder, dirRel).fsPath
        : resolveWorkspaceFileUri(workspaceFolder, '.').fsPath;
    const match = pickLatestMatch(listFileCandidates(dirPath), pattern);
    return match ? path.join(dirPath, match) : undefined;
}

/**
 * Discovers Claude Code JSONL session files for the current workspace.
 *
 * Maps a workspace folder path to a project slug, then scans
 * ~/.claude/projects/<slug>/ for .jsonl files, returning the most
 * recently modified one (the active AI session).
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

/** Result of resolving an AI session for a workspace. */
export interface AiSessionInfo {
    readonly filePath: string;
    readonly sessionId: string;
    readonly mtimeMs: number;
}

/**
 * Convert a workspace folder path to a Claude Code project slug.
 * Example: `d:\src\saropa-log-capture` → `d--src-saropa-log-capture`
 */
export function workspaceToProjectSlug(workspacePath: string): string {
    return workspacePath
        .replace(/:/g, '-')
        .replace(/[\\/]/g, '-')
        .replace(/^-+/, '')
        .replace(/-+$/, '')
        .toLowerCase();
}

/** Get the Claude projects directory (~/.claude/projects). */
export function getClaudeProjectsDir(): string {
    return path.join(os.homedir(), '.claude', 'projects');
}

/** Get the project-specific log directory for a workspace path. */
export function getProjectLogDir(workspacePath: string): string {
    return path.join(getClaudeProjectsDir(), workspaceToProjectSlug(workspacePath));
}

/**
 * Find the most recently modified JSONL file in the project log directory.
 * Returns null if no matching directory or files exist.
 */
export async function resolveActiveSession(workspacePath: string): Promise<AiSessionInfo | null> {
    const logDir = getProjectLogDir(workspacePath);
    let entries: fs.Dirent[];
    try { entries = await fs.promises.readdir(logDir, { withFileTypes: true }); }
    catch { return null; }

    let best: AiSessionInfo | null = null;
    for (const entry of entries) {
        if (!entry.isFile() || !entry.name.endsWith('.jsonl')) { continue; }
        const filePath = path.join(logDir, entry.name);
        try {
            const stat = await fs.promises.stat(filePath);
            if (!best || stat.mtimeMs > best.mtimeMs) {
                best = {
                    filePath,
                    sessionId: entry.name.replace('.jsonl', ''),
                    mtimeMs: stat.mtimeMs,
                };
            }
        } catch { /* skip inaccessible files */ }
    }
    return best;
}

/** Check whether a Claude projects directory exists for the given workspace. */
export async function hasClaudeProject(workspacePath: string): Promise<boolean> {
    const logDir = getProjectLogDir(workspacePath);
    try {
        const stat = await fs.promises.stat(logDir);
        return stat.isDirectory();
    } catch { return false; }
}

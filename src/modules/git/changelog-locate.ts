/**
 * Locate the workspace CHANGELOG(s) and compute "releases since version X" (plan 055 Stage 1).
 *
 * Split from the pure parser ([changelog.ts](changelog.ts)) because this layer touches the VS Code
 * filesystem and reads user config — the parser stays IO-free so it can be unit tested with
 * `node --test`. The search globs are user-configurable (`saropaLogCapture.changelogPaths`) so
 * monorepos and projects that keep their changelog under `docs/` are not stuck with a root-only scan.
 */

import * as vscode from 'vscode';
import { getConfig } from '../config/config';
import { parseChangelogVersions, changelogSince, type ChangelogVersion } from './changelog';

const EXCLUDE = '**/node_modules/**';
// Per-glob result cap, then an overall cap: enough to disambiguate root vs docs vs archives without
// letting a greedy `**/CHANGELOG*` glob fan out across a large monorepo.
const PER_GLOB_MAX = 10;
const TOTAL_MAX = 25;

/**
 * Compare two changelog URIs for "which is the canonical one". Prefer the shortest full path, which
 * favors a root `CHANGELOG.md` over `docs/CHANGELOG.md` and a plain `CHANGELOG.md` over
 * `CHANGELOG.archive.md`. Stable for `Array.sort`.
 */
function byCanonical(a: vscode.Uri, b: vscode.Uri): number {
    return a.path.length - b.path.length || a.path.localeCompare(b.path);
}

/**
 * All changelog files matching the configured globs, de-duplicated and ordered most-canonical first.
 * Empty when no glob matches (no changelog, untracked project) — callers degrade silently.
 */
export async function findChangelogCandidates(): Promise<vscode.Uri[]> {
    if (!vscode.workspace.workspaceFolders?.[0]) { return []; }
    const globs = getConfig().changelogPaths;
    const seen = new Map<string, vscode.Uri>();
    for (const glob of globs) {
        const matches = await vscode.workspace.findFiles(glob, EXCLUDE, PER_GLOB_MAX);
        for (const uri of matches) {
            if (!seen.has(uri.toString())) { seen.set(uri.toString(), uri); }
            if (seen.size >= TOTAL_MAX) { break; }
        }
        if (seen.size >= TOTAL_MAX) { break; }
    }
    return [...seen.values()].sort(byCanonical);
}

/** The single most-canonical changelog (root, plainest name), or undefined when none match. */
export async function findRootChangelog(): Promise<vscode.Uri | undefined> {
    return (await findChangelogCandidates())[0];
}

/**
 * Newer releases listed after `affected` in the canonical changelog; [] when the file is absent, the
 * version isn't given, or the version isn't found. An empty result NEVER means "nothing changed" —
 * the `changelogSince.found` honesty rule lives in the pure parser and callers must respect it.
 */
export async function changelogSinceAffected(affected?: string, limit = 8): Promise<ChangelogVersion[]> {
    if (!affected) { return []; }
    const uri = await findRootChangelog();
    if (!uri) { return []; }
    try {
        const text = Buffer.from(await vscode.workspace.fs.readFile(uri)).toString('utf-8');
        return changelogSince(parseChangelogVersions(text), affected).since.slice(0, limit);
    } catch {
        return [];
    }
}

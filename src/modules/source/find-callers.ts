/**
 * Caller discovery (cross-session-analysis idea #4) — host side.
 *
 * Scans the workspace for source files that import a given target file, so a bug report can show
 * "who calls the crashing file". Uses import-extractor to read each candidate's imports, then the
 * pure caller-graph matcher to decide whether any points back at the target.
 *
 * Bounded and best-effort: the candidate search is capped (a workspace can hold tens of thousands
 * of files), results are capped, and the target itself is excluded. Any unreadable file is
 * skipped rather than failing the scan.
 */

import * as vscode from 'vscode';
import { extractImports } from './import-extractor';
import { findImportOfTarget } from './caller-graph';

/** Source extensions worth scanning for imports — mirrors import-extractor's language map. */
const SOURCE_GLOB = '**/*.{ts,tsx,js,jsx,mjs,dart,py,go,java,kt,kts,rs,c,cpp,h,hpp,swift,cs}';

/** Cap on files opened — a reverse-import scan must not walk an entire monorepo. */
const MAX_CANDIDATES = 400;

/** Cap on reported callers — enough to show the dependents without flooding the report. */
const MAX_RESULTS = 15;

/** A file that imports the target, with the import statement that references it. */
export interface CallerRef {
    readonly relativePath: string;
    readonly module: string;
}

/**
 * Find workspace files that import `targetUri`. Returns up to MAX_RESULTS callers. Excludes the
 * target file itself and respects VS Code's default exclude globs (node_modules, etc.).
 */
export async function findCallers(targetUri: vscode.Uri): Promise<CallerRef[]> {
    const targetFilename = targetUri.fsPath.split(/[/\\]/).pop() ?? '';
    if (!targetFilename) { return []; }

    const candidates = await vscode.workspace
        .findFiles(SOURCE_GLOB, undefined, MAX_CANDIDATES)
        .then((uris) => uris, () => [] as vscode.Uri[]);

    const callers: CallerRef[] = [];
    for (const uri of candidates) {
        if (callers.length >= MAX_RESULTS) { break; }
        if (uri.fsPath === targetUri.fsPath) { continue; }
        const module = await importModuleReferencing(uri, targetFilename);
        if (module) {
            callers.push({ relativePath: vscode.workspace.asRelativePath(uri, false), module });
        }
    }
    return callers;
}

/** The import module in `uri` that references `targetFilename`, or undefined. Best-effort. */
async function importModuleReferencing(
    uri: vscode.Uri,
    targetFilename: string,
): Promise<string | undefined> {
    const results = await extractImports(uri).catch(() => undefined);
    if (!results) { return undefined; }
    // Only local imports can name a workspace file; package imports never resolve to the target.
    const localModules = results.imports.filter((e) => e.isLocal).map((e) => e.module);
    return findImportOfTarget(localModules, targetFilename);
}

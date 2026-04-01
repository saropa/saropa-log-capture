/**
 * Extension-side cache for VS Code diagnostics (errors, warnings from all linters).
 *
 * Lazily queries `vscode.languages.getDiagnostics(uri)` for files that appear in
 * log lines, caches per-file per-line summaries, and invalidates on
 * `onDidChangeDiagnostics`. Used by `buildPendingLineFromLineData` to attach
 * lint counts to `PendingLine` for webview badge rendering.
 */

import * as vscode from 'vscode';
import { extractSourceReference } from '../source/source-linker';

/** Counts of diagnostics at a specific line in a file. */
export interface LineDiagnosticSummary {
    readonly errors: number;
    readonly warnings: number;
}

/** Per-file diagnostic summary keyed by 1-based line number. */
type FileLineDiagnostics = ReadonlyMap<number, LineDiagnosticSummary>;

/**
 * Caches VS Code diagnostics per file, keyed by `fsPath`.
 * Only files that appear in log lines are ever queried.
 */
export class DiagnosticCache {
    /** fsPath → per-line diagnostic summary. */
    private readonly cache = new Map<string, FileLineDiagnostics>();

    /**
     * Register for diagnostic change events.
     * **Important:** Does NOT register its own `onDidChangeDiagnostics` listener.
     * The caller must use `setupDiagnosticListener()` (activation-listeners.ts)
     * which calls `getUpdatesForChangedUris()` — that method re-queries and
     * re-caches fresh data, avoiding a race with a separate invalidation listener.
     */
    activate(_subscriptions: vscode.Disposable[]): void {
        // Intentionally empty — kept as a lifecycle hook for future use
        // (e.g. registering disposables if the cache ever owns resources).
    }

    /**
     * Look up diagnostics for a log line. Tries DAP-provided sourcePath first,
     * then falls back to extracting file:line from the text.
     */
    lookupForLine(
        sourcePath: string | undefined,
        sourceLine: number | undefined,
        text: string,
    ): LineDiagnosticSummary | undefined {
        if (sourcePath && sourceLine) {
            return this.lookupLine(sourcePath, sourceLine);
        }
        return this.lookupFromText(text);
    }

    /**
     * Build update payload for files that changed and are already cached.
     * Returns map of fsPath → { lineNumber → { errors, warnings } } for
     * broadcasting to the webview as `updateLintData`.
     */
    getUpdatesForChangedUris(
        uris: readonly vscode.Uri[],
    ): Record<string, Record<number, LineDiagnosticSummary>> | undefined {
        const result: Record<string, Record<number, LineDiagnosticSummary>> = {};
        let hasUpdates = false;
        for (const uri of uris) {
            const key = uri.fsPath;
            if (!this.cache.has(key)) { continue; }
            const fresh = this.queryFile(uri);
            this.cacheResult(key, fresh);
            result[key] = mapToRecord(fresh);
            hasUpdates = true;
        }
        return hasUpdates ? result : undefined;
    }

    /** Clear the entire cache (e.g. on session clear). */
    clear(): void {
        this.cache.clear();
    }

    private lookupLine(fsPath: string, line: number): LineDiagnosticSummary | undefined {
        const fileMap = this.getOrQuery(fsPath);
        return fileMap?.get(line);
    }

    private lookupFromText(text: string): LineDiagnosticSummary | undefined {
        const ref = extractSourceReference(text);
        if (!ref) { return undefined; }
        const resolved = this.resolveToAbsolute(ref.filePath);
        if (!resolved) { return undefined; }
        return this.lookupLine(resolved, ref.line);
    }

    private getOrQuery(fsPath: string): FileLineDiagnostics | undefined {
        const cached = this.cache.get(fsPath);
        if (cached !== undefined) { return cached; }
        const uri = vscode.Uri.file(fsPath);
        const result = this.queryFile(uri);
        this.cacheResult(fsPath, result);
        return result.size > 0 ? result : undefined;
    }

    private queryFile(uri: vscode.Uri): Map<number, LineDiagnosticSummary> {
        const byLine = new Map<number, LineDiagnosticSummary>();
        try {
            const diags = vscode.languages.getDiagnostics(uri);
            for (const d of diags) {
                const line = d.range.start.line + 1; // convert to 1-based
                const prev = byLine.get(line);
                const isErr = d.severity === vscode.DiagnosticSeverity.Error;
                const isWarn = d.severity === vscode.DiagnosticSeverity.Warning;
                byLine.set(line, {
                    errors: (prev?.errors ?? 0) + (isErr ? 1 : 0),
                    warnings: (prev?.warnings ?? 0) + (isWarn ? 1 : 0),
                });
            }
        } catch {
            // Non-critical: file may not exist or URI may be invalid
        }
        return byLine;
    }

    private cacheResult(fsPath: string, result: FileLineDiagnostics): void {
        if (result.size > 0) {
            this.cache.set(fsPath, result);
        } else {
            this.cache.delete(fsPath);
        }
    }

    private resolveToAbsolute(filePath: string): string | undefined {
        if (isAbsolutePath(filePath)) { return filePath; }
        const folders = vscode.workspace.workspaceFolders;
        if (!folders || folders.length === 0) { return undefined; }
        return vscode.Uri.joinPath(folders[0].uri, filePath).fsPath;
    }
}

function isAbsolutePath(p: string): boolean {
    return p.startsWith('/') || /^[a-zA-Z]:[\\/]/.test(p);
}

function mapToRecord(
    map: ReadonlyMap<number, LineDiagnosticSummary>,
): Record<number, LineDiagnosticSummary> {
    const rec: Record<number, LineDiagnosticSummary> = {};
    for (const [k, v] of map) { rec[k] = v; }
    return rec;
}

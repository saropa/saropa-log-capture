/**
 * Enrich recurring signals with lint diagnostic context from referenced source files.
 *
 * When an error or warning signal's example line references a source file (e.g.
 * "Error at lib/main.dart:42"), this module queries VS Code diagnostics for that
 * file and line. If no diagnostics are cached, it opens the document to trigger
 * the language server (Dart analyzer + saropa_lints, ESLint, etc.) and waits
 * briefly for diagnostics to arrive.
 *
 * Example enriched detail:
 *   "Error: NPE at main.dart:42 | Lint: [dart] avoid_dynamic_calls (warning): Avoid using dynamic calls."
 */

import * as vscode from 'vscode';
import { extractSourceReference } from '../source/source-linker';
import type { RecurringSignalEntry } from '../misc/recurring-signal-builder';

const maxDiagsPerSignal = 3;
/** Max unique files to analyze per enrichment pass — prevents blocking on large signal lists. */
const maxFilesToAnalyze = 5;
/** How long to wait for the language server to produce diagnostics after opening a file. */
const analysisWaitMs = 2000;

/** Resolve a possibly-relative file path to an absolute path using the workspace root. */
function resolveToAbsolute(filePath: string): string | undefined {
    if (filePath.startsWith('/') || /^[a-zA-Z]:[\\/]/.test(filePath)) { return filePath; }
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) { return undefined; }
    return vscode.Uri.joinPath(folders[0].uri, filePath).fsPath;
}

/**
 * Format a single diagnostic with full detail — rule code, severity, source,
 * AND the actionable message text. This gives the user enough context to act
 * on the lint finding without opening the source file.
 */
function formatDiag(d: vscode.Diagnostic): string {
    const code = typeof d.code === 'object' ? String(d.code.value) : String(d.code ?? '');
    const sev = d.severity === vscode.DiagnosticSeverity.Error ? 'error'
        : d.severity === vscode.DiagnosticSeverity.Warning ? 'warning' : 'info';
    const src = d.source ?? '';
    const msg = d.message.length > 120 ? d.message.slice(0, 117) + '...' : d.message;
    const prefix = src ? `[${src}] ` : '';
    const codeStr = code ? `${code} (${sev})` : `(${sev})`;
    return `${prefix}${codeStr}: ${msg}`;
}

/** Read cached diagnostics for a file at a specific line. Returns formatted summary or undefined. */
function readDiagsForRef(uri: vscode.Uri, line: number): string | undefined {
    try {
        const diags = vscode.languages.getDiagnostics(uri);
        if (diags.length === 0) { return undefined; }
        // Sort by proximity to the referenced line — nearest first
        const sorted = [...diags].sort((a, b) =>
            Math.abs(a.range.start.line + 1 - line) - Math.abs(b.range.start.line + 1 - line));
        const formatted = sorted.slice(0, maxDiagsPerSignal).map(formatDiag);
        return 'Lint: ' + formatted.join(' | ');
    } catch {
        return undefined;
    }
}

/**
 * Trigger analysis for a file by opening it in the background.
 * Opening a TextDocument causes VS Code to notify the language server,
 * which runs all registered analyzers (Dart analyzer + saropa_lints rules,
 * ESLint, TypeScript, etc.) on that file. We then wait briefly for
 * diagnostics to arrive via onDidChangeDiagnostics.
 */
async function triggerAnalysisAndWait(uri: vscode.Uri): Promise<void> {
    try {
        // openTextDocument does NOT show the file in the editor — it just loads it
        // into memory and triggers the language server to analyze it
        await vscode.workspace.openTextDocument(uri);
        // Wait for the language server to produce diagnostics
        await new Promise<void>(resolve => {
            const timeout = setTimeout(resolve, analysisWaitMs);
            const listener = vscode.languages.onDidChangeDiagnostics(e => {
                // Check if our file is in the changed set
                if (e.uris.some(u => u.fsPath === uri.fsPath)) {
                    clearTimeout(timeout);
                    listener.dispose();
                    resolve();
                }
            });
            // Dispose listener on timeout to avoid leaks
            setTimeout(() => { listener.dispose(); }, analysisWaitMs + 100);
        });
    } catch {
        // Non-critical — file may not exist or language server may be unavailable
    }
}

/**
 * Enrich error and warning signals with lint diagnostics from referenced source files.
 * For files without cached diagnostics, triggers language server analysis (opens the
 * document) and waits up to 2s for results. This means saropa_lints rules, Dart
 * analyzer checks, ESLint, etc. all run on files referenced by error signals —
 * even if those files haven't been opened by the user.
 *
 * Caps file analysis at 5 unique files per pass to avoid blocking.
 */
export async function enrichSignalsWithLintContext(signals: RecurringSignalEntry[]): Promise<RecurringSignalEntry[]> {
    // First pass: collect unique file refs that need analysis
    const refsToAnalyze = new Map<string, vscode.Uri>();
    for (const signal of signals) {
        if (signal.kind !== 'error' && signal.kind !== 'warning') { continue; }
        const text = signal.detail ?? signal.label;
        if (!text) { continue; }
        const ref = extractSourceReference(text);
        if (!ref) { continue; }
        const absPath = resolveToAbsolute(ref.filePath);
        if (!absPath || refsToAnalyze.has(absPath)) { continue; }
        const uri = vscode.Uri.file(absPath);
        // Only trigger analysis for files that don't already have diagnostics cached
        const existing = vscode.languages.getDiagnostics(uri);
        if (existing.length === 0) { refsToAnalyze.set(absPath, uri); }
        if (refsToAnalyze.size >= maxFilesToAnalyze) { break; }
    }

    // Trigger analysis for uncached files in parallel
    if (refsToAnalyze.size > 0) {
        await Promise.all([...refsToAnalyze.values()].map(triggerAnalysisAndWait));
    }

    // Second pass: enrich signals with diagnostics (now including freshly analyzed files)
    return signals.map(signal => {
        if (signal.kind !== 'error' && signal.kind !== 'warning') { return signal; }
        const text = signal.detail ?? signal.label;
        if (!text) { return signal; }
        const ref = extractSourceReference(text);
        if (!ref) { return signal; }
        const absPath = resolveToAbsolute(ref.filePath);
        if (!absPath) { return signal; }
        const lintContext = readDiagsForRef(vscode.Uri.file(absPath), ref.line);
        if (!lintContext) { return signal; }
        return { ...signal, detail: (signal.detail ? signal.detail + ' | ' : '') + lintContext };
    });
}

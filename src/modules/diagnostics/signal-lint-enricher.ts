/**
 * Enrich recurring signals with lint diagnostic context from referenced source files.
 *
 * When an error or warning signal's example line references a source file, this module
 * queries VS Code diagnostics for that file. Additionally, it analyzes ALL source files
 * from the session's correlation tags (extracted from stack traces during finalization) —
 * so every file in the stack trace gets lint-checked, not just the top frame.
 *
 * For files not yet analyzed, opens the document to trigger the language server
 * (Dart analyzer + saropa_lints, ESLint, etc.) and waits briefly for diagnostics.
 */

import * as vscode from 'vscode';
import { extractSourceReference } from '../source/source-linker';
import type { RecurringSignalEntry } from '../misc/recurring-signal-builder';

const maxDiagsPerSignal = 3;
/** Max unique files to trigger analysis for per enrichment pass. */
const maxFilesToAnalyze = 10;
/** How long to wait for the language server to produce diagnostics after opening a file. */
const analysisWaitMs = 2000;

/** Resolve a possibly-relative file path to an absolute path using the workspace root. */
function resolveToAbsolute(filePath: string): string | undefined {
    if (filePath.startsWith('/') || /^[a-zA-Z]:[\\/]/.test(filePath)) { return filePath; }
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) { return undefined; }
    return vscode.Uri.joinPath(folders[0].uri, filePath).fsPath;
}

/** Format a single diagnostic with full detail — rule code, severity, source, message. */
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

/** Read cached diagnostics for a file at a specific line. */
function readDiagsForRef(uri: vscode.Uri, line: number): string | undefined {
    try {
        const diags = vscode.languages.getDiagnostics(uri);
        if (diags.length === 0) { return undefined; }
        const sorted = [...diags].sort((a, b) =>
            Math.abs(a.range.start.line + 1 - line) - Math.abs(b.range.start.line + 1 - line));
        return sorted.slice(0, maxDiagsPerSignal).map(formatDiag).join(' | ');
    } catch {
        return undefined;
    }
}

/** Read ALL diagnostics for a file (no line filter). Returns a summary string or undefined. */
function readAllDiagsForFile(uri: vscode.Uri): string | undefined {
    try {
        const diags = vscode.languages.getDiagnostics(uri);
        if (diags.length === 0) { return undefined; }
        // Prioritize errors over warnings, then by line number
        const sorted = [...diags]
            .sort((a, b) => (a.severity - b.severity) || (a.range.start.line - b.range.start.line));
        return sorted.slice(0, maxDiagsPerSignal).map(formatDiag).join(' | ');
    } catch {
        return undefined;
    }
}

/**
 * Trigger analysis for a file by opening it as a TextDocument.
 * This causes VS Code to notify the language server, which runs all registered
 * analyzers (Dart analyzer + saropa_lints rules, ESLint, etc.).
 */
async function triggerAnalysisAndWait(uri: vscode.Uri): Promise<void> {
    try {
        await vscode.workspace.openTextDocument(uri);
        await new Promise<void>(resolve => {
            const timeout = setTimeout(resolve, analysisWaitMs);
            const listener = vscode.languages.onDidChangeDiagnostics(e => {
                if (e.uris.some(u => u.fsPath === uri.fsPath)) {
                    clearTimeout(timeout);
                    listener.dispose();
                    resolve();
                }
            });
            setTimeout(() => { listener.dispose(); }, analysisWaitMs + 100);
        });
    } catch {
        // Non-critical — file may not exist or language server may be unavailable
    }
}

/**
 * Extract `file:` paths from correlation tags and resolve to absolute paths.
 * Correlation tags are in `file:lib/foo.dart` format — these represent all
 * source files referenced in the session's stack traces.
 */
function resolveCorrelationFiles(correlationTags: readonly string[]): Map<string, vscode.Uri> {
    const files = new Map<string, vscode.Uri>();
    for (const tag of correlationTags) {
        if (!tag.startsWith('file:')) { continue; }
        const relPath = tag.slice(5);
        const absPath = resolveToAbsolute(relPath);
        if (absPath && !files.has(absPath)) { files.set(absPath, vscode.Uri.file(absPath)); }
    }
    return files;
}

/**
 * Ensure diagnostics are available for all source files from the session's stack traces.
 * Opens unanalyzed files to trigger the language server (saropa_lints, Dart analyzer, etc.).
 */
async function analyzeSessionFiles(correlationTags: readonly string[]): Promise<void> {
    const allFiles = resolveCorrelationFiles(correlationTags);
    const toAnalyze: vscode.Uri[] = [];
    for (const [, uri] of allFiles) {
        if (toAnalyze.length >= maxFilesToAnalyze) { break; }
        const existing = vscode.languages.getDiagnostics(uri);
        if (existing.length === 0) { toAnalyze.push(uri); }
    }
    if (toAnalyze.length > 0) {
        await Promise.all(toAnalyze.map(triggerAnalysisAndWait));
    }
}

/**
 * Build a lint summary for a signal by checking:
 * 1. The specific file:line from the signal's example text (nearest diagnostics)
 * 2. All files from the session's correlation tags (any diagnostics in stack trace files)
 */
/** Try to read line-specific diagnostics from the signal's example text. */
function readPrimaryDiags(signal: RecurringSignalEntry): string | undefined {
    const text = signal.detail ?? signal.label;
    if (!text) { return undefined; }
    const ref = extractSourceReference(text);
    if (!ref) { return undefined; }
    const absPath = resolveToAbsolute(ref.filePath);
    if (!absPath) { return undefined; }
    return readDiagsForRef(vscode.Uri.file(absPath), ref.line);
}

function buildLintSummary(signal: RecurringSignalEntry, sessionFiles: Map<string, vscode.Uri>): string | undefined {
    const parts: string[] = [];
    // Primary: diagnostics at the specific file:line from the signal text
    const primary = readPrimaryDiags(signal);
    if (primary) { parts.push(primary); }
    // Secondary: diagnostics from other stack trace files (broader context)
    // Only add if we didn't already get enough from the primary file
    if (parts.length < maxDiagsPerSignal) {
        for (const [, uri] of sessionFiles) {
            if (parts.length >= maxDiagsPerSignal) { break; }
            const fileDiags = readAllDiagsForFile(uri);
            if (fileDiags && !parts.includes(fileDiags)) { parts.push(fileDiags); }
        }
    }
    return parts.length > 0 ? 'Lint: ' + parts.join(' | ') : undefined;
}

/**
 * Enrich error and warning signals with lint diagnostics from ALL source files
 * referenced in the session — not just the top frame, but every file in the stack trace.
 *
 * @param signals The recurring signal entries to enrich
 * @param correlationTags Session correlation tags (from SessionMeta.correlationTags) —
 *        these contain `file:lib/foo.dart` entries for every source file in stack traces.
 *        Pass empty array if not available.
 */
export async function enrichSignalsWithLintContext(
    signals: RecurringSignalEntry[],
    correlationTags: readonly string[],
): Promise<RecurringSignalEntry[]> {
    // Trigger analysis for stack trace files that haven't been analyzed yet
    await analyzeSessionFiles(correlationTags);
    const sessionFiles = resolveCorrelationFiles(correlationTags);

    return signals.map(signal => {
        if (signal.kind !== 'error' && signal.kind !== 'warning') { return signal; }
        const lintContext = buildLintSummary(signal, sessionFiles);
        if (!lintContext) { return signal; }
        return { ...signal, detail: (signal.detail ? signal.detail + ' | ' : '') + lintContext };
    });
}

/**
 * Enrich recurring signals with lint diagnostic context from referenced source files.
 *
 * When an error or warning signal's example line references a source file (e.g.
 * "Error at lib/main.dart:42"), this module queries VS Code diagnostics for that
 * file and line. If any diagnostics exist (from saropa_lints, Dart analyzer,
 * ESLint, etc.), a summary is appended to the signal's detail field so the user
 * sees correlated lint context alongside the runtime signal.
 *
 * Example enriched detail:
 *   "Error: NPE at main.dart:42 | Lint: avoid_dynamic_calls (warning, dart)"
 */

import * as vscode from 'vscode';
import { extractSourceReference } from '../source/source-linker';
import type { RecurringSignalEntry } from '../misc/recurring-signal-builder';

const maxDiagsPerSignal = 3;

/** Resolve a possibly-relative file path to an absolute path using the workspace root. */
function resolveToAbsolute(filePath: string): string | undefined {
    if (filePath.startsWith('/') || /^[a-zA-Z]:[\\/]/.test(filePath)) { return filePath; }
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) { return undefined; }
    return vscode.Uri.joinPath(folders[0].uri, filePath).fsPath;
}

/** Format a single diagnostic as a compact string: "code (severity, source)". */
function formatDiag(d: vscode.Diagnostic): string {
    const code = typeof d.code === 'object' ? String(d.code.value) : String(d.code ?? '');
    const sev = d.severity === vscode.DiagnosticSeverity.Error ? 'error'
        : d.severity === vscode.DiagnosticSeverity.Warning ? 'warning' : 'info';
    const src = d.source ? `, ${d.source}` : '';
    // Prefer code (e.g. "avoid_dynamic_calls") over message (which can be long)
    const label = code || d.message.slice(0, 60);
    return `${label} (${sev}${src})`;
}

/** Query diagnostics for a source file at a specific line. Returns formatted summary or undefined. */
function queryDiagsForRef(filePath: string, line: number): string | undefined {
    const absPath = resolveToAbsolute(filePath);
    if (!absPath) { return undefined; }
    try {
        const uri = vscode.Uri.file(absPath);
        const diags = vscode.languages.getDiagnostics(uri);
        // Filter to diagnostics at or near the referenced line (±2 lines for tolerance)
        const nearby = diags.filter(d => Math.abs(d.range.start.line + 1 - line) <= 2);
        if (nearby.length === 0) { return undefined; }
        const formatted = nearby.slice(0, maxDiagsPerSignal).map(formatDiag);
        return 'Lint: ' + formatted.join('; ');
    } catch {
        return undefined;
    }
}

/**
 * Enrich error and warning signals with lint diagnostics from referenced source files.
 * Mutates the `detail` field of matching signals by appending " | Lint: ..." context.
 * Only processes signals with kind 'error' or 'warning' that have a detail (example line)
 * containing a source file reference.
 *
 * This is a best-effort enrichment — diagnostics are only available for files open
 * in the workspace. Missing diagnostics are silently skipped.
 */
export function enrichSignalsWithLintContext(signals: RecurringSignalEntry[]): RecurringSignalEntry[] {
    return signals.map(signal => {
        // Only enrich error and warning signals that have example text to search
        if (signal.kind !== 'error' && signal.kind !== 'warning') { return signal; }
        const text = signal.detail ?? signal.label;
        if (!text) { return signal; }
        const ref = extractSourceReference(text);
        if (!ref) { return signal; }
        const lintContext = queryDiagsForRef(ref.filePath, ref.line);
        if (!lintContext) { return signal; }
        // Append lint context to detail — create new object (RecurringSignalEntry is readonly)
        return { ...signal, detail: (signal.detail ? signal.detail + ' | ' : '') + lintContext };
    });
}

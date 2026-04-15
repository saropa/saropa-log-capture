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

/**
 * Format a single diagnostic with full detail — rule code, severity, source,
 * AND the actionable message text (e.g. "Avoid using dynamic calls. Try casting
 * to a specific type."). This gives the user enough context to act on the lint
 * finding without opening the source file.
 */
function formatDiag(d: vscode.Diagnostic): string {
    const code = typeof d.code === 'object' ? String(d.code.value) : String(d.code ?? '');
    const sev = d.severity === vscode.DiagnosticSeverity.Error ? 'error'
        : d.severity === vscode.DiagnosticSeverity.Warning ? 'warning' : 'info';
    const src = d.source ?? '';
    // Include the full message — this is where the actionable advice lives
    // (e.g. "Avoid using dynamic calls" from saropa_lints, or
    // "The argument type 'String?' can't be assigned to 'String'" from dart)
    const msg = d.message.length > 120 ? d.message.slice(0, 117) + '...' : d.message;
    // Format: "[source] code (severity): message" or "[source] (severity): message" if no code
    const prefix = src ? `[${src}] ` : '';
    const codeStr = code ? `${code} (${sev})` : `(${sev})`;
    return `${prefix}${codeStr}: ${msg}`;
}

/**
 * Query diagnostics for a source file, prioritizing those at the referenced line.
 * Returns diagnostics sorted by proximity: exact line first, then nearby (±5 lines),
 * then file-level findings. This surfaces both the specific lint at the error location
 * AND broader file-level issues that may be contributing factors.
 */
function queryDiagsForRef(filePath: string, line: number): string | undefined {
    const absPath = resolveToAbsolute(filePath);
    if (!absPath) { return undefined; }
    try {
        const uri = vscode.Uri.file(absPath);
        const diags = vscode.languages.getDiagnostics(uri);
        if (diags.length === 0) { return undefined; }
        // Sort by proximity to the referenced line — nearest first
        const sorted = [...diags].sort((a, b) => {
            const distA = Math.abs(a.range.start.line + 1 - line);
            const distB = Math.abs(b.range.start.line + 1 - line);
            return distA - distB;
        });
        const formatted = sorted.slice(0, maxDiagsPerSignal).map(formatDiag);
        return 'Lint: ' + formatted.join(' | ');
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

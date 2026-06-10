/**
 * Canonical log-line normalization shared by the session diff engines (2-way `diff-engine.ts`
 * and N-way `compare/session-compare.ts`). Kept in its own pure (no-vscode) module so both
 * comparers normalize identically — a line judged "the same" by one must be "the same" by the
 * other — and so the N-way engine stays unit-testable without the VS Code host.
 */

import { stripAnsi } from '../capture/ansi';

/**
 * Normalize a log line for content equality: strip ANSI, drop a leading clock or ISO timestamp
 * (so the same event at different wall-clock times matches across sessions), collapse to a
 * trimmed lowercase form. This is intentionally lossy — it answers "is this the same kind of
 * line?", not "is this byte-identical?".
 */
export function normalizeLine(text: string): string {
    let normalized = stripAnsi(text);
    // Leading [HH:MM:SS.mmm] / HH:MM:SS clock stamp.
    normalized = normalized.replace(/^\[?\d{2}:\d{2}:\d{2}(?:\.\d{3})?\]?\s*/, '');
    // Leading ISO-8601 stamp.
    normalized = normalized.replace(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z?\s*/, '');
    return normalized.trim().toLowerCase();
}

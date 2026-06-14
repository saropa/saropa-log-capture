/**
 * Signal report "Cross-Session History" section builder.
 *
 * Renders a summary line ("Appeared in N of M sessions"), a clickable list
 * of past sessions where the same signal type was detected, and a "what changed"
 * diff comparing the current session header against the last clean session.
 */

import { escapeHtml } from '../../modules/capture/ansi';
import { t } from '../../l10n';
import type { HistorySession } from './signal-report-history-loader';
import type { SessionHeader } from './signal-report-context';

/** Fields to compare between session headers, in display order. */
const diffFields: readonly (keyof SessionHeader)[] = [
    'extensionVersion', 'vscodeVersion', 'debugAdapter',
    'configurationName', 'os', 'gitBranch', 'gitCommit',
];

/** Compute which header fields differ between two sessions. */
function computeHeaderDiff(
    current: SessionHeader,
    clean: SessionHeader,
): { field: string; from: string; to: string }[] {
    const diffs: { field: string; from: string; to: string }[] = [];
    for (const key of diffFields) {
        const cur = current[key] ?? '';
        const prev = clean[key] ?? '';
        if (cur !== prev && (cur || prev)) {
            diffs.push({ field: key, from: prev || '(none)', to: cur || '(none)' });
        }
    }
    return diffs;
}

export interface HistoryOpts {
    readonly sessions: readonly HistorySession[];
    readonly totalSessionCount: number;
    /** Current session header — needed for "what changed" diff. */
    readonly currentHeader?: SessionHeader;
    /** Last clean (signal-free) session header for comparison. */
    readonly cleanHeader?: SessionHeader;
}

/** Build HTML for the cross-session history section in the signal report panel. */
export function buildHistoryHtml(opts: HistoryOpts): string {
    const { sessions, totalSessionCount } = opts;
    const parts: string[] = [];
    if (sessions.length === 0) {
        parts.push(`<div class="no-data">${escapeHtml(t('signals.history.noData'))}</div>`);
    } else {
        // {0} is the bolded count (pre-built HTML), {1} the total; the `(s)` plural rides in the value.
        const summary = t('signals.history.summary', `<strong>${sessions.length}</strong>`, totalSessionCount);
        parts.push(`<div class="history-summary">${summary}</div>`);
        const rows = sessions.map(s =>
            `<div class="history-session-row" data-uri="${escapeHtml(s.uriString)}" ` +
            `title="${escapeHtml(t('signals.history.openTitle'))}">` +
            `<span class="history-session-name">${escapeHtml(s.name)}</span>` +
            `<span class="history-session-date">${escapeHtml(s.dateLabel)}</span></div>`,
        ).join('');
        parts.push(`<div class="history-session-list">${rows}</div>`);
    }
    // "What changed" diff
    appendWhatChangedHtml(parts, opts);
    return parts.join('');
}

/** Build markdown for the cross-session history section in exported reports. */
export function buildHistoryMarkdown(opts: HistoryOpts): string {
    const lines: string[] = [];
    const { sessions, totalSessionCount } = opts;
    if (sessions.length > 0) {
        lines.push(
            '## Cross-Session History', '',
            `Appeared in **${sessions.length}** of ${totalSessionCount} ` +
            `session${totalSessionCount === 1 ? '' : 's'}.`, '',
        );
        for (const s of sessions) {
            lines.push(`- ${s.name} (${s.dateLabel})`);
        }
        lines.push('');
    }
    // "What changed" diff
    appendWhatChangedMarkdown(lines, opts);
    return lines.join('\n');
}

function appendWhatChangedHtml(parts: string[], opts: HistoryOpts): void {
    if (!opts.currentHeader || !opts.cleanHeader) { return; }
    const diffs = computeHeaderDiff(opts.currentHeader, opts.cleanHeader);
    if (diffs.length === 0) { return; }
    parts.push(`<div class="history-diff-heading">${escapeHtml(t('signals.history.whatChanged'))}</div>`);
    parts.push('<div class="history-diff-list">');
    for (const d of diffs) {
        parts.push(
            `<div class="history-diff-row">` +
            `<span class="diff-field">${escapeHtml(d.field)}</span> ` +
            `<span class="diff-from">${escapeHtml(d.from)}</span> → ` +
            `<span class="diff-to">${escapeHtml(d.to)}</span>` +
            `</div>`,
        );
    }
    parts.push('</div>');
}

function appendWhatChangedMarkdown(lines: string[], opts: HistoryOpts): void {
    if (!opts.currentHeader || !opts.cleanHeader) { return; }
    const diffs = computeHeaderDiff(opts.currentHeader, opts.cleanHeader);
    if (diffs.length === 0) { return; }
    lines.push('### What changed since last clean session', '');
    for (const d of diffs) {
        lines.push(`- **${d.field}:** ${d.from} → ${d.to}`);
    }
    lines.push('');
}

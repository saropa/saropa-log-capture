/**
 * Signal report "Cross-Session History" section builder.
 *
 * Renders a summary line ("Appeared in N of M sessions") and a clickable list
 * of past sessions where the same signal type was detected. Each row posts
 * an `openSessionFromHistory` message when clicked.
 */

import { escapeHtml } from '../../modules/capture/ansi';
import type { HistorySession } from './signal-report-history-loader';

/** Build HTML for the cross-session history section in the signal report panel. */
export function buildHistoryHtml(opts: {
    readonly sessions: readonly HistorySession[];
    readonly totalSessionCount: number;
}): string {
    const { sessions, totalSessionCount } = opts;
    if (sessions.length === 0) {
        return '<div class="no-data">No cross-session history for this signal type. ' +
            'History appears after multiple sessions detect the same signal.</div>';
    }
    const summary = `<div class="history-summary">Appeared in <strong>${sessions.length}</strong> of ` +
        `${totalSessionCount} session${totalSessionCount === 1 ? '' : 's'}</div>`;
    const rows = sessions.map(s =>
        `<div class="history-session-row" data-uri="${escapeHtml(s.uriString)}" title="Open this session in the viewer">` +
        `<span class="history-session-name">${escapeHtml(s.name)}</span>` +
        `<span class="history-session-date">${escapeHtml(s.dateLabel)}</span></div>`,
    ).join('');
    return summary + `<div class="history-session-list">${rows}</div>`;
}

/** Build markdown for the cross-session history section in exported reports. */
export function buildHistoryMarkdown(opts: {
    readonly sessions: readonly HistorySession[];
    readonly totalSessionCount: number;
}): string {
    const { sessions, totalSessionCount } = opts;
    if (sessions.length === 0) { return ''; }
    const lines = [
        `## Cross-Session History`,
        '',
        `Appeared in **${sessions.length}** of ${totalSessionCount} session${totalSessionCount === 1 ? '' : 's'}.`,
        '',
    ];
    for (const s of sessions) {
        lines.push(`- ${s.name} (${s.dateLabel})`);
    }
    return lines.join('\n');
}

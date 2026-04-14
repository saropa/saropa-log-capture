/**
 * Load cross-session history for a signal template ID.
 *
 * Queries all session metadata for sessions whose persisted signal summary
 * includes the given templateId in hypothesisTemplateIds. Returns matching
 * sessions sorted most-recent-first, capped at 20, with display names and URIs.
 */

import * as vscode from 'vscode';
import { getLogDirectoryUri } from '../../modules/config/config';
import { loadFilteredMetas, parseSessionDate } from '../../modules/session/metadata-loader';
import { isPersistedSignalSummaryV1 } from '../../modules/root-cause-hints/signal-summary-types';

/** A past session that had the same signal type. */
export interface HistorySession {
    readonly name: string;
    readonly dateLabel: string;
    readonly uriString: string;
}

const maxHistorySessions = 20;

/** Format epoch ms as a human-readable date label. */
function formatDateLabel(epochMs: number): string {
    if (epochMs <= 0) { return 'Unknown date'; }
    const d = new Date(epochMs);
    const pad = (n: number): string => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Find sessions whose signal summary includes the given hypothesis template ID.
 * Returns matching sessions (most-recent-first, capped) and total session count.
 */
export async function loadSignalHistory(templateId: string): Promise<{
    sessions: HistorySession[];
    totalSessionCount: number;
}> {
    const metas = await loadFilteredMetas('all').catch(() => [] as const);
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) { return { sessions: [], totalSessionCount: metas.length }; }
    const logDir = getLogDirectoryUri(folder);

    const matching = metas
        .filter(m => {
            const s = m.meta.signalSummary;
            return s && isPersistedSignalSummaryV1(s) && s.hypothesisTemplateIds?.includes(templateId);
        })
        .map(m => ({
            // Use display name from metadata if available, otherwise the filename
            name: m.meta.displayName || m.filename.split('/').pop() || m.filename,
            dateLabel: formatDateLabel(parseSessionDate(m.filename)),
            uriString: vscode.Uri.joinPath(logDir, m.filename).toString(),
            epoch: parseSessionDate(m.filename),
        }))
        .sort((a, b) => b.epoch - a.epoch)
        .slice(0, maxHistorySessions);

    return {
        sessions: matching.map(({ name, dateLabel, uriString }) => ({ name, dateLabel, uriString })),
        totalSessionCount: metas.length,
    };
}

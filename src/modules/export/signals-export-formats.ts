/**
 * Export formatters for insights summary: CSV and JSON.
 * Used by the Export Insights Summary command.
 */

import type { InsightsSummary } from '../signals/signals-summary';
import { escapeCsvField } from './export-formats';

/**
 * Serialize insights summary to CSV.
 * Two sections: errors (signature, count, sessions, sampleLine, firstSeen, lastSeen, category), then files (path, sessionCount).
 */
export function formatInsightsSummaryToCsv(summary: InsightsSummary): string {
    const lines: string[] = [];

    lines.push('errors');
    lines.push('signature,count,sessions,sampleLine,firstSeen,lastSeen,category');
    for (const e of summary.errors) {
        const sessions = e.sessions.join(';');
        lines.push([
            escapeCsvField(e.signature),
            e.count,
            escapeCsvField(sessions),
            escapeCsvField(e.sampleLine),
            escapeCsvField(e.firstSeen),
            escapeCsvField(e.lastSeen),
            e.category ? escapeCsvField(e.category) : '',
        ].join(','));
    }

    lines.push('');
    lines.push('files');
    lines.push('path,sessionCount');
    for (const f of summary.files) {
        lines.push([escapeCsvField(f.path), f.sessionCount].join(','));
    }

    return lines.join('\n');
}

/**
 * Serialize insights summary to JSON.
 * Structure: { errors: ErrorSummary[], files: FileSummary[], meta: { sessionCount, timeRange, exportedAt } }.
 */
export function formatInsightsSummaryToJson(summary: InsightsSummary): string {
    return JSON.stringify(
        {
            errors: summary.errors,
            files: summary.files,
            meta: summary.meta,
        },
        null,
        2,
    );
}

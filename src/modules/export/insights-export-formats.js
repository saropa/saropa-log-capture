"use strict";
/**
 * Export formatters for insights summary: CSV and JSON.
 * Used by the Export Insights Summary command.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatInsightsSummaryToCsv = formatInsightsSummaryToCsv;
exports.formatInsightsSummaryToJson = formatInsightsSummaryToJson;
const export_formats_1 = require("./export-formats");
/**
 * Serialize insights summary to CSV.
 * Two sections: errors (signature, count, sessions, sampleLine, firstSeen, lastSeen, category), then files (path, sessionCount).
 */
function formatInsightsSummaryToCsv(summary) {
    const lines = [];
    lines.push('errors');
    lines.push('signature,count,sessions,sampleLine,firstSeen,lastSeen,category');
    for (const e of summary.errors) {
        const sessions = e.sessions.join(';');
        lines.push([
            (0, export_formats_1.escapeCsvField)(e.signature),
            e.count,
            (0, export_formats_1.escapeCsvField)(sessions),
            (0, export_formats_1.escapeCsvField)(e.sampleLine),
            (0, export_formats_1.escapeCsvField)(e.firstSeen),
            (0, export_formats_1.escapeCsvField)(e.lastSeen),
            e.category ? (0, export_formats_1.escapeCsvField)(e.category) : '',
        ].join(','));
    }
    lines.push('');
    lines.push('files');
    lines.push('path,sessionCount');
    for (const f of summary.files) {
        lines.push([(0, export_formats_1.escapeCsvField)(f.path), f.sessionCount].join(','));
    }
    return lines.join('\n');
}
/**
 * Serialize insights summary to JSON.
 * Structure: { errors: ErrorSummary[], files: FileSummary[], meta: { sessionCount, timeRange, exportedAt } }.
 */
function formatInsightsSummaryToJson(summary) {
    return JSON.stringify({
        errors: summary.errors,
        files: summary.files,
        meta: summary.meta,
    }, null, 2);
}
//# sourceMappingURL=insights-export-formats.js.map
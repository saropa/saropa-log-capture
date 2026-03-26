"use strict";
/**
 * Insights summary: structured data for export (recurring errors + hot files).
 * Built from CrossSessionInsights with optional caps for large scopes.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildInsightsSummary = buildInsightsSummary;
const defaultMaxErrors = 500;
const defaultMaxFiles = 500;
/**
 * Build an exportable summary from cross-session insights.
 * Caps errors and files to avoid huge exports.
 */
function buildInsightsSummary(insights, options) {
    const maxErrors = options?.maxErrors ?? defaultMaxErrors;
    const maxFiles = options?.maxFiles ?? defaultMaxFiles;
    const timeRangeLabel = options?.timeRangeLabel ?? 'all';
    const errors = insights.recurringErrors.slice(0, maxErrors).map((e) => ({
        signature: e.hash,
        count: e.totalOccurrences,
        sessions: e.timeline.map(t => t.session),
        sampleLine: e.exampleLine,
        firstSeen: e.firstSeen,
        lastSeen: e.lastSeen,
        category: e.category,
    }));
    const files = insights.hotFiles.slice(0, maxFiles).map((f) => ({
        path: f.filename,
        sessionCount: f.sessionCount,
    }));
    return {
        errors,
        files,
        meta: {
            sessionCount: insights.sessionCount,
            timeRange: timeRangeLabel,
            exportedAt: new Date(insights.queriedAt).toISOString(),
        },
    };
}
//# sourceMappingURL=insights-summary.js.map
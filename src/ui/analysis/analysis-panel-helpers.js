"use strict";
/** Shared helpers for analysis panel orchestration. */
Object.defineProperty(exports, "__esModule", { value: true });
exports.mergeResults = mergeResults;
exports.postPendingSlots = postPendingSlots;
exports.postFinalization = postFinalization;
exports.postNoSource = postNoSource;
exports.buildSourceMetrics = buildSourceMetrics;
const analysis_relevance_1 = require("../../modules/analysis/analysis-relevance");
const analysis_panel_summary_1 = require("./analysis-panel-summary");
const analysis_trend_render_1 = require("./analysis-trend-render");
const analysis_panel_render_1 = require("./analysis-panel-render");
function mergeResults(settled, seed = {}) {
    let merged = { ...seed };
    for (const r of settled) {
        if (r.status === 'fulfilled') {
            merged = { ...merged, ...r.value };
        }
    }
    return merged;
}
/** Post timeout errors for any sections that never completed. */
function postPendingSlots(posted, post, flags) {
    const { hasSource, hasTag = false, hasError = false } = flags;
    const expected = ['docs', 'symbols', 'tokens', 'github', 'firebase',
        ...(hasSource ? ['source', 'line-history', 'imports'] : []),
        ...(hasTag ? ['related', 'files'] : []),
        ...(hasError ? ['error-header', 'error-timeline', 'error-occurrences'] : [])];
    for (const id of expected) {
        if (!posted.has(id)) {
            post(id, (0, analysis_panel_render_1.errorSlot)(id, '⏱ Analysis timed out'));
        }
    }
}
/** Post trend section, score relevance, and send executive summary. */
function postFinalization(post, data, signal, webviewPanel) {
    const trend = data.crossSession?.trend;
    if (trend && trend.length > 1) {
        post('trend', (0, analysis_trend_render_1.renderTrendSection)(trend, data.crossSession.sessionCount, data.crossSession.totalOccurrences));
    }
    else {
        post('trend', (0, analysis_panel_render_1.emptySlot)('trend', '📊 No cross-session history'));
    }
    const relevance = (0, analysis_relevance_1.scoreRelevance)(data);
    const html = (0, analysis_panel_summary_1.renderExecutiveSummary)(relevance.findings);
    const collapseSections = [...relevance.sectionLevels.entries()]
        .filter(([, level]) => level === 'low').map(([id]) => id);
    if (!signal.aborted) {
        webviewPanel?.webview.postMessage({ type: 'summaryReady', html, collapseSections });
    }
}
function postNoSource(post, sourceLabel) {
    post('source', (0, analysis_panel_render_1.emptySlot)('source', sourceLabel));
    post('line-history', (0, analysis_panel_render_1.emptySlot)('line-history', '🕐 No source context'));
    post('imports', (0, analysis_panel_render_1.emptySlot)('imports', '📦 No source context'));
}
function buildSourceMetrics(info, blame) {
    return {
        blame: blame ? { date: blame.date, author: blame.author, hash: blame.hash } : undefined,
        lineCommits: info.lineCommits.map(c => ({ date: c.date })),
        annotations: info.annotations.map(a => ({ type: a.type })),
        gitCommitCount: info.gitCommits.length,
    };
}
//# sourceMappingURL=analysis-panel-helpers.js.map
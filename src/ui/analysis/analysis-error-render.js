"use strict";
/**
 * HTML rendering functions for error-specific sections in the analysis panel.
 *
 * These sections appear conditionally when the analyzed line is an error/warning.
 * Includes: error header with triage, timeline sparkline, occurrences, rate, action bar.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderErrorHeader = renderErrorHeader;
exports.renderTriageUpdate = renderTriageUpdate;
exports.renderTimelineSection = renderTimelineSection;
exports.renderOccurrencesSection = renderOccurrencesSection;
exports.renderActionBar = renderActionBar;
const ansi_1 = require("../../modules/capture/ansi");
const stack_parser_1 = require("../../modules/analysis/stack-parser");
const analysis_panel_render_1 = require("./analysis-panel-render");
/** Render the error classification header with triage controls. */
function renderErrorHeader(opts) {
    const { errorText, errorClass, crashCategory, hash, triageStatus } = opts;
    const classBadge = renderClassBadge(errorClass);
    const catBadge = crashCategory !== 'non-fatal'
        ? `<span class="err-cat err-cat-${(0, ansi_1.escapeHtml)(crashCategory)}">${(0, ansi_1.escapeHtml)(crashCategory.toUpperCase())}</span>`
        : '';
    const triageHtml = renderTriageButtons(hash, triageStatus);
    const text = errorText.length > 200 ? errorText.substring(0, 200) + '\u2026' : errorText;
    return `<div class="err-header">
        <div class="err-badges">${classBadge}${catBadge}<span class="err-hash" title="Fingerprint hash">#${(0, ansi_1.escapeHtml)(hash)}</span></div>
        <div class="err-text">${(0, ansi_1.escapeHtml)(text)}</div>
        <div class="err-triage">${triageHtml}</div>
    </div>`;
}
function renderClassBadge(errorClass) {
    if (!errorClass) {
        return '';
    }
    const labels = {
        critical: 'CRITICAL',
        transient: 'TRANSIENT',
        bug: 'BUG',
    };
    return `<span class="err-class err-class-${(0, ansi_1.escapeHtml)(errorClass)}">${labels[errorClass] ?? errorClass}</span>`;
}
/** Render triage toggle buttons (open/closed/muted). */
function renderTriageButtons(hash, status) {
    const states = ['open', 'closed', 'muted'];
    return '<span class="triage-group">' + states.map(s => `<button class="triage-btn triage-btn-${s}${s === status ? ' triage-active' : ''}" data-triage-hash="${(0, ansi_1.escapeHtml)(hash)}" data-triage-status="${s}">${s}</button>`).join('') + '</span>';
}
/** Render updated triage buttons (sent after status change). */
function renderTriageUpdate(hash, status) {
    return renderTriageButtons(hash, status);
}
/** Render cross-session timeline section with sparkline SVG. */
function renderTimelineSection(signal) {
    const trend = signal.timeline
        .map(t => ({ date: (0, stack_parser_1.extractDateFromFilename)(t.session), count: t.count }))
        .filter((t) => t.date !== undefined)
        .sort((a, b) => a.date.localeCompare(b.date));
    const logs = `${signal.sessionCount} log${signal.sessionCount !== 1 ? 's' : ''}`;
    let html = `<details class="group" open><summary class="group-header">📊 Error History <span class="match-count">${signal.totalOccurrences} occurrences across ${logs}</span></summary>`;
    html += renderVersionInfo(signal);
    if (trend.length >= 2) {
        html += buildSparkline(trend);
    }
    html += '</details>';
    return (0, analysis_panel_render_1.doneSlot)('error-timeline', html);
}
/** Render first-seen / last-seen version info for the error timeline. */
function renderVersionInfo(signal) {
    const parts = [];
    if (signal.firstSeen) {
        const date = (0, stack_parser_1.extractDateFromFilename)(signal.firstSeen);
        if (date) {
            parts.push(`First: ${(0, ansi_1.escapeHtml)(date)}`);
        }
    }
    if (signal.lastSeen) {
        const date = (0, stack_parser_1.extractDateFromFilename)(signal.lastSeen);
        if (date) {
            parts.push(`Last: ${(0, ansi_1.escapeHtml)(date)}`);
        }
    }
    if (signal.firstSeenVersion) {
        parts.push(`v${(0, ansi_1.escapeHtml)(signal.firstSeenVersion)}`);
    }
    if (signal.lastSeenVersion && signal.lastSeenVersion !== signal.firstSeenVersion) {
        parts.push(`→ v${(0, ansi_1.escapeHtml)(signal.lastSeenVersion)}`);
    }
    return parts.length > 0 ? `<div class="err-version-info">${parts.join(' &middot; ')}</div>` : '';
}
const sparkW = 400;
const sparkH = 44;
const sparkPad = 28;
const sparkPlotW = sparkW - sparkPad * 2;
const sparkPlotH = sparkH - 14;
function buildSparkline(points) {
    const maxCount = points.reduce((m, p) => Math.max(m, p.count), 0);
    const barW = Math.min(20, Math.max(4, Math.floor(sparkPlotW / points.length) - 2));
    const totalBarsW = points.length * (barW + 2) - 2;
    const offsetX = sparkPad + Math.max(0, (sparkPlotW - totalBarsW) / 2);
    let svg = `<svg class="err-sparkline" viewBox="0 0 ${sparkW} ${sparkH}" preserveAspectRatio="xMidYMid meet">`;
    svg += `<line class="spark-axis" x1="${sparkPad}" y1="${sparkH - 10}" x2="${sparkW - sparkPad}" y2="${sparkH - 10}"/>`;
    for (let i = 0; i < points.length; i++) {
        const p = points[i];
        const h = maxCount > 0 ? (p.count / maxCount) * sparkPlotH : 0;
        const x = offsetX + i * (barW + 2);
        const y = sparkH - 10 - h;
        svg += `<rect class="spark-bar" x="${x}" y="${y}" width="${barW}" height="${h}" rx="1"><title>${(0, ansi_1.escapeHtml)(p.date)}: ${p.count}</title></rect>`;
    }
    const first = points[0].date;
    const last = points[points.length - 1].date;
    svg += `<text class="spark-label" x="${sparkPad}" y="${sparkH}" text-anchor="start">${(0, ansi_1.escapeHtml)(formatDateShort(first))}</text>`;
    svg += `<text class="spark-label" x="${sparkW - sparkPad}" y="${sparkH}" text-anchor="end">${(0, ansi_1.escapeHtml)(formatDateShort(last))}</text>`;
    return svg + '</svg>';
}
function formatDateShort(date) {
    const parts = date.split('-');
    return parts.length === 3 ? `${parts[1]}/${parts[2]}` : date;
}
/** Render current-log occurrences section. */
function renderOccurrencesSection(count, examples) {
    if (count === 0) {
        return (0, analysis_panel_render_1.emptySlot)('error-occurrences', '🔁 No other occurrences in this log');
    }
    const label = count === 1 ? '1 occurrence' : `${count} occurrences`;
    let html = `<details class="group" open><summary class="group-header">🔁 Log Occurrences <span class="match-count">${label}</span></summary>`;
    const shown = examples.slice(0, 10);
    for (const ex of shown) {
        const truncated = ex.length > 150 ? ex.substring(0, 150) + '\u2026' : ex;
        html += `<div class="err-occurrence">${(0, ansi_1.escapeHtml)(truncated)}</div>`;
    }
    if (count > 10) {
        html += `<div class="err-more">+ ${count - 10} more</div>`;
    }
    html += '</details>';
    return (0, analysis_panel_render_1.doneSlot)('error-occurrences', html);
}
/** Render the action bar with export/diagnostic buttons. */
function renderActionBar(hash, hasAi) {
    let html = '<div class="err-action-bar">';
    html += `<button class="err-action" data-action="copyContext" title="Copy error context to clipboard">📋 Copy Context</button>`;
    html += `<button class="err-action" data-action="bugReport" data-hash="${(0, ansi_1.escapeHtml)(hash)}" title="Generate bug report">🐛 Bug Report</button>`;
    html += `<button class="err-action" data-action="exportSlc" title="Export log as .slc bundle">📦 Export .slc</button>`;
    html += `<button class="err-action" data-action="exportJson" title="Export as JSON">{ } JSON</button>`;
    html += `<button class="err-action" data-action="exportCsv" title="Export as CSV">📊 CSV</button>`;
    if (hasAi) {
        html += `<button class="err-action err-action-ai" data-action="aiExplain" title="Explain with AI">🤖 AI Explain</button>`;
    }
    html += '</div>';
    return html;
}
//# sourceMappingURL=analysis-error-render.js.map
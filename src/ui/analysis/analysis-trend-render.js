"use strict";
/** Compact SVG bar chart for cross-session error frequency. */
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderTrendSection = renderTrendSection;
const ansi_1 = require("../../modules/capture/ansi");
const analysis_panel_render_1 = require("./analysis-panel-render");
const chartW = 400;
const chartH = 50;
const pad = 30;
const plotW = chartW - pad * 2;
const plotH = chartH - 16;
const minBarW = 4;
const maxBarW = 24;
/** Render the error trend section with a compact bar chart. */
function renderTrendSection(trend, sessionCount, totalOccurrences) {
    if (trend.length < 2) {
        return (0, analysis_panel_render_1.emptySlot)('trend', '📊 No cross-session history');
    }
    const sessions = sessionCount === 1 ? '1 session' : `${sessionCount} sessions`;
    const header = `<details class="group" open><summary class="group-header">📊 Error Frequency <span class="match-count">${totalOccurrences} occurrences across ${sessions}</span></summary>`;
    const svg = buildSvg(trend);
    return (0, analysis_panel_render_1.doneSlot)('trend', header + svg + '</details>');
}
function buildSvg(points) {
    const maxCount = Math.max(...points.map(p => p.count));
    const barW = Math.min(maxBarW, Math.max(minBarW, Math.floor(plotW / points.length) - 2));
    const totalBarsW = points.length * (barW + 2) - 2;
    const offsetX = pad + Math.max(0, (plotW - totalBarsW) / 2);
    let svg = `<svg class="trend-chart" viewBox="0 0 ${chartW} ${chartH}" preserveAspectRatio="xMidYMid meet">`;
    svg += `<line class="trend-axis" x1="${pad}" y1="${chartH - 12}" x2="${chartW - pad}" y2="${chartH - 12}"/>`;
    for (let i = 0; i < points.length; i++) {
        const p = points[i];
        const h = maxCount > 0 ? (p.count / maxCount) * plotH : 0;
        const x = offsetX + i * (barW + 2);
        const y = chartH - 12 - h;
        svg += `<rect class="trend-bar" x="${x}" y="${y}" width="${barW}" height="${h}" rx="1"><title>${(0, ansi_1.escapeHtml)(p.date)}: ${p.count}</title></rect>`;
    }
    const first = points[0].date;
    const last = points[points.length - 1].date;
    svg += `<text class="trend-label" x="${pad}" y="${chartH - 1}" text-anchor="start">${(0, ansi_1.escapeHtml)(formatShort(first))}</text>`;
    svg += `<text class="trend-label" x="${chartW - pad}" y="${chartH - 1}" text-anchor="end">${(0, ansi_1.escapeHtml)(formatShort(last))}</text>`;
    return svg + '</svg>';
}
function formatShort(date) {
    const parts = date.split('-');
    return parts.length === 3 ? `${parts[1]}/${parts[2]}` : date;
}
//# sourceMappingURL=analysis-trend-render.js.map
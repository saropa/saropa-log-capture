"use strict";
/** Rendering for stack trace deep-dive — clickable frame list and inline mini-analysis. */
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderFrameSection = renderFrameSection;
exports.renderFrameAnalysis = renderFrameAnalysis;
const ansi_1 = require("../../modules/capture/ansi");
/** Render the full stack trace section with clickable app-code frames. */
function renderFrameSection(frames) {
    const appCount = frames.filter(f => f.isApp).length;
    const fwCount = frames.length - appCount;
    let html = `<details class="group" ${frames.length <= 15 ? 'open' : ''}>`;
    html += `<summary class="group-header">🔍 Stack Trace <span class="match-count">${frames.length} frames (${appCount} app, ${fwCount} fw)</span></summary>`;
    for (const f of frames) {
        html += renderFrame(f);
    }
    return html + '</details>';
}
function renderFrame(f) {
    const badgeCls = f.isApp ? 'frame-badge-app' : 'frame-badge-fw';
    const badgeLabel = f.isApp ? 'APP' : 'FW';
    const badge = `<span class="frame-badge ${badgeCls}">${badgeLabel}</span>`;
    if (f.isApp && f.sourceRef) {
        const file = (0, ansi_1.escapeHtml)(f.sourceRef.filePath);
        return `<div class="stack-frame frame-app" data-frame-file="${file}" data-frame-line="${f.sourceRef.line}">`
            + `${badge}<span class="line-text">${(0, ansi_1.escapeHtml)(f.text)}</span>`
            + `<div class="frame-detail"></div></div>`;
    }
    const cls = f.isApp ? 'stack-frame frame-app-nosrc' : 'stack-frame frame-fw';
    return `<div class="${cls}">${badge}<span class="line-text">${(0, ansi_1.escapeHtml)(f.text)}</span></div>`;
}
/** Render compact mini-analysis for a single frame (source preview + blame + annotations). */
function renderFrameAnalysis(info, blame) {
    let html = '';
    if (info.sourcePreview) {
        const { lines, targetLine } = info.sourcePreview;
        const uriStr = info.uri.toString();
        html += '<div class="source-preview">';
        for (const l of lines) {
            const cls = l.num === targetLine ? 'source-line target-line' : 'source-line';
            html += `<div class="${cls}" data-source-uri="${(0, ansi_1.escapeHtml)(uriStr)}" data-line="${l.num}">`;
            html += `<span class="line-num">L${l.num}</span><span class="line-text">${(0, ansi_1.escapeHtml)(l.text)}</span></div>`;
        }
        html += '</div>';
    }
    if (blame) {
        html += `<div class="blame-line">Last changed by <strong>${(0, ansi_1.escapeHtml)(blame.author)}</strong>`;
        html += ` on ${(0, ansi_1.escapeHtml)(blame.date)} · <code>${(0, ansi_1.escapeHtml)(blame.hash)}</code> ${(0, ansi_1.escapeHtml)(blame.message)}</div>`;
    }
    if (info.annotations.length > 0) {
        const urgent = info.annotations.filter(a => /^(BUG|FIXME)$/i.test(a.type));
        if (urgent.length > 0) {
            html += `<div class="blame-line">⚠️ ${urgent.length} urgent annotation${urgent.length !== 1 ? 's' : ''} nearby</div>`;
        }
    }
    if (!html) {
        html = '<div class="no-matches">Source file found but no context available</div>';
    }
    return html;
}
//# sourceMappingURL=analysis-frame-render.js.map
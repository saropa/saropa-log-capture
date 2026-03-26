"use strict";
/** Executive summary banner for the analysis panel. */
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderExecutiveSummary = renderExecutiveSummary;
const ansi_1 = require("../../modules/capture/ansi");
/** Render the executive summary HTML banner from scored findings. */
function renderExecutiveSummary(findings) {
    const visible = findings.filter(f => f.text && (f.level === 'high' || f.level === 'medium'));
    if (visible.length === 0) {
        return '';
    }
    let html = '<div class="executive-summary"><div class="summary-title">Key Findings</div>';
    for (const f of visible) {
        const cls = f.level === 'high' ? 'finding-high' : 'finding-medium';
        html += `<div class="summary-finding ${cls}"><span class="finding-icon">${f.icon}</span><span>${(0, ansi_1.escapeHtml)(f.text)}</span></div>`;
    }
    return html + '</div>';
}
//# sourceMappingURL=analysis-panel-summary.js.map
/** Executive summary banner for the analysis panel. */

import { escapeHtml } from '../modules/ansi';
import type { SectionFinding } from '../modules/analysis-relevance';

/** Render the executive summary HTML banner from scored findings. */
export function renderExecutiveSummary(findings: readonly SectionFinding[]): string {
    const visible = findings.filter(f => f.text && (f.level === 'high' || f.level === 'medium'));
    if (visible.length === 0) { return ''; }
    let html = '<div class="executive-summary"><div class="summary-title">Key Findings</div>';
    for (const f of visible) {
        const cls = f.level === 'high' ? 'finding-high' : 'finding-medium';
        html += `<div class="summary-finding ${cls}"><span class="finding-icon">${f.icon}</span><span>${escapeHtml(f.text)}</span></div>`;
    }
    return html + '</div>';
}

/** Render environment distribution section for the Insights panel. */

import { escapeHtml } from '../modules/ansi';
import type { CrossSessionInsights, EnvironmentStat } from '../modules/cross-session-aggregator';

/** Render collapsible environment distribution section. Returns empty string if no data. */
export function renderEnvironmentSection(insights: CrossSessionInsights): string {
    const groups: string[] = [];
    if (insights.debugAdapters.length > 0) { groups.push(renderStatGroup('Debug Adapters', insights.debugAdapters)); }
    if (insights.platforms.length > 0) { groups.push(renderStatGroup('Platforms', insights.platforms)); }
    if (insights.sdkVersions.length > 0) { groups.push(renderStatGroup('SDK Versions', insights.sdkVersions)); }
    if (groups.length === 0) { return ''; }
    return `<details class="section">
<summary class="section-header">Environment Distribution<span class="count">${groups.length} categories</span></summary>
${groups.join('\n')}
</details>`;
}

function renderStatGroup(label: string, stats: readonly EnvironmentStat[]): string {
    const rows = stats.map(s => {
        const count = `${s.sessionCount} session${s.sessionCount !== 1 ? 's' : ''}`;
        return `<div class="env-stat"><span class="env-value">${escapeHtml(s.value)}</span><span class="env-count">${count}</span></div>`;
    }).join('');
    return `<div class="env-group"><div class="env-group-label">${label}</div>${rows}</div>`;
}

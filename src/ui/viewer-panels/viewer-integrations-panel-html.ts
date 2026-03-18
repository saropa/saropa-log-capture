/**
 * HTML for the dedicated Integrations screen shown when the user clicks
 * "Integrations…" in the Options panel. Rendered inside the same slide-out;
 * open/close is handled in viewer-options-panel-script (view switch, no new panel).
 *
 * Includes: back button, intro copy, and one row per adapter with long description,
 * optional performance note, and when-to-disable. Checkboxes use data-adapter-id
 * and are synced from window.integrationAdapters; changes post setIntegrationsAdapters to host.
 */
import { escapeHtml } from '../../modules/capture/ansi';
import type { IntegrationAdapterMeta } from '../../modules/integrations/integrations-ui';
import { INTEGRATION_ADAPTERS } from '../../modules/integrations/integrations-ui';

/** Build one integration row: checkbox, label, long description, and optional perf/when-to-disable lines. */
function renderIntegrationRow(a: IntegrationAdapterMeta): string {
    const longDesc = a.descriptionLong ?? a.description;
    const perf = a.performanceNote ? `<p class="integrations-note integrations-perf">Performance: ${escapeHtml(a.performanceNote)}</p>` : '';
    const when = a.whenToDisable ? `<p class="integrations-note integrations-when">When to disable: ${escapeHtml(a.whenToDisable)}</p>` : '';
    return `
        <label class="integrations-row" title="${escapeHtml(longDesc)}">
            <input type="checkbox" id="int-${escapeHtml(a.id)}" data-adapter-id="${escapeHtml(a.id)}" />
            <span class="integrations-label">${escapeHtml(a.label)}</span>
            <p class="integrations-desc">${escapeHtml(longDesc)}</p>
            ${perf}
            ${when}
        </label>`;
}

/** Returns the HTML for the Integrations view (header + back + list). Shown inside the options panel when user clicks Integrations. */
export function getIntegrationsPanelHtml(): string {
    const rows = INTEGRATION_ADAPTERS.map(renderIntegrationRow).join('\n');
    return `
    <div id="integrations-view" class="integrations-view integrations-view-hidden" role="region" aria-label="Integrations" aria-hidden="true">
        <div class="integrations-header">
            <button type="button" id="integrations-back" class="integrations-back" title="Back to Options" aria-label="Back to Options"><span class="codicon codicon-arrow-left"></span></button>
            <span class="integrations-title">Integrations</span>
        </div>
        <div class="integrations-content">
            <p class="integrations-intro">Choose what to attach to each debug session. Session adapters add context to the log header or sidecar files; Crashlytics adds the production-issues sidebar. Each integration below includes a short note on performance and when you might leave it off.</p>
            <div class="options-section" id="integrations-section">
                ${rows}
            </div>
        </div>
    </div>`;
}

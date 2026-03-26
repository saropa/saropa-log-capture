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

/** Shared preview length for collapsed integration descriptions. */
const INTEGRATIONS_DESCRIPTION_PREVIEW_LENGTH = 50;
const PERFORMANCE_WARNING_EMOJI = '⚠️';

function truncateWithEllipsis(value: string, maxLength: number): string {
    if (value.length <= maxLength) {
        return value;
    }
    return `${value.slice(0, maxLength)}…`;
}

function splitPerformanceWarning(performanceNote?: string): { warningEmoji: string; text: string } {
    if (!performanceNote) {
        return { warningEmoji: '', text: '' };
    }
    const trimmed = performanceNote.trim();
    if (!trimmed.startsWith(PERFORMANCE_WARNING_EMOJI)) {
        return { warningEmoji: '', text: trimmed };
    }
    const text = trimmed.slice(PERFORMANCE_WARNING_EMOJI.length).trim().replace(/^[-\u2014:]\s*/, '');
    return { warningEmoji: PERFORMANCE_WARNING_EMOJI, text };
}

/** Build one integration row: checkbox, label, long description, and optional perf/when-to-disable lines. */
function renderIntegrationRow(a: IntegrationAdapterMeta): string {
    const longDesc = a.descriptionLong ?? a.description;
    const previewDesc = truncateWithEllipsis(longDesc, INTEGRATIONS_DESCRIPTION_PREVIEW_LENGTH);
    const perfNote = splitPerformanceWarning(a.performanceNote);
    const labelWarning = perfNote.warningEmoji
        ? ` <span class="integrations-perf-warning" aria-label="Performance warning">${escapeHtml(perfNote.warningEmoji)}</span>`
        : '';
    let perf = '';
    if (a.performanceNote) {
        perf = `<p class="integrations-note integrations-perf integrations-expandable options-filtered-hidden">
            <span class="integrations-note-label">Performance:</span>
            <span>${escapeHtml(perfNote.text)}</span>
        </p>`;
    }
    const when = a.whenToDisable
        ? `<p class="integrations-note integrations-when integrations-expandable options-filtered-hidden">When to disable: ${escapeHtml(a.whenToDisable)}</p>`
        : '';
    const searchText = [a.label, longDesc, a.performanceNote ?? '', a.whenToDisable ?? ''].join(' ').toLowerCase();
    const escapedPreviewDesc = escapeHtml(previewDesc);
    const escapedLongDesc = escapeHtml(longDesc);
    const hasExpandable = longDesc.length > INTEGRATIONS_DESCRIPTION_PREVIEW_LENGTH || !!a.performanceNote || !!a.whenToDisable;
    const descToggle = hasExpandable
        ? `<button type="button" class="integrations-desc-toggle" data-expanded="false" aria-expanded="false">Show more</button>`
        : '';
    return `
        <label class="integrations-row" title="${escapeHtml(longDesc)}" data-search-text="${escapeHtml(searchText)}">
            <input type="checkbox" id="int-${escapeHtml(a.id)}" data-adapter-id="${escapeHtml(a.id)}" />
            <span class="integrations-label">${escapeHtml(a.label)}${labelWarning}</span>
            <p class="integrations-desc">
                <span class="integrations-desc-text">
                    <span class="integrations-desc-preview">${escapedPreviewDesc}</span>
                    <span class="integrations-desc-full options-filtered-hidden">${escapedLongDesc}</span>
                </span>
                ${descToggle}
            </p>
            ${perf}
            ${when}
        </label>`;
}

/** Returns the HTML for the Integrations view (header + back + list). Shown inside the options panel when user clicks Integrations. */
export function getIntegrationsPanelHtml(): string {
    const rows = [...INTEGRATION_ADAPTERS]
        .sort((a, b) => a.label.localeCompare(b.label))
        .map(renderIntegrationRow)
        .join('\n');
    return `
    <div id="integrations-view" class="integrations-view integrations-view-hidden" role="region" aria-label="Integrations" aria-hidden="true">
        <div class="integrations-header">
            <button type="button" id="integrations-back" class="integrations-back" title="Back to Options" aria-label="Back to Options"><span class="codicon codicon-arrow-left"></span></button>
            <span class="integrations-title">Integrations</span>
        </div>
        <div class="integrations-content">
            <p class="integrations-intro">Choose what to attach to each debug session. Session adapters add context to the log header or sidecar files; Crashlytics adds the production-issues sidebar. Each integration below includes a short note on performance and when you might leave it off.</p>
            <div class="integrations-search-wrapper">
                <input id="integrations-search" type="text" placeholder="Search integrations…" aria-label="Search integrations" />
            </div>
            <div class="options-section" id="integrations-section">
                ${rows}
            </div>
        </div>
    </div>`;
}

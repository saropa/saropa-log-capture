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

/**
 * When the description has no extra notes, still offer expand/collapse if the text is long
 * enough that a multi-line clamp (see CSS) likely truncates. Mirrors ~3–4 wrapped lines.
 */
const INTEGRATIONS_DESCRIPTION_COLLAPSE_THRESHOLD_CHARS = 130;
const PERFORMANCE_WARNING_EMOJI = '⚠️';

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
    const perfNote = splitPerformanceWarning(a.performanceNote);
    const labelWarning = perfNote.warningEmoji
        ? ` <span class="integrations-perf-warning" aria-label="Performance warning">${escapeHtml(perfNote.warningEmoji)}</span>`
        : '';
    let perf = '';
    if (a.performanceNote) {
        perf = `<div class="integrations-note integrations-perf">
            <span class="integrations-note-label">Performance:</span>
            <span>${escapeHtml(perfNote.text)}</span>
        </div>`;
    }
    const when = a.whenToDisable
        ? `<div class="integrations-note integrations-when">When to disable: ${escapeHtml(a.whenToDisable)}</div>`
        : '';
    const searchText = [a.label, longDesc, a.performanceNote ?? '', a.whenToDisable ?? ''].join(' ').toLowerCase();
    const escapedLongDesc = escapeHtml(longDesc);
    const hasExpandable =
        longDesc.length > INTEGRATIONS_DESCRIPTION_COLLAPSE_THRESHOLD_CHARS ||
        !!a.performanceNote ||
        !!a.whenToDisable;

    // Collapsed: line-clamped preview (CSS). Expanded: full text, notes, then "less" toggle at end.
    const descBlock = hasExpandable
        ? `<div class="integrations-desc integrations-desc-collapsible">
                <span class="integrations-desc-preview">${escapedLongDesc}</span>
                <div class="integrations-expanded-block options-filtered-hidden">
                    <span class="integrations-desc-full">${escapedLongDesc}</span>
                    ${perf}
                    ${when}
                </div>
                <button type="button" class="integrations-desc-toggle" data-expanded="false" aria-expanded="false">more</button>
            </div>`
        : `<div class="integrations-desc">
                <span class="integrations-desc-only">${escapedLongDesc}</span>
            </div>`;

    return `
        <label class="integrations-row" title="${escapeHtml(longDesc)}" data-search-text="${escapeHtml(searchText)}">
            <input type="checkbox" id="int-${escapeHtml(a.id)}" data-adapter-id="${escapeHtml(a.id)}" />
            <span class="integrations-label">${escapeHtml(a.label)}${labelWarning}</span>
            ${descBlock}
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
            <p class="integrations-intro">Choose session capture adapters (header lines and sidecars), third-party tools (Crashlytics, Drift, etc.), and in-editor features like Explain with AI. Each row notes performance impact and when you might turn it off.</p>
            <div class="integrations-search-wrapper">
                <input id="integrations-search" type="text" placeholder="Search integrations…" aria-label="Search integrations" />
            </div>
            <div class="options-section" id="integrations-section">
                ${rows}
            </div>
        </div>
    </div>`;
}

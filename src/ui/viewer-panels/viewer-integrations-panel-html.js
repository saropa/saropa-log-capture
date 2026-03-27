"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getIntegrationsPanelHtml = getIntegrationsPanelHtml;
/**
 * HTML for the dedicated Integrations screen shown when the user clicks
 * "Integrations…" in the Options panel. Rendered inside the same slide-out;
 * open/close is handled in viewer-options-panel-script (view switch, no new panel).
 *
 * Includes: back button, intro copy, and one row per adapter with long description,
 * optional performance note, and when-to-disable. Checkboxes use data-adapter-id
 * and are synced from window.integrationAdapters; changes post setIntegrationsAdapters to host.
 */
const ansi_1 = require("../../modules/capture/ansi");
const integrations_ui_1 = require("../../modules/integrations/integrations-ui");
/**
 * When the description has no extra notes, still offer expand/collapse if the text is long
 * enough that a multi-line clamp (see CSS) likely truncates. Mirrors ~3–4 wrapped lines.
 */
const INTEGRATIONS_DESCRIPTION_COLLAPSE_THRESHOLD_CHARS = 130;
const PERFORMANCE_WARNING_EMOJI = '⚠️';
function splitPerformanceWarning(performanceNote) {
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
function renderIntegrationRow(a) {
    const longDesc = a.descriptionLong ?? a.description;
    const perfNote = splitPerformanceWarning(a.performanceNote);
    const labelWarning = perfNote.warningEmoji
        ? ` <span class="integrations-perf-warning" aria-label="Performance warning">${(0, ansi_1.escapeHtml)(perfNote.warningEmoji)}</span>`
        : '';
    let perf = '';
    if (a.performanceNote) {
        perf = `<p class="integrations-note integrations-perf">
            <span class="integrations-note-label">Performance:</span>
            <span>${(0, ansi_1.escapeHtml)(perfNote.text)}</span>
        </p>`;
    }
    const when = a.whenToDisable
        ? `<p class="integrations-note integrations-when">When to disable: ${(0, ansi_1.escapeHtml)(a.whenToDisable)}</p>`
        : '';
    const searchText = [a.label, longDesc, a.performanceNote ?? '', a.whenToDisable ?? ''].join(' ').toLowerCase();
    const escapedLongDesc = (0, ansi_1.escapeHtml)(longDesc);
    const hasExpandable = longDesc.length > INTEGRATIONS_DESCRIPTION_COLLAPSE_THRESHOLD_CHARS ||
        !!a.performanceNote ||
        !!a.whenToDisable;
    const descBlock = hasExpandable
        ? `<p class="integrations-desc integrations-desc-collapsible">
                <span class="integrations-desc-preview">${escapedLongDesc}</span>
                <span class="integrations-expanded-block options-filtered-hidden">
                    <span class="integrations-desc-full">${escapedLongDesc}</span>
                    ${perf}
                    ${when}
                </span>
                <button type="button" class="integrations-desc-toggle" data-expanded="false" aria-expanded="false">more</button>
            </p>`
        : `<p class="integrations-desc">
                <span class="integrations-desc-only">${escapedLongDesc}</span>
            </p>`;
    return `
        <label class="integrations-row" title="${(0, ansi_1.escapeHtml)(longDesc)}" data-search-text="${(0, ansi_1.escapeHtml)(searchText)}">
            <input type="checkbox" id="int-${(0, ansi_1.escapeHtml)(a.id)}" data-adapter-id="${(0, ansi_1.escapeHtml)(a.id)}" />
            <span class="integrations-label">${(0, ansi_1.escapeHtml)(a.label)}${labelWarning}</span>
            ${descBlock}
        </label>`;
}
/** Returns the HTML for the Integrations view (header + back + list). Shown inside the options panel when user clicks Integrations. */
function getIntegrationsPanelHtml() {
    const rows = [...integrations_ui_1.INTEGRATION_ADAPTERS]
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
//# sourceMappingURL=viewer-integrations-panel-html.js.map

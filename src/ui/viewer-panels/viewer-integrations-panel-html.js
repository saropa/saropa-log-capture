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
const marketplace_url_1 = require("../../modules/marketplace-url");
const saropa_lints_api_1 = require("../../modules/misc/saropa-lints-api");
const drift_advisor_constants_1 = require("../../modules/integrations/drift-advisor-constants");
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
/** Extensions that unlock deeper integration features in Log Capture. */
const COMPANION_EXTENSIONS = [
    {
        extensionId: saropa_lints_api_1.SAROPA_LINTS_EXTENSION_ID,
        label: 'Saropa Lints',
        benefit: 'Lint violations in bug reports, OWASP summaries, health scores, and one-click Explain Rule.',
    },
    {
        extensionId: drift_advisor_constants_1.DRIFT_ADVISOR_EXTENSION_ID,
        label: 'Saropa Drift Advisor',
        benefit: 'Query stats, schema health, anomaly counts, index suggestions, and Open in Drift Advisor.',
    },
];
/** Render the companion extensions block shown above the adapter list. */
function renderCompanionExtensionsHtml() {
    const suiteUrl = (0, ansi_1.escapeHtml)((0, marketplace_url_1.buildItemUrl)('saropa.saropa-suite'));
    const rows = COMPANION_EXTENSIONS.map((c) => {
        const url = (0, ansi_1.escapeHtml)((0, marketplace_url_1.buildItemUrl)(c.extensionId));
        return `<div class="integrations-companion-row">
            <span class="integrations-companion-label">${(0, ansi_1.escapeHtml)(c.label)}</span>
            <span class="integrations-companion-benefit">${(0, ansi_1.escapeHtml)(c.benefit)}</span>
            <a class="integrations-companion-link" data-url="${url}" href="#">View in Marketplace</a>
        </div>`;
    }).join('\n');
    return `<div class="integrations-companion-section">
        <div class="integrations-companion-heading">Companion extensions</div>
        <p class="integrations-intro">These Saropa extensions unlock richer diagnostics when installed alongside Log Capture. Each is fully optional.</p>
        ${rows}
        <div class="integrations-companion-row integrations-companion-suite">
            <a class="integrations-companion-link" data-url="${suiteUrl}" href="#">Install all with the Saropa Suite extension pack</a>
        </div>
    </div>`;
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
        perf = `<div class="integrations-note integrations-perf">
            <span class="integrations-note-label">Performance:</span>
            <span>${(0, ansi_1.escapeHtml)(perfNote.text)}</span>
        </div>`;
    }
    const when = a.whenToDisable
        ? `<div class="integrations-note integrations-when">When to disable: ${(0, ansi_1.escapeHtml)(a.whenToDisable)}</div>`
        : '';
    const searchText = [a.label, longDesc, a.performanceNote ?? '', a.whenToDisable ?? ''].join(' ').toLowerCase();
    const escapedLongDesc = (0, ansi_1.escapeHtml)(longDesc);
    const hasExpandable = longDesc.length > INTEGRATIONS_DESCRIPTION_COLLAPSE_THRESHOLD_CHARS ||
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
            <p class="integrations-intro">Choose session capture adapters (header lines and sidecars), third-party tools (Crashlytics, Drift, etc.), and in-editor features like Explain with AI. Each row notes performance impact and when you might turn it off.</p>
            ${renderCompanionExtensionsHtml()}
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
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
import { t } from '../../l10n';
import type { IntegrationAdapterMeta } from '../../modules/integrations/integrations-ui';
import { INTEGRATION_ADAPTERS } from '../../modules/integrations/integrations-ui';
import { buildItemUrl } from '../../modules/marketplace-url';
import { SAROPA_LINTS_EXTENSION_ID } from '../../modules/misc/saropa-lints-api';
import { DRIFT_ADVISOR_EXTENSION_ID } from '../../modules/integrations/drift-advisor-constants';

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

/** Companion extensions that enhance Log Capture when installed. */
interface CompanionExtension {
    readonly extensionId: string;
    /** Brand/product name — stays English. */
    readonly label: string;
    /** l10n key for the benefit prose (resolved via t() at render). */
    readonly benefitKey: string;
}

/** Extensions that unlock deeper integration features in Log Capture. */
const COMPANION_EXTENSIONS: readonly CompanionExtension[] = [
    {
        extensionId: SAROPA_LINTS_EXTENSION_ID,
        label: 'Saropa Lints',
        benefitKey: 'viewer.integrations.companion.lints.benefit',
    },
    {
        extensionId: DRIFT_ADVISOR_EXTENSION_ID,
        label: 'Saropa Drift Advisor',
        benefitKey: 'viewer.integrations.companion.drift.benefit',
    },
];

/** Render the companion extensions block shown above the adapter list. */
function renderCompanionExtensionsHtml(): string {
    const suiteUrl = escapeHtml(buildItemUrl('saropa.saropa-suite'));
    const rows = COMPANION_EXTENSIONS.map((c) => {
        const url = escapeHtml(buildItemUrl(c.extensionId));
        return `<div class="integrations-companion-row">
            <span class="integrations-companion-label">${escapeHtml(c.label)}</span>
            <span class="integrations-companion-benefit">${escapeHtml(t(c.benefitKey))}</span>
            <a class="integrations-companion-link" data-url="${url}" href="#">${t('viewer.integrations.viewInMarketplace')}</a>
        </div>`;
    }).join('\n');
    return `<div class="integrations-companion-section">
        <div class="integrations-companion-heading">${t('viewer.integrations.companionHeading')}</div>
        <p class="integrations-intro">${t('viewer.integrations.companionIntro')}</p>
        ${rows}
        <div class="integrations-companion-row integrations-companion-suite">
            <a class="integrations-companion-link" data-url="${suiteUrl}" href="#">${t('viewer.integrations.installSuite')}</a>
        </div>
    </div>`;
}

/** Build one integration row: checkbox, label, long description, and optional perf/when-to-disable lines. */
function renderIntegrationRow(a: IntegrationAdapterMeta): string {
    const longDesc = a.descriptionLong ?? a.description;
    const perfNote = splitPerformanceWarning(a.performanceNote);
    const labelWarning = perfNote.warningEmoji
        ? ` <span class="integrations-perf-warning" aria-label="${t('viewer.integrations.perfWarningLabel')}">${escapeHtml(perfNote.warningEmoji)}</span>`
        : '';
    let perf = '';
    if (a.performanceNote) {
        perf = `<div class="integrations-note integrations-perf">
            <span class="integrations-note-label">${t('viewer.integrations.perfLabel')}</span>
            <span>${escapeHtml(perfNote.text)}</span>
        </div>`;
    }
    const when = a.whenToDisable
        ? `<div class="integrations-note integrations-when">${t('viewer.integrations.whenToDisable')} ${escapeHtml(a.whenToDisable)}</div>`
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
                <button type="button" class="integrations-desc-toggle" data-expanded="false" aria-expanded="false">${t('viewer.integrations.more')}</button>
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
    <div id="integrations-view" class="integrations-view integrations-view-hidden" role="region" aria-label="${t('viewer.integrations.region')}" aria-hidden="true">
        <div class="integrations-header">
            <button type="button" id="integrations-back" class="integrations-back" title="${t('viewer.integrations.back')}" aria-label="${t('viewer.integrations.back')}"><span class="codicon codicon-arrow-left"></span></button>
            <span class="integrations-title">${t('viewer.integrations.region')}</span>
        </div>
        <div class="integrations-content">
            <p class="integrations-intro">${t('viewer.integrations.intro')}</p>
            <div id="integrations-suite-suggestions" class="integrations-suite-suggestions" aria-live="polite"></div>
            <div id="integrations-suite-issues" class="integrations-suite-issues" aria-live="polite"></div>
            ${renderCompanionExtensionsHtml()}
            <div class="integrations-search-wrapper">
                <input id="integrations-search" type="text" placeholder="${t('viewer.integrations.searchPlaceholder')}" aria-label="${t('viewer.integrations.searchLabel')}" />
            </div>
            <div class="options-section" id="integrations-section">
                ${rows}
            </div>
        </div>
    </div>`;
}

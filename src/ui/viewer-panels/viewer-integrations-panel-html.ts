/**
 * HTML for the dedicated Integrations screen shown when the user clicks
 * "Integrations…" in the Options panel. Rendered inside the same slide-out;
 * open/close is handled in viewer-options-panel-script (view switch, no new panel).
 *
 * Includes: back button, intro copy, and one row per adapter with long description,
 * optional performance note, and when-to-disable. Checkboxes use data-adapter-id
 * and are synced from window.integrationAdapters; changes post setIntegrationsAdapters to host.
 */
import * as vscode from 'vscode';
import { escapeHtml } from '../../modules/capture/ansi';
import { t } from '../../l10n';
import type { IntegrationAdapterMeta } from '../../modules/integrations/integrations-ui';
import { INTEGRATION_ADAPTERS } from '../../modules/integrations/integrations-ui';
import { buildItemUrl } from '../../modules/marketplace-url';
import { SAROPA_LINTS_EXTENSION_ID } from '../../modules/misc/saropa-lints-api';
import { DRIFT_ADVISOR_EXTENSION_ID } from '../../modules/integrations/drift-advisor-constants';

/**
 * Descriptions collapse to a single line (see CSS `-webkit-line-clamp`/nowrap on the preview),
 * so anything wider than roughly one wrapped line gets a "more" toggle. Kept well below a full
 * line's character budget so short one-liners stay inline while real prose earns an expander.
 */
const INTEGRATIONS_DESCRIPTION_COLLAPSE_THRESHOLD_CHARS = 55;
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

/**
 * Shared collapsible description block.
 *
 * Collapsed state is a single line: the preview truncates with an ellipsis and the "more"
 * toggle sits inline at the end of that line (CSS flex; expanded block is display:none so it
 * does not occupy the row). Expanded state hides the preview, shows the full text plus any
 * extra notes at full width, which pushes the same toggle (now "less") onto its own line below.
 */
function renderDescBlock(text: string, expandedExtraHtml: string, expandable: boolean): string {
    const escaped = escapeHtml(text);
    if (!expandable) {
        return `<div class="integrations-desc">
                <span class="integrations-desc-only">${escaped}</span>
            </div>`;
    }
    return `<div class="integrations-desc integrations-desc-collapsible">
                <span class="integrations-desc-preview">${escaped}</span>
                <div class="integrations-expanded-block options-filtered-hidden">
                    <span class="integrations-desc-full">${escaped}</span>
                    ${expandedExtraHtml}
                </div>
                <button type="button" class="integrations-desc-toggle" data-expanded="false" aria-expanded="false">${t('viewer.integrations.more')}</button>
            </div>`;
}

/** A list entry with its sort label so companion links and adapters interleave alphabetically. */
interface IntegrationListEntry {
    readonly label: string;
    readonly html: string;
}

/** Whether a companion extension is currently installed in this VS Code instance. */
function isCompanionInstalled(extensionId: string): boolean {
    return !!vscode.extensions.getExtension(extensionId);
}

/**
 * Companion Saropa extension as a proper list row: a `<label>` with an inline checkbox that
 * mirrors install state (checked+disabled when installed), matching the adapter rows so no
 * consumer has to special-case a checkbox-less variant. The checkbox is always disabled — this
 * panel does not install/uninstall; when the extension is absent a Marketplace link offers it.
 * The checkbox carries NO `data-adapter-id`, so it never enters the adapter-selection payload.
 */
function renderCompanionRow(c: CompanionExtension): IntegrationListEntry {
    const installed = isCompanionInstalled(c.extensionId);
    const url = escapeHtml(buildItemUrl(c.extensionId));
    const benefit = t(c.benefitKey);
    const searchText = [c.label, benefit].join(' ').toLowerCase();
    const expandable = benefit.length > INTEGRATIONS_DESCRIPTION_COLLAPSE_THRESHOLD_CHARS;
    const stateLabel = installed
        ? t('viewer.integrations.companionInstalled')
        : t('viewer.integrations.companionNotInstalled');
    const checkbox = `<input type="checkbox" id="int-companion-${escapeHtml(c.extensionId)}" ${installed ? 'checked ' : ''}disabled title="${escapeHtml(stateLabel)}" aria-label="${escapeHtml(`${c.label}: ${stateLabel}`)}" />`;
    // Marketplace link only when absent; an installed companion is managed from the Extensions view.
    const link = installed
        ? ''
        : `<a class="integrations-companion-link" data-url="${url}" href="#">${t('viewer.integrations.viewInMarketplace')}</a>`;
    const html = `
        <label class="integrations-row integrations-companion-item" title="${escapeHtml(benefit)}" data-search-text="${escapeHtml(searchText)}">
            ${checkbox}
            <span class="integrations-label">${escapeHtml(c.label)}</span>
            ${link}
            ${renderDescBlock(benefit, '', expandable)}
        </label>`;
    return { label: c.label, html };
}

/** Build one integration row: checkbox, label, long description, and optional perf/when-to-disable lines. */
function renderIntegrationRow(a: IntegrationAdapterMeta): IntegrationListEntry {
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
    const hasExpandable =
        longDesc.length > INTEGRATIONS_DESCRIPTION_COLLAPSE_THRESHOLD_CHARS ||
        !!a.performanceNote ||
        !!a.whenToDisable;

    const html = `
        <label class="integrations-row" title="${escapeHtml(longDesc)}" data-search-text="${escapeHtml(searchText)}">
            <input type="checkbox" id="int-${escapeHtml(a.id)}" data-adapter-id="${escapeHtml(a.id)}" />
            <span class="integrations-label">${escapeHtml(a.label)}${labelWarning}</span>
            ${renderDescBlock(longDesc, `${perf}\n${when}`, hasExpandable)}
        </label>`;
    return { label: a.label, html };
}

/** Compact footer link to install the whole Saropa suite; sits below the list, out of the way. */
function renderSuiteInstallFooter(): string {
    const suiteUrl = escapeHtml(buildItemUrl('saropa.saropa-suite'));
    return `<div class="integrations-suite-footer">
        <a class="integrations-companion-link" data-url="${suiteUrl}" href="#">${t('viewer.integrations.installSuite')}</a>
    </div>`;
}

/** Returns the HTML for the Integrations view (header + back + list). Shown inside the options panel when user clicks Integrations. */
export function getIntegrationsPanelHtml(): string {
    // Adapters (checkbox toggles) and companion Saropa extensions (Marketplace links) share one
    // alphabetical list so the real integration points are not buried under a separate prose block.
    const entries: IntegrationListEntry[] = [
        ...INTEGRATION_ADAPTERS.map(renderIntegrationRow),
        ...COMPANION_EXTENSIONS.map(renderCompanionRow),
    ];
    const rows = entries
        .sort((a, b) => a.label.localeCompare(b.label))
        .map((e) => e.html)
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
            <div class="integrations-search-wrapper">
                <input id="integrations-search" type="text" placeholder="${t('viewer.integrations.searchPlaceholder')}" aria-label="${t('viewer.integrations.searchLabel')}" />
            </div>
            <div class="options-section" id="integrations-section">
                ${rows}
            </div>
            ${renderSuiteInstallFooter()}
        </div>
    </div>`;
}

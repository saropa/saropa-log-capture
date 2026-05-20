/**
 * Collections panel HTML and script for the webview.
 *
 * Displays named collections of pinned log sessions and files.
 * Users can rename, merge, and manage collections
 * in a slide-out panel following the icon-bar panel pattern.
 *
 * User-facing strings resolve through t() (host-built HTML) — see strings-viewer-c.ts.
 */

import { t } from '../../l10n';

/** Generate the Collections panel HTML. */
export function getCollectionsPanelHtml(): string {
    return /* html */ `
<div id="collections-panel" class="collections-panel" role="region" aria-label="${t('viewer.collections.region')}">
    <div class="collections-panel-header">
        <span>${t('viewer.collections.header')}</span>
        <button id="collections-panel-close" class="collections-panel-close" title="${t('viewer.collections.close.title')}" aria-label="${t('viewer.collections.close.label')}">
            <span class="codicon codicon-close"></span>
        </button>
    </div>
    <div class="collections-panel-content">
        <!-- Explanation banner (shown when no collections exist, dismissible) -->
        <div id="collections-explainer" class="collections-explainer">
            <div class="collections-explainer-row">
                <p class="collections-explainer-title">${t('viewer.collections.explainerTitle')}</p>
                <button id="collections-explainer-close" class="collections-explainer-close" title="${t('viewer.collections.explainerDismiss.title')}" aria-label="${t('viewer.collections.explainerDismiss.label')}">✕</button>
            </div>
            <p>${t('viewer.collections.explainerBody')}</p>
        </div>
        <!-- Merge controls (shown when 2+ collections exist) -->
        <div id="collections-merge-section" class="collections-merge-section" style="display:none">
            <button id="collections-merge-btn" class="collections-merge-btn">${t('viewer.collections.mergeBtn')}</button>
            <div id="collections-merge-form" class="collections-merge-form" style="display:none">
                <label>${t('viewer.collections.mergeSource')}</label>
                <select id="collections-merge-source" class="collections-merge-select"></select>
                <label>${t('viewer.collections.mergeTarget')}</label>
                <select id="collections-merge-target" class="collections-merge-select"></select>
                <div class="collections-create-actions">
                    <button type="button" id="collections-merge-confirm" class="collections-create-confirm">${t('viewer.collections.mergeConfirm')}</button>
                    <button type="button" id="collections-merge-cancel" class="collections-create-cancel">${t('viewer.collections.mergeCancel')}</button>
                </div>
                <div id="collections-merge-error" class="collections-create-error" style="display:none"></div>
            </div>
        </div>
        <!-- Loading state -->
        <div id="collections-loading" class="collections-loading" style="display:none">${t('viewer.collections.loading')}</div>
        <!-- Collections list -->
        <div id="collections-list" class="collections-list"></div>
    </div>
</div>`;
}

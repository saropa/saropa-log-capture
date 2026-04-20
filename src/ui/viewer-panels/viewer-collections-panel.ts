/**
 * Collections panel HTML and script for the webview.
 *
 * Displays named collections of pinned log sessions and files.
 * Users can rename, merge, and manage collections
 * in a slide-out panel following the icon-bar panel pattern.
 */

/** Generate the Collections panel HTML. */
export function getCollectionsPanelHtml(): string {
    return /* html */ `
<div id="collections-panel" class="collections-panel" role="region" aria-label="Collections">
    <div class="collections-panel-header">
        <span>Collections</span>
        <button id="collections-panel-close" class="collections-panel-close" title="Close" aria-label="Close Collections">
            <span class="codicon codicon-close"></span>
        </button>
    </div>
    <div class="collections-panel-content">
        <!-- Explanation banner (shown when no collections exist, dismissible) -->
        <div id="collections-explainer" class="collections-explainer">
            <div class="collections-explainer-row">
                <p class="collections-explainer-title">What are Collections?</p>
                <button id="collections-explainer-close" class="collections-explainer-close" title="Dismiss" aria-label="Dismiss explainer">\u2715</button>
            </div>
            <p>Group related log sessions and files together for a bug, feature, or incident. Right-click on a log and choose "Add to Collection" to get started.</p>
        </div>
        <!-- Merge controls (shown when 2+ collections exist) -->
        <div id="collections-merge-section" class="collections-merge-section" style="display:none">
            <button id="collections-merge-btn" class="collections-merge-btn">Merge two collections…</button>
            <div id="collections-merge-form" class="collections-merge-form" style="display:none">
                <label>Source (will be deleted):</label>
                <select id="collections-merge-source" class="collections-merge-select"></select>
                <label>Target (will keep its name):</label>
                <select id="collections-merge-target" class="collections-merge-select"></select>
                <div class="collections-create-actions">
                    <button type="button" id="collections-merge-confirm" class="collections-create-confirm">Merge</button>
                    <button type="button" id="collections-merge-cancel" class="collections-create-cancel">Cancel</button>
                </div>
                <div id="collections-merge-error" class="collections-create-error" style="display:none"></div>
            </div>
        </div>
        <!-- Loading state -->
        <div id="collections-loading" class="collections-loading" style="display:none">Loading…</div>
        <!-- Collections list -->
        <div id="collections-list" class="collections-list"></div>
    </div>
</div>`;
}

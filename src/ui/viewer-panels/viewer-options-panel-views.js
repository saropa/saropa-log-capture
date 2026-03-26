"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOptionsPanelViewsScript = getOptionsPanelViewsScript;
/** Returns script chunk for options sub-views and UI sync helpers. */
function getOptionsPanelViewsScript() {
    return /* javascript */ `
/** Sync integrations checkboxes from window.integrationAdapters (set by host message). */
function syncIntegrationsUi() {
    var adapterIds = (typeof window !== 'undefined' && window.integrationAdapters) ? window.integrationAdapters : [];
    var set = {};
    for (var i = 0; i < adapterIds.length; i++) set[adapterIds[i]] = true;
    var section = document.getElementById('integrations-section');
    if (!section) return;
    var inputs = section.querySelectorAll('input[data-adapter-id]');
    for (var j = 0; j < inputs.length; j++) {
        var id = inputs[j].getAttribute('data-adapter-id');
        if (id) inputs[j].checked = !!set[id];
    }
}

var integrationsViewOpen = false;

/** Show the Integrations screen (hide options content). Syncs checkboxes from window.integrationAdapters. */
function openIntegrationsView() {
    if (shortcutsViewOpen) closeShortcutsView();
    var optionsContent = document.querySelector('#options-panel .options-content');
    var optionsSearch = document.querySelector('#options-panel .options-search-wrapper');
    var integrationsView = document.getElementById('integrations-view');
    if (!integrationsView || !optionsContent) return;
    integrationsViewOpen = true;
    if (optionsContent) optionsContent.classList.add('options-content-hidden');
    if (optionsSearch) optionsSearch.classList.add('options-content-hidden');
    integrationsView.classList.remove('integrations-view-hidden');
    integrationsView.setAttribute('aria-hidden', 'false');
    var integrationsSearch = document.getElementById('integrations-search');
    if (integrationsSearch) {
        integrationsSearch.value = '';
        if (typeof filterIntegrations === 'function') filterIntegrations('');
    }
    syncIntegrationsUi();
}

/** Hide the Integrations screen (show options content). */
function closeIntegrationsView() {
    var optionsContent = document.querySelector('#options-panel .options-content');
    var optionsSearch = document.querySelector('#options-panel .options-search-wrapper');
    var integrationsView = document.getElementById('integrations-view');
    if (!integrationsView || !optionsContent) return;
    integrationsViewOpen = false;
    if (optionsContent) optionsContent.classList.remove('options-content-hidden');
    if (optionsSearch) optionsSearch.classList.remove('options-content-hidden');
    integrationsView.classList.add('integrations-view-hidden');
    integrationsView.setAttribute('aria-hidden', 'true');
    var integrationsSearch = document.getElementById('integrations-search');
    if (integrationsSearch) integrationsSearch.value = '';
    if (typeof filterIntegrations === 'function') filterIntegrations('');
}

var shortcutsViewOpen = false;

/** Show the Keyboard Shortcuts screen (hide options content). Content is static HTML; no sync needed. */
function openShortcutsView() {
    if (integrationsViewOpen) closeIntegrationsView();
    var optionsContent = document.querySelector('#options-panel .options-content');
    var optionsSearch = document.querySelector('#options-panel .options-search-wrapper');
    var shortcutsView = document.getElementById('shortcuts-view');
    if (!shortcutsView || !optionsContent) return;
    shortcutsViewOpen = true;
    if (optionsContent) optionsContent.classList.add('options-content-hidden');
    if (optionsSearch) optionsSearch.classList.add('options-content-hidden');
    shortcutsView.classList.remove('shortcuts-view-hidden');
    shortcutsView.setAttribute('aria-hidden', 'false');
}

/** Hide the Keyboard Shortcuts screen (show options content). */
function closeShortcutsView() {
    var optionsContent = document.querySelector('#options-panel .options-content');
    var optionsSearch = document.querySelector('#options-panel .options-search-wrapper');
    var shortcutsView = document.getElementById('shortcuts-view');
    if (!shortcutsView || !optionsContent) return;
    shortcutsViewOpen = false;
    if (optionsContent) optionsContent.classList.remove('options-content-hidden');
    if (optionsSearch) optionsSearch.classList.remove('options-content-hidden');
    shortcutsView.classList.add('shortcuts-view-hidden');
    shortcutsView.setAttribute('aria-hidden', 'true');
}
`;
}
//# sourceMappingURL=viewer-options-panel-views.js.map
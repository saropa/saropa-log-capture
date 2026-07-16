/** Returns integration-specific options handlers to keep generic options events small. */
export function getOptionsIntegrationsHelperScript(): string {
    return /* javascript */ `
/**
 * Apply live companion install-state from the host's setCompanionInstalled message.
 * For each companion row: toggles is-installed (which hides the Marketplace link), sets the
 * checkbox checked, and — because the checkbox is an install control — disables it once installed
 * and re-enables it when absent (so it stays actionable). Title/aria come from the row's data-*
 * labels — no re-render, no l10n round-trip. Unknown / missing ids are left untouched so a partial
 * payload is safe. The last payload is cached on window so openIntegrationsView can re-apply it
 * (covers a message that arrived before the rows/handlers were ready, or a future re-render).
 */
function applyCompanionInstalled(states) {
    if (!states || typeof states !== 'object') return;
    if (typeof window !== 'undefined') window.__companionInstalledStates = states;
    var rows = document.querySelectorAll('.integrations-companion-item[data-companion-id]');
    for (var i = 0; i < rows.length; i++) {
        var row = rows[i];
        var id = row.getAttribute('data-companion-id');
        if (!id || !Object.prototype.hasOwnProperty.call(states, id)) continue;
        var installed = !!states[id];
        row.classList.toggle('is-installed', installed);
        var cb = row.querySelector('input[type="checkbox"]');
        if (!cb) continue;
        cb.checked = installed;
        cb.disabled = installed;
        var title = installed ? row.getAttribute('data-installed-title') : row.getAttribute('data-not-installed-title');
        if (title) {
            cb.title = title;
            var label = row.getAttribute('data-label') || '';
            cb.setAttribute('aria-label', installed ? (label + ': ' + title) : title);
        }
    }
}

/** Filter integrations rows by query text from integration metadata. */
function filterIntegrations(query) {
    var integrationsSection = document.getElementById('integrations-section');
    if (!integrationsSection) return;
    var q = (query || '').toLowerCase().trim();
    var rows = integrationsSection.querySelectorAll('.integrations-row');
    for (var i = 0; i < rows.length; i++) {
        var row = rows[i];
        var hay = (row.getAttribute('data-search-text') || '').toLowerCase();
        var visible = !q || hay.indexOf(q) >= 0;
        row.classList.toggle('options-filtered-hidden', !visible);
    }
}

/** Wire integration search, expand/collapse, and adapter change events. */
function initIntegrationsOptionsHandlers() {
    var integrationsSection = document.getElementById('integrations-section');
    var integrationsSearch = document.getElementById('integrations-search');
    if (integrationsSection) {
        integrationsSection.addEventListener('click', function(e) {
            /* Companion rows carry a Marketplace link instead of a toggle checkbox. */
            var companionLink = e.target && e.target.closest && e.target.closest('.integrations-companion-link');
            if (companionLink) {
                e.preventDefault();
                var companionUrl = companionLink.getAttribute('data-url');
                if (companionUrl && typeof vscodeApi !== 'undefined' && vscodeApi.postMessage) {
                    vscodeApi.postMessage({ type: 'openUrl', url: companionUrl });
                }
                return;
            }
            var toggleBtn = e.target && e.target.closest && e.target.closest('.integrations-desc-toggle');
            if (!toggleBtn) return;
            e.preventDefault();
            e.stopPropagation();
            var row = toggleBtn.closest('.integrations-row');
            if (!row) return;
            var previewEl = row.querySelector('.integrations-desc-preview');
            var expandedBlock = row.querySelector('.integrations-expanded-block');
            if (!previewEl || !expandedBlock) return;
            var expanded = toggleBtn.getAttribute('data-expanded') === 'true';
            var nextExpanded = !expanded;
            previewEl.classList.toggle('options-filtered-hidden', nextExpanded);
            expandedBlock.classList.toggle('options-filtered-hidden', !nextExpanded);
            toggleBtn.setAttribute('data-expanded', nextExpanded ? 'true' : 'false');
            toggleBtn.setAttribute('aria-expanded', nextExpanded ? 'true' : 'false');
            toggleBtn.textContent = nextExpanded ? 'less' : 'more';
        });
        integrationsSection.addEventListener('change', function(e) {
            /* Companion install checkbox: checking an absent companion requests an install and
               reverts the box — the host installs, then the live feed re-checks it on success. */
            if (e.target && e.target.matches && e.target.matches('.integrations-companion-check')) {
                var row = e.target.closest('.integrations-companion-item');
                var extId = e.target.getAttribute('data-extension-id');
                if (extId && e.target.checked && row && !row.classList.contains('is-installed')) {
                    e.target.checked = false;
                    if (typeof vscodeApi !== 'undefined' && vscodeApi.postMessage) {
                        vscodeApi.postMessage({ type: 'installCompanion', extensionId: extId });
                    }
                }
                return;
            }
            if (!e.target || !e.target.matches || !e.target.matches('input[data-adapter-id]')) return;
            var inputs = integrationsSection.querySelectorAll('input[data-adapter-id]:checked');
            var adapterIds = [];
            for (var i = 0; i < inputs.length; i++) {
                var id = inputs[i].getAttribute('data-adapter-id');
                if (id) adapterIds.push(id);
            }
            if (typeof vscodeApi !== 'undefined' && vscodeApi.postMessage) {
                vscodeApi.postMessage({ type: 'setIntegrationsAdapters', adapterIds: adapterIds });
            }
        });
    }
    if (integrationsSearch) {
        integrationsSearch.addEventListener('input', function(e) {
            filterIntegrations(e.target.value);
        });
    }

    /* "Install all with the Saropa Suite" footer link (below the list, outside the section). */
    var suiteFooter = document.querySelector('.integrations-suite-footer');
    if (suiteFooter) {
        suiteFooter.addEventListener('click', function(e) {
            var link = e.target && e.target.closest && e.target.closest('.integrations-companion-link');
            if (!link) return;
            e.preventDefault();
            var url = link.getAttribute('data-url');
            if (url && typeof vscodeApi !== 'undefined' && vscodeApi.postMessage) {
                vscodeApi.postMessage({ type: 'openUrl', url: url });
            }
        });
    }
}

initIntegrationsOptionsHandlers();
`;
}

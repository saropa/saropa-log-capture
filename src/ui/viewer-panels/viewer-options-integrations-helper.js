"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOptionsIntegrationsHelperScript = getOptionsIntegrationsHelperScript;
/** Returns integration-specific options handlers to keep generic options events small. */
function getOptionsIntegrationsHelperScript() {
    return /* javascript */ `
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
}

initIntegrationsOptionsHandlers();
`;
}
//# sourceMappingURL=viewer-options-integrations-helper.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSessionInvestigationsScript = getSessionInvestigationsScript;
/**
 * Session panel: investigations list and create-investigation form script.
 * Inlined into the same IIFE as viewer-session-panel so sessionDisplayOptions,
 * cachedSessions, createInvestigationInProgress and DOM refs are in scope.
 */
function getSessionInvestigationsScript() {
    return `
    function setCreateInvestigationLoading(loading) {
        createInvestigationInProgress = loading;
        var input = document.getElementById('session-investigations-name-input');
        var confirmBtn = document.getElementById('session-investigations-create-confirm');
        if (input) input.disabled = loading;
        if (confirmBtn) {
            confirmBtn.disabled = loading;
            confirmBtn.textContent = loading ? 'Creating…' : 'Create';
        }
    }

    function showCreateInvestigationForm(show) {
        var row = document.getElementById('session-investigations-create-row');
        var form = document.getElementById('session-investigations-create-form');
        var input = document.getElementById('session-investigations-name-input');
        var errEl = document.getElementById('session-investigations-create-error');
        if (row) row.style.display = show ? 'none' : '';
        if (form) form.style.display = show ? 'flex' : 'none';
        if (input) {
            input.value = '';
            input.disabled = createInvestigationInProgress;
            if (show) {
                input.focus();
            }
        }
        if (errEl) { errEl.style.display = 'none'; errEl.textContent = ''; }
        var confirmBtn = document.getElementById('session-investigations-create-confirm');
        if (confirmBtn) {
            confirmBtn.disabled = createInvestigationInProgress;
            confirmBtn.textContent = createInvestigationInProgress ? 'Creating…' : 'Create';
        }
    }

    function renderInvestigationsList(data) {
        var listEl = document.getElementById('session-investigations-list');
        var createBtn = document.getElementById('session-investigations-create');
        if (!listEl) return;
        var invs = data.investigations || [];
        var activeId = data.activeId || '';
        if (invs.length === 0) {
            listEl.innerHTML = '';
        } else {
            listEl.innerHTML = invs.map(function(inv) {
                var active = inv.id === activeId ? ' session-investigation-active' : '';
                var label = inv.name + (inv.sourceCount ? ' (' + inv.sourceCount + ')' : '');
                var activeMark = inv.id === activeId ? ' <span class="session-investigation-check">&#10003;</span>' : '';
                return '<div class="session-investigation-item' + active + '" data-investigation-id="' + escapeAttr(inv.id) + '">' + escapeHtmlText(label) + activeMark + '</div>';
            }).join('');
        }
        if (createBtn) {
            createBtn.onclick = function() { showCreateInvestigationForm(true); };
        }
        listEl.querySelectorAll('.session-investigation-item').forEach(function(el) {
            el.addEventListener('click', function() {
                var id = el.getAttribute('data-investigation-id');
                if (id) vscodeApi.postMessage({ type: 'openInvestigationById', id: id });
            });
        });
        showCreateInvestigationForm(false);
    }

    function bindCreateInvestigationForm() {
        var form = document.getElementById('session-investigations-create-form');
        var input = document.getElementById('session-investigations-name-input');
        var confirmBtn = document.getElementById('session-investigations-create-confirm');
        var cancelBtn = document.getElementById('session-investigations-create-cancel');
        var errEl = document.getElementById('session-investigations-create-error');
        if (!form || !input || !confirmBtn || !cancelBtn || !errEl) return;
        function hideError() { errEl.style.display = 'none'; errEl.textContent = ''; }
        function showError(msg) { errEl.textContent = msg; errEl.style.display = ''; }
        function submit() {
            if (createInvestigationInProgress) return;
            var name = (input.value || '').trim();
            if (!name) { showError('Name is required'); return; }
            if (name.length > 100) { showError('Name must be 100 characters or less'); return; }
            hideError();
            setCreateInvestigationLoading(true);
            vscodeApi.postMessage({ type: 'createInvestigationWithName', name: name });
        }
        confirmBtn.addEventListener('click', submit);
        input.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') { e.preventDefault(); submit(); }
            if (e.key === 'Escape') { e.preventDefault(); showCreateInvestigationForm(false); }
        });
        cancelBtn.addEventListener('click', function() { showCreateInvestigationForm(false); });
    }

    function escapeAttr(str) { return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;'); }
    function escapeHtmlText(str) { return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
`;
}
//# sourceMappingURL=viewer-session-panel-investigations.js.map
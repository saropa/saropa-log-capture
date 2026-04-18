/**
 * Session panel: collections list and create-collection form script.
 * Inlined into the same IIFE as viewer-session-panel so sessionDisplayOptions,
 * cachedSessions, createCollectionInProgress and DOM refs are in scope.
 */
export function getSessionCollectionsScript(): string {
  return `
    function setCreateCollectionLoading(loading) {
        createCollectionInProgress = loading;
        var input = document.getElementById('session-collections-name-input');
        var confirmBtn = document.getElementById('session-collections-create-confirm');
        if (input) input.disabled = loading;
        if (confirmBtn) {
            confirmBtn.disabled = loading;
            confirmBtn.textContent = loading ? 'Creating…' : 'Create';
        }
    }

    function showCreateCollectionForm(show) {
        var row = document.getElementById('session-collections-create-row');
        var form = document.getElementById('session-collections-create-form');
        var input = document.getElementById('session-collections-name-input');
        var errEl = document.getElementById('session-collections-create-error');
        if (row) row.style.display = show ? 'none' : '';
        if (form) form.style.display = show ? 'flex' : 'none';
        if (input) {
            input.value = '';
            input.disabled = createCollectionInProgress;
            if (show) {
                input.focus();
            }
        }
        if (errEl) { errEl.style.display = 'none'; errEl.textContent = ''; }
        var confirmBtn = document.getElementById('session-collections-create-confirm');
        if (confirmBtn) {
            confirmBtn.disabled = createCollectionInProgress;
            confirmBtn.textContent = createCollectionInProgress ? 'Creating…' : 'Create';
        }
    }

    function renderCollectionsList(data) {
        var listEl = document.getElementById('session-collections-list');
        var createBtn = document.getElementById('session-collections-create');
        if (!listEl) return;
        var invs = data.collections || [];
        var activeId = data.activeId || '';
        if (invs.length === 0) {
            listEl.innerHTML = '';
        } else {
            listEl.innerHTML = invs.map(function(inv) {
                var active = inv.id === activeId ? ' session-collection-active' : '';
                var label = inv.name + (inv.sourceCount ? ' (' + inv.sourceCount + ')' : '');
                var activeMark = inv.id === activeId ? ' <span class="session-collection-check">&#10003;</span>' : '';
                return '<div class="session-collection-item' + active + '" data-collection-id="' + escapeAttr(inv.id) + '">' + escapeHtmlText(label) + activeMark + '</div>';
            }).join('');
        }
        if (createBtn) {
            createBtn.onclick = function() { showCreateCollectionForm(true); };
        }
        listEl.querySelectorAll('.session-collection-item').forEach(function(el) {
            el.addEventListener('click', function() {
                var id = el.getAttribute('data-collection-id');
                if (id) vscodeApi.postMessage({ type: 'openCollectionById', id: id });
            });
        });
        showCreateCollectionForm(false);
    }

    function bindCreateCollectionForm() {
        var form = document.getElementById('session-collections-create-form');
        var input = document.getElementById('session-collections-name-input');
        var confirmBtn = document.getElementById('session-collections-create-confirm');
        var cancelBtn = document.getElementById('session-collections-create-cancel');
        var errEl = document.getElementById('session-collections-create-error');
        if (!form || !input || !confirmBtn || !cancelBtn || !errEl) return;
        function hideError() { errEl.style.display = 'none'; errEl.textContent = ''; }
        function showError(msg) { errEl.textContent = msg; errEl.style.display = ''; }
        function submit() {
            if (createCollectionInProgress) return;
            var name = (input.value || '').trim();
            if (!name) { showError('Name is required'); return; }
            if (name.length > 100) { showError('Name must be 100 characters or less'); return; }
            hideError();
            setCreateCollectionLoading(true);
            vscodeApi.postMessage({ type: 'createCollectionWithName', name: name });
        }
        confirmBtn.addEventListener('click', submit);
        input.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') { e.preventDefault(); submit(); }
            if (e.key === 'Escape') { e.preventDefault(); showCreateCollectionForm(false); }
        });
        cancelBtn.addEventListener('click', function() { showCreateCollectionForm(false); });
    }

    function escapeAttr(str) { return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;'); }
    function escapeHtmlText(str) { return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
`;
}

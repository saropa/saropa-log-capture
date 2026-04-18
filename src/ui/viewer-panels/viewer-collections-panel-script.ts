/**
 * Collections panel script: rename, merge, and manage collections.
 *
 * Follows the same IIFE pattern as other viewer panels.
 * Webview messages: requestCollections, renameCollection,
 * mergeCollections, openCollectionById, deleteCollection.
 */

/** Generate the Collections panel script (IIFE). */
export function getCollectionsPanelScript(): string {
    return /* js */ `
(function() {
    var panel = document.getElementById('collections-panel');
    var panelOpen = false;
    var collectionsData = [];
    var activeId = '';
    var explainerDismissed = false;

    /* ---- Open / Close ---- */

    window.openCollectionsPanel = function() {
        if (!panel) return;
        panelOpen = true;
        panel.classList.add('visible');
        vscodeApi.postMessage({ type: 'requestCollections' });
        var loadEl = document.getElementById('collections-loading');
        if (loadEl) loadEl.style.display = '';
    };

    window.closeCollectionsPanel = function() {
        if (!panel) return;
        panel.classList.remove('visible');
        panelOpen = false;
        if (typeof clearActivePanel === 'function') clearActivePanel('collections');
    };

    var closeBtn = document.getElementById('collections-panel-close');
    if (closeBtn) closeBtn.addEventListener('click', closeCollectionsPanel);

    /* ---- Explainer dismiss ---- */

    var explainerCloseBtn = document.getElementById('collections-explainer-close');
    if (explainerCloseBtn) explainerCloseBtn.addEventListener('click', function() {
        explainerDismissed = true;
        var explainer = document.getElementById('collections-explainer');
        if (explainer) explainer.style.display = 'none';
    });

    /* ---- Helpers ---- */

    function esc(s) { return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

    function formatAgo(ms) {
        if (ms == null || !Number.isFinite(ms)) return '';
        var d = Date.now() - ms;
        if (d < 60000) return 'just now';
        if (d < 3600000) return Math.floor(d / 60000) + ' min ago';
        if (d < 86400000) return Math.floor(d / 3600000) + 'h ago';
        if (d < 604800000) return Math.floor(d / 86400000) + ' days ago';
        return Math.floor(d / 604800000) + 'w ago';
    }

    /* ---- Render ---- */

    function render() {
        var listEl = document.getElementById('collections-list');
        var explainer = document.getElementById('collections-explainer');
        var mergeSection = document.getElementById('collections-merge-section');
        if (!listEl) return;

        /* Show explainer only when empty and not dismissed */
        if (explainer) explainer.style.display = (collectionsData.length === 0 && !explainerDismissed) ? '' : 'none';
        /* Show merge only when 2+ collections */
        if (mergeSection) mergeSection.style.display = collectionsData.length >= 2 ? '' : 'none';

        if (collectionsData.length === 0) {
            listEl.innerHTML = '<p class="collections-empty">No collections yet.</p>';
            return;
        }

        listEl.innerHTML = collectionsData.map(function(c) {
            var isActive = c.id === activeId;
            var srcCount = c.sourceCount != null ? c.sourceCount : 0;
            var srcText = srcCount + ' source' + (srcCount === 1 ? '' : 's');
            var agoText = c.updatedAt ? formatAgo(c.updatedAt) : '';
            var meta = [srcText, agoText].filter(Boolean).join(' \\u00b7 ');
            var activeCls = isActive ? ' collections-item-active' : '';
            var activeCheck = isActive ? '<span class="collections-item-check">\\u2713</span>' : '';
            return '<div class="collections-item' + activeCls + '" data-id="' + esc(c.id) + '">'
                + '<div class="collections-item-header">'
                + '<span class="collections-item-name" data-id="' + esc(c.id) + '">' + esc(c.name) + '</span>'
                + activeCheck
                + '</div>'
                + '<div class="collections-item-meta">' + esc(meta) + '</div>'
                + '<div class="collections-item-actions">'
                + '<button class="collections-action-btn collections-rename-btn" data-id="' + esc(c.id) + '" data-name="' + esc(c.name) + '" title="Rename">\\u270E</button>'
                + '<button class="collections-action-btn collections-open-btn" data-id="' + esc(c.id) + '" title="Open">'
                + '<span class="codicon codicon-folder-opened"></span></button>'
                + '<button class="collections-action-btn collections-delete-btn" data-id="' + esc(c.id) + '" title="Delete">'
                + '<span class="codicon codicon-trash"></span></button>'
                + '</div>'
                + '</div>';
        }).join('');

        /* Populate merge selects */
        updateMergeSelects();
    }

    /* ---- Rename ---- */

    function promptRename(id, currentName) {
        /* Inline rename: replace the name span with an input */
        var nameEl = document.querySelector('.collections-item-name[data-id="' + id + '"]');
        if (!nameEl) return;
        var input = document.createElement('input');
        input.type = 'text';
        input.className = 'collections-rename-input';
        input.value = currentName;
        input.maxLength = 100;
        var cancelled = false;
        nameEl.replaceWith(input);
        input.focus();
        input.select();

        function commit() {
            /* Guard: Escape sets cancelled=true before blur fires from DOM removal */
            if (cancelled) return;
            var newName = (input.value || '').trim();
            if (!newName || newName === currentName) { render(); return; }
            vscodeApi.postMessage({ type: 'renameCollection', id: id, name: newName });
        }
        input.addEventListener('blur', commit);
        input.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
            if (e.key === 'Escape') { e.preventDefault(); cancelled = true; render(); }
        });
    }

    /* ---- Merge ---- */

    var mergeBtn = document.getElementById('collections-merge-btn');
    var mergeForm = document.getElementById('collections-merge-form');
    var mergeSource = document.getElementById('collections-merge-source');
    var mergeTarget = document.getElementById('collections-merge-target');
    var mergeConfirm = document.getElementById('collections-merge-confirm');
    var mergeCancel = document.getElementById('collections-merge-cancel');
    var mergeError = document.getElementById('collections-merge-error');

    function showMergeForm(show) {
        if (mergeBtn) mergeBtn.style.display = show ? 'none' : '';
        if (mergeForm) mergeForm.style.display = show ? 'flex' : 'none';
        if (mergeError) { mergeError.style.display = 'none'; mergeError.textContent = ''; }
        if (show) updateMergeSelects();
    }

    function updateMergeSelects() {
        if (!mergeSource || !mergeTarget) return;
        var opts = collectionsData.map(function(c) {
            return '<option value="' + esc(c.id) + '">' + esc(c.name) + '</option>';
        }).join('');
        mergeSource.innerHTML = opts;
        mergeTarget.innerHTML = opts;
        /* Default target to second item so they differ */
        if (collectionsData.length >= 2) mergeTarget.selectedIndex = 1;
    }

    if (mergeBtn) mergeBtn.addEventListener('click', function() { showMergeForm(true); });
    if (mergeCancel) mergeCancel.addEventListener('click', function() { showMergeForm(false); });
    if (mergeConfirm) mergeConfirm.addEventListener('click', function() {
        if (!mergeSource || !mergeTarget) return;
        var sourceId = mergeSource.value;
        var targetId = mergeTarget.value;
        if (sourceId === targetId) {
            if (mergeError) { mergeError.textContent = 'Source and target must be different'; mergeError.style.display = ''; }
            return;
        }
        vscodeApi.postMessage({ type: 'mergeCollections', sourceId: sourceId, targetId: targetId });
        showMergeForm(false);
    });

    /* ---- List click delegation ---- */

    var listEl = document.getElementById('collections-list');
    if (listEl) listEl.addEventListener('click', function(e) {
        var renameBtn = e.target.closest('.collections-rename-btn');
        if (renameBtn) { e.stopPropagation(); promptRename(renameBtn.dataset.id, renameBtn.dataset.name); return; }

        var openBtn = e.target.closest('.collections-open-btn');
        if (openBtn) { e.stopPropagation(); vscodeApi.postMessage({ type: 'openCollectionById', id: openBtn.dataset.id }); return; }

        var deleteBtn = e.target.closest('.collections-delete-btn');
        if (deleteBtn) { e.stopPropagation(); vscodeApi.postMessage({ type: 'deleteCollectionConfirm', id: deleteBtn.dataset.id }); return; }

        /* Click on item row opens it */
        var item = e.target.closest('.collections-item');
        if (item && item.dataset.id) { vscodeApi.postMessage({ type: 'openCollectionById', id: item.dataset.id }); }
    });

    /* ---- Messages from extension ---- */

    window.addEventListener('message', function(e) {
        if (!e.data) return;

        /* Extension requests to open the collections panel (e.g. after add-to-collection) */
        if (e.data.type === 'openCollectionsPanel') {
            if (typeof setActivePanel === 'function') setActivePanel('collections');
            return;
        }

        if (e.data.type === 'collectionsList') {
            collectionsData = e.data.collections || [];
            activeId = e.data.activeId || '';
            var loadEl = document.getElementById('collections-loading');
            if (loadEl) loadEl.style.display = 'none';
            render();
            /* Update icon bar badge with collection count. */
            if (typeof updateIconBadge === 'function') updateIconBadge('ib-collections-badge', 'ib-collections-count', collectionsData.length);
        }

        if (e.data.type === 'collectionRenamed' || e.data.type === 'collectionsMerged' || e.data.type === 'collectionDeleted') {
            /* Re-request updated list after any mutation */
            vscodeApi.postMessage({ type: 'requestCollections' });
        }
    });

    /* Click outside to close */
    document.addEventListener('click', function(e) {
        if (!panelOpen) return;
        if (panel && panel.contains(e.target)) return;
        var ibBtn = document.getElementById('ib-collections');
        if (ibBtn && (ibBtn === e.target || ibBtn.contains(e.target))) return;
        closeCollectionsPanel();
    });
})();
`;
}

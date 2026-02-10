/**
 * Trash panel HTML and script for the webview.
 *
 * Displays trashed log sessions in a dedicated slide-out panel.
 * Follows the same pattern as the bookmark panel.
 */

/** Generate the trash panel HTML. */
export function getTrashPanelHtml(): string {
    return /* html */ `
<div id="trash-panel" class="trash-panel">
    <div class="trash-panel-header">
        <span>Trash</span>
        <div class="trash-panel-actions">
            <button id="trash-empty-all" class="trash-panel-action" title="Empty Trash">
                <span class="codicon codicon-clear-all"></span>
            </button>
            <button id="trash-panel-close" class="trash-panel-close" title="Close">&times;</button>
        </div>
    </div>
    <div class="trash-panel-content">
        <div id="trash-list"></div>
        <div id="trash-empty" class="trash-empty">No trashed sessions</div>
    </div>
</div>`;
}

/** Generate the trash panel script. */
export function getTrashPanelScript(): string {
    return /* js */ `
(function() {
    var trashPanelEl = document.getElementById('trash-panel');
    var trashListEl = document.getElementById('trash-list');
    var trashEmptyEl = document.getElementById('trash-empty');
    var trashPanelOpen = false;

    window.openTrashPanel = function() {
        if (!trashPanelEl) return;
        trashPanelOpen = true;
        trashPanelEl.classList.add('visible');
        vscodeApi.postMessage({ type: 'requestSessionList' });
    };

    window.closeTrashPanel = function() {
        if (!trashPanelEl) return;
        trashPanelEl.classList.remove('visible');
        trashPanelOpen = false;
        if (typeof clearActivePanel === 'function') clearActivePanel('trash');
    };

    /* ---- Rendering ---- */

    function renderTrashList(sessions) {
        var trashed = (sessions || []).filter(function(s) { return !!s.trashed; });
        updateTrashBadge(trashed.length);
        if (!trashListEl) return;
        if (trashed.length === 0) {
            trashListEl.innerHTML = '';
            if (trashEmptyEl) trashEmptyEl.style.display = '';
            return;
        }
        if (trashEmptyEl) trashEmptyEl.style.display = 'none';
        trashed.sort(function(a, b) { return (b.mtime || 0) - (a.mtime || 0); });
        trashListEl.innerHTML = trashed.map(renderTrashItem).join('');
    }

    function renderTrashItem(s) {
        var name = s.displayName || s.filename;
        var meta = buildTrashMeta(s);
        var dots = renderSeverityDots(s);
        return '<div class="trash-item" data-uri="' + escapeAttr(s.uriString || '') + '" data-filename="' + escapeAttr(s.filename || '') + '">'
            + '<span class="trash-item-icon"><span class="codicon codicon-trash"></span></span>'
            + '<div class="trash-item-info">'
            + '<span class="trash-item-name">' + escapeHtml(name) + '</span>'
            + (meta ? '<span class="trash-item-meta">' + escapeHtml(meta) + '</span>' : '')
            + dots + '</div></div>';
    }

    function buildTrashMeta(s) {
        var parts = [];
        if (s.adapter) parts.push(s.adapter);
        if (s.formattedMtime) parts.push(s.formattedMtime);
        if (s.lineCount > 0) parts.push(s.lineCount.toLocaleString('en-US') + ' lines');
        if (s.durationMs > 0) parts.push(formatSessionDuration(s.durationMs));
        if (s.size) parts.push(formatSessionSize(s.size));
        return parts.join(' \\u00b7 ');
    }

    function updateTrashBadge(count) {
        var badge = document.getElementById('ib-trash-badge');
        if (!badge) return;
        badge.textContent = count > 99 ? '99+' : String(count);
        badge.style.display = count > 0 ? 'inline-block' : 'none';
    }

    /* ---- Click handlers ---- */

    if (trashListEl) {
        trashListEl.addEventListener('click', function(e) {
            var item = e.target.closest('.trash-item');
            if (!item) return;
            vscodeApi.postMessage({ type: 'openSessionFromPanel', uriString: item.getAttribute('data-uri') || '' });
        });
        trashListEl.addEventListener('contextmenu', function(e) {
            var item = e.target.closest('.trash-item');
            if (!item) return;
            e.preventDefault();
            if (typeof showSessionContextMenu === 'function') {
                showSessionContextMenu(e.clientX, e.clientY, item.getAttribute('data-uri') || '', item.getAttribute('data-filename') || '', true);
            }
        });
    }

    /* ---- Empty trash button ---- */

    var emptyBtn = document.getElementById('trash-empty-all');
    if (emptyBtn) emptyBtn.addEventListener('click', function() {
        vscodeApi.postMessage({ type: 'sessionAction', action: 'emptyTrash' });
    });

    /* ---- Close / outside click ---- */

    var closeBtn = document.getElementById('trash-panel-close');
    if (closeBtn) closeBtn.addEventListener('click', closeTrashPanel);

    document.addEventListener('click', function(e) {
        if (!trashPanelOpen) return;
        if (trashPanelEl && trashPanelEl.contains(e.target)) return;
        var ibBtn = document.getElementById('ib-trash');
        if (ibBtn && (ibBtn === e.target || ibBtn.contains(e.target))) return;
        var ctxMenu = document.getElementById('session-context-menu');
        if (ctxMenu && ctxMenu.contains(e.target)) return;
        closeTrashPanel();
    });

    /* ---- Message listener ---- */

    window.addEventListener('message', function(e) {
        if (!e.data) return;
        if (e.data.type === 'sessionList') {
            renderTrashList(e.data.sessions);
        }
    });

    /* ---- Helpers ---- */
    function escapeAttr(str) { return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;'); }
    function escapeHtml(str) { return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
})();
`;
}

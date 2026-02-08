/** Right-click context menu for session items in the Project Logs panel. */

/** Returns the HTML for the session context menu element. */
export function getSessionContextMenuHtml(): string {
    return /* html */ `<div id="session-context-menu" class="session-context-menu">
    <div class="context-menu-item" data-session-action="open">
        <span class="codicon codicon-go-to-file"></span> Open
    </div>
    <div class="context-menu-separator"></div>
    <div class="context-menu-item" data-session-action="rename">
        <span class="codicon codicon-edit"></span> Rename...
    </div>
    <div class="context-menu-item" data-session-action="tag">
        <span class="codicon codicon-tag"></span> Tag...
    </div>
    <div class="context-menu-separator"></div>
    <div class="context-menu-item" data-session-action="exportHtml">
        <span class="codicon codicon-file-code"></span> Export as HTML
    </div>
    <div class="context-menu-item" data-session-action="exportCsv">
        <span class="codicon codicon-table"></span> Export as CSV
    </div>
    <div class="context-menu-item" data-session-action="exportJson">
        <span class="codicon codicon-json"></span> Export as JSON
    </div>
    <div class="context-menu-item" data-session-action="exportJsonl">
        <span class="codicon codicon-list-flat"></span> Export as JSONL
    </div>
    <div class="context-menu-separator"></div>
    <div class="context-menu-item" data-session-action="copyDeepLink">
        <span class="codicon codicon-link"></span> Copy Deep Link
    </div>
    <div class="context-menu-item" data-session-action="copyFilePath">
        <span class="codicon codicon-copy"></span> Copy File Path
    </div>
    <div class="context-menu-separator session-normal-only"></div>
    <div class="context-menu-item session-normal-only" data-session-action="trash">
        <span class="codicon codicon-trash"></span> Move to Trash
    </div>
    <div class="context-menu-separator session-trashed-only"></div>
    <div class="context-menu-item session-trashed-only" data-session-action="restore">
        <span class="codicon codicon-discard"></span> Restore from Trash
    </div>
    <div class="context-menu-item session-trashed-only" data-session-action="deletePermanently">
        <span class="codicon codicon-close"></span> Delete Permanently
    </div>
</div>`;
}

/** Returns JS for the session context menu show/hide/action dispatch. */
export function getSessionContextMenuScript(): string {
    return /* js */ `
(function() {
    var sessionCtxMenu = document.getElementById('session-context-menu');
    var sessionCtxUri = '';
    var sessionCtxFilename = '';
    var sessionCtxTrashed = false;

    window.showSessionContextMenu = function(x, y, uriString, filename, trashed) {
        if (!sessionCtxMenu) return;
        sessionCtxUri = uriString;
        sessionCtxFilename = filename;
        sessionCtxTrashed = trashed;
        var normalItems = sessionCtxMenu.querySelectorAll('.session-normal-only');
        var trashedItems = sessionCtxMenu.querySelectorAll('.session-trashed-only');
        for (var i = 0; i < normalItems.length; i++) normalItems[i].style.display = trashed ? 'none' : '';
        for (var j = 0; j < trashedItems.length; j++) trashedItems[j].style.display = trashed ? '' : 'none';
        sessionCtxMenu.style.left = x + 'px';
        sessionCtxMenu.style.top = y + 'px';
        sessionCtxMenu.classList.add('visible');
        var rect = sessionCtxMenu.getBoundingClientRect();
        if (rect.right > window.innerWidth) sessionCtxMenu.style.left = Math.max(0, x - rect.width) + 'px';
        if (rect.bottom > window.innerHeight) sessionCtxMenu.style.top = Math.max(0, y - rect.height) + 'px';
        sessionCtxMenu.style.maxHeight = (window.innerHeight - parseInt(sessionCtxMenu.style.top, 10) - 4) + 'px';
    };

    window.hideSessionContextMenu = function() {
        if (sessionCtxMenu) sessionCtxMenu.classList.remove('visible');
    };

    if (sessionCtxMenu) {
        sessionCtxMenu.addEventListener('click', function(e) {
            var item = e.target.closest('[data-session-action]');
            if (!item) return;
            var action = item.dataset.sessionAction;
            hideSessionContextMenu();
            vscodeApi.postMessage({
                type: 'sessionAction', action: action,
                uriString: sessionCtxUri, filename: sessionCtxFilename,
            });
        });
    }

    document.addEventListener('click', function(e) {
        if (sessionCtxMenu && !sessionCtxMenu.contains(e.target)) hideSessionContextMenu();
    });
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') hideSessionContextMenu();
    });
})();
`;
}

/** Right-click context menu for log items in the Logs panel. */

/** Returns the HTML for the session context menu element. */
export function getSessionContextMenuHtml(): string {
    /* Export and Copy actions are grouped under flyout submenus (6 export targets, 2 copy targets)
       to keep the top-level menu short and scannable. The submenu flyout uses the same
       .context-menu-submenu / .context-menu-submenu-content pattern as the line context menu. */
    return /* html */ `<div id="session-context-menu" class="session-context-menu">
    <div class="context-menu-item" data-session-action="open">
        <span class="codicon codicon-go-to-file"></span> Open
    </div>
    <div class="context-menu-item" data-session-action="replay">
        <span class="codicon codicon-debug-start"></span> Replay
    </div>
    <div class="context-menu-separator"></div>
    <div class="context-menu-item" data-session-action="rename">
        <span class="codicon codicon-edit"></span> Rename...
    </div>
    <div class="context-menu-item" data-session-action="tag">
        <span class="codicon codicon-tag"></span> Tag...
    </div>
    <div class="context-menu-separator"></div>
    <!-- Export flyout submenu: 6 export targets (HTML, CSV, JSON, JSONL, .slc Bundle, Loki) -->
    <div class="context-menu-submenu" id="session-export-submenu">
        <span class="codicon codicon-export"></span> Export
        <span class="context-menu-arrow codicon codicon-chevron-right"></span>
        <div class="context-menu-submenu-content">
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
            <div class="context-menu-item" data-session-action="exportSlc">
                <span class="codicon codicon-package"></span> Export as .slc Bundle
            </div>
            <div class="context-menu-item" data-session-action="exportToLoki">
                <span class="codicon codicon-cloud-upload"></span> Export to Loki
            </div>
        </div>
    </div>
    <!-- Copy flyout submenu: 2 copy targets (Deep Link, File Path) -->
    <div class="context-menu-submenu" id="session-copy-submenu">
        <span class="codicon codicon-copy"></span> Copy
        <span class="context-menu-arrow codicon codicon-chevron-right"></span>
        <div class="context-menu-submenu-content">
            <div class="context-menu-item" data-session-action="copyDeepLink">
                <span class="codicon codicon-link"></span> <span class="session-copy-deep-link-label">Copy Deep Link</span>
            </div>
            <div class="context-menu-item" data-session-action="copyFilePath">
                <span class="codicon codicon-copy"></span> <span class="session-copy-file-path-label">Copy File Path</span>
            </div>
        </div>
    </div>
    <div class="context-menu-item" data-session-action="revealInOS">
        <span class="codicon codicon-folder-opened"></span> <span class="session-reveal-label">Reveal in File Explorer</span>
    </div>
    <div class="context-menu-separator session-normal-only"></div>
    <div class="context-menu-item session-normal-only" data-session-action="hideByName">
        <span class="codicon codicon-eye-closed"></span> Hide This Name
    </div>
    <div class="context-menu-item session-normal-only" data-session-action="showOnlyByName">
        <span class="codicon codicon-eye"></span> Show Only This Name
    </div>
    <div class="context-menu-separator session-normal-only"></div>
    <div class="context-menu-item session-normal-only" data-session-action="addToCollection">
        <span class="codicon codicon-pin"></span> Add to Collection
    </div>
    <!-- Session-group actions: Group joins selected logs under a shared groupId; Ungroup dismantles
         the group the targeted log belongs to. Both are always visible in the normal context; the
         group label pluralises when multi-select is active, and Ungroup is a friendly no-op on an
         ungrouped target. -->
    <div class="context-menu-separator session-normal-only"></div>
    <div class="context-menu-item session-normal-only" data-session-action="group">
        <span class="codicon codicon-layers-active"></span> <span class="session-group-label">Group Selected Sessions</span>
    </div>
    <div class="context-menu-item session-normal-only" data-session-action="ungroup">
        <span class="codicon codicon-layers-dot"></span> <span class="session-ungroup-label">Ungroup Session</span>
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
    var sessionCtxUris = [];
    var sessionCtxFilenames = [];
    var sessionCtxTrashed = false;

    /* Platform-aware "reveal" label. Matches the built-in VS Code command title:
       Windows → "Reveal in File Explorer", macOS → "Reveal in Finder", Linux → "Open Containing Folder".
       Exposed on window so the hover button in the session row can use the same label. */
    window.getRevealInOSLabel = function() {
        var plat = ((navigator && navigator.platform) || '').toLowerCase();
        if (plat.indexOf('mac') >= 0) return 'Reveal in Finder';
        if (plat.indexOf('linux') >= 0) return 'Open Containing Folder';
        return 'Reveal in File Explorer';
    };
    var revealLabelEl = sessionCtxMenu ? sessionCtxMenu.querySelector('.session-reveal-label') : null;
    if (revealLabelEl) revealLabelEl.textContent = getRevealInOSLabel();

    /* (x, y, uriOrUris, filenameOrFilenames, trashed) - single items or arrays for multi-select */
    window.showSessionContextMenu = function(x, y, uriOrUris, filenameOrFilenames, trashed) {
        if (!sessionCtxMenu) return;
        sessionCtxUris = Array.isArray(uriOrUris) ? uriOrUris : [uriOrUris || ''];
        sessionCtxFilenames = Array.isArray(filenameOrFilenames) ? filenameOrFilenames : [filenameOrFilenames || ''];
        sessionCtxTrashed = !!trashed;
        var normalItems = sessionCtxMenu.querySelectorAll('.session-normal-only');
        var trashedItems = sessionCtxMenu.querySelectorAll('.session-trashed-only');
        for (var i = 0; i < normalItems.length; i++) normalItems[i].style.display = trashed ? 'none' : '';
        for (var j = 0; j < trashedItems.length; j++) trashedItems[j].style.display = trashed ? '' : 'none';
        /* Pluralize Copy submenu labels when multiple sessions are selected.
           Targets the dedicated <span> wrappers inside the Copy flyout so the codicon sibling
           is not overwritten. */
        var multi = sessionCtxUris.length > 1;
        var copyLinkLabel = sessionCtxMenu.querySelector('.session-copy-deep-link-label');
        var copyPathLabel = sessionCtxMenu.querySelector('.session-copy-file-path-label');
        if (copyLinkLabel) copyLinkLabel.textContent = multi ? 'Copy Deep Links' : 'Copy Deep Link';
        if (copyPathLabel) copyPathLabel.textContent = multi ? 'Copy File Paths' : 'Copy File Path';
        /* Session-group labels also pluralise. Single-row "Group" is still useful \u2014 it clears the
           row's auto-assigned groupId without stamping a new multi-member group \u2014 so we don't
           hide the entry; we just switch the text to "Start New Group" to make single-row semantics
           clearer. Ungroup stays "Ungroup Session" / "Ungroup Sessions". */
        var groupLabel = sessionCtxMenu.querySelector('.session-group-label');
        var ungroupLabel = sessionCtxMenu.querySelector('.session-ungroup-label');
        if (groupLabel) groupLabel.textContent = multi ? 'Group Selected Sessions' : 'Start New Group';
        if (ungroupLabel) ungroupLabel.textContent = multi ? 'Ungroup Sessions' : 'Ungroup Session';
        sessionCtxMenu.style.left = x + 'px';
        sessionCtxMenu.style.top = y + 'px';
        sessionCtxMenu.classList.add('visible');
        var rect = sessionCtxMenu.getBoundingClientRect();
        if (rect.right > window.innerWidth) sessionCtxMenu.style.left = Math.max(0, x - rect.width) + 'px';
        if (rect.bottom > window.innerHeight) sessionCtxMenu.style.top = Math.max(0, y - rect.height) + 'px';
        /* Flip submenu flyout to the left when the menu is near the right viewport edge.
           Matches the pattern used by the line context menu. 200px is an approximate submenu width. */
        var rect2 = sessionCtxMenu.getBoundingClientRect();
        sessionCtxMenu.classList.toggle('flip-submenu', rect2.right + 200 > window.innerWidth);
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
            /* Name filter actions are handled locally in the webview, not sent to the extension.
               Look up the session record from cachedSessions by URI so we get the correct
               displayName (which may differ from filename if the session was renamed).
               Store the raw (pre-transform) basename so the filter adapts when the user
               toggles display options after setting a name filter. */
            if (action === 'hideByName' || action === 'showOnlyByName') {
                var targetUri = sessionCtxUris[0] || '';
                var rawBn = '';
                if (typeof cachedSessions !== 'undefined' && cachedSessions) {
                    for (var si = 0; si < cachedSessions.length; si++) {
                        if (cachedSessions[si].uriString === targetUri) {
                            rawBn = getSessionBasename(cachedSessions[si].displayName || cachedSessions[si].filename);
                            break;
                        }
                    }
                }
                /* Fallback to raw filename if session not found in cache. */
                if (!rawBn) rawBn = getSessionBasename(sessionCtxFilenames[0] || '');
                var mode = action === 'hideByName' ? 'hide' : 'only';
                if (typeof setSessionNameFilter === 'function') setSessionNameFilter(mode, rawBn);
                return;
            }
            vscodeApi.postMessage({
                type: 'sessionAction', action: action,
                uriStrings: sessionCtxUris, filenames: sessionCtxFilenames,
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

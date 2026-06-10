/**
 * Session panel: header-path updater and the inbound (host → webview) message listener.
 * Extracted from viewer-session-panel-events.ts to keep that file under the 300-line limit.
 * Concatenated into the SAME IIFE, so it shares the panel's scope (sessionDisplayOptions,
 * collapsed* maps, cachedSessions, renderSessionList, etc.) — function declarations hoist,
 * so registration order relative to the other fragments does not matter.
 */
export function getSessionMessageListenerScript(): string {
  return /* javascript */ `
    function updateHeaderPath(rootLabel, isDefault) {
        var headerPathEl = document.getElementById('session-header-path');
        var pathText = document.getElementById('session-path-text');
        var resetBtn = document.getElementById('session-reset-root');
        if (headerPathEl) headerPathEl.style.display = isDefault ? 'none' : '';
        if (pathText) pathText.textContent = isDefault ? '' : (rootLabel || 'No workspace');
        if (resetBtn) resetBtn.style.display = isDefault ? 'none' : '';
    }

    var headerClickableEl = document.getElementById('session-header-clickable');
    if (headerClickableEl) headerClickableEl.addEventListener('click', function() { vscodeApi.postMessage({ type: 'browseSessionRoot' }); });
    var resetRootBtn = document.getElementById('session-reset-root');
    if (resetRootBtn) resetRootBtn.addEventListener('click', function(e) { e.stopPropagation(); vscodeApi.postMessage({ type: 'clearSessionRoot' }); });

    window.addEventListener('message', function(e) {
        if (!e.data) return;
        if (e.data.type === 'sessionListLoading') {
            var labelEl = document.getElementById('session-loading-label');
            if (labelEl) labelEl.textContent = (e.data.folderPath ? 'Loading ' + e.data.folderPath + '…' : 'Loading…');
        }
        if (e.data.type === 'sessionListPreview') {
            renderSessionListPreview(e.data.previews);
        }
        if (e.data.type === 'sessionListBatch') {
            updateSessionBatchItems(e.data.items);
        }
        /* Host nudge after a manual "Open Log File" load: re-request the list so the
           newly-recorded loaded-files-history row appears without waiting for the
           polling interval or a panel re-focus. */
        if (e.data.type === 'refreshSessionList') {
            requestSessionList();
        }
        if (e.data.type === 'sessionList') {
            cachedSessions = e.data.sessions;
            sessionListPage = 0;
            renderSessionList(e.data.sessions);
            /* Refresh the kebab "recently opened" shortcut list from the same records (it reads the
               loadedManually-flagged ones). Guarded: the fragment is hoisted but stay defensive. */
            if (typeof renderLoadedFilesMenu === 'function') renderLoadedFilesMenu(e.data.sessions);
            if (typeof e.data.isDefault !== 'undefined') { updateHeaderPath(e.data.label, e.data.isDefault); }
        }
        if (e.data.type === 'sessionDisplayOptions') {
            var opts = e.data.options || sessionDisplayOptions;
            sessionDisplayOptions = opts.dateRange !== undefined ? opts : Object.assign({}, opts, { dateRange: 'all' });
            /* Restore persisted collapsed-day state from options. */
            if (opts.collapsedDays) {
                collapsedDays = Object.create(null);
                for (var dk in opts.collapsedDays) {
                    if (opts.collapsedDays[dk]) collapsedDays[dk] = true;
                }
            }
            /* Restore persisted collapsed-group state from options. */
            if (opts.collapsedGroups) {
                collapsedGroups = Object.create(null);
                for (var gk in opts.collapsedGroups) {
                    if (opts.collapsedGroups[gk]) collapsedGroups[gk] = true;
                }
            }
            /* Restore persisted collapsed-controller state. Same pattern as collapsedGroups —
               only keep truthy entries so the object stays small. */
            if (opts.collapsedControllers) {
                collapsedControllers = Object.create(null);
                for (var rk in opts.collapsedControllers) {
                    if (opts.collapsedControllers[rk]) collapsedControllers[rk] = true;
                }
            }
            sessionListPage = 0;
            window.__sharedPanelWidth = Math.max(MIN_PANEL_WIDTH, sessionDisplayOptions.panelWidth || 0);
            var slot = document.getElementById('panel-slot');
            if (slot && parseInt(slot.style.width, 10) > 0) {
                slot.style.width = window.__sharedPanelWidth + 'px';
            }
            syncToggleButtons();
            if (cachedSessions) renderSessionList(cachedSessions);
        }
    });
`;
}

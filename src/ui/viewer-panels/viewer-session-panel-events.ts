/**
 * Session panel: toggle buttons, resize, session list events, close/refresh/pagination/tags,
 * outside click, header path, and message listener. Inlined into the same IIFE as viewer-session-panel.
 */
export function getSessionPanelEventsScript(): string {
  return `
    function syncToggleButtons() {
        var ids = {
            'session-toggle-strip': !sessionDisplayOptions.stripDatetime,
            'session-toggle-normalize': sessionDisplayOptions.normalizeNames,
            'session-toggle-headings': sessionDisplayOptions.showDayHeadings,
            'session-toggle-reverse': sessionDisplayOptions.reverseSort,
            'session-toggle-latest': sessionDisplayOptions.showLatestOnly,
        };
        for (var id in ids) {
            var el = document.getElementById(id);
            if (el) el.classList.toggle('active', ids[id]);
        }
        var sortBtn = document.getElementById('session-toggle-reverse');
        if (sortBtn) {
            var icon = sortBtn.querySelector('.codicon');
            if (icon) icon.style.transform = sessionDisplayOptions.reverseSort ? 'scaleY(-1)' : '';
        }
        var dateRangeEl = document.getElementById('session-date-range');
        if (dateRangeEl && dateRangeEl.value !== (sessionDisplayOptions.dateRange || 'all')) dateRangeEl.value = sessionDisplayOptions.dateRange || 'all';
    }

    function toggleOption(key) {
        var copy = {};
        for (var k in sessionDisplayOptions) copy[k] = sessionDisplayOptions[k];
        copy[key] = !copy[key];
        sessionDisplayOptions = copy;
        sessionListPage = 0;
        syncToggleButtons();
        vscodeApi.postMessage({ type: 'setSessionDisplayOptions', options: sessionDisplayOptions });
        if (cachedSessions) renderSessionList(cachedSessions);
    }

    function bindToggle(id, key) {
        var btn = document.getElementById(id);
        if (btn) btn.addEventListener('click', function(e) { e.stopPropagation(); toggleOption(key); });
    }

    bindToggle('session-toggle-strip', 'stripDatetime');
    bindToggle('session-toggle-normalize', 'normalizeNames');
    bindToggle('session-toggle-headings', 'showDayHeadings');
    bindToggle('session-toggle-reverse', 'reverseSort');
    bindToggle('session-toggle-latest', 'showLatestOnly');

    var dateRangeSelect = document.getElementById('session-date-range');
    if (dateRangeSelect) dateRangeSelect.addEventListener('change', function() {
        var copy = {};
        for (var k in sessionDisplayOptions) copy[k] = sessionDisplayOptions[k];
        copy.dateRange = dateRangeSelect.value;
        sessionDisplayOptions = copy;
        sessionListPage = 0;
        vscodeApi.postMessage({ type: 'setSessionDisplayOptions', options: sessionDisplayOptions });
        if (cachedSessions) renderSessionList(cachedSessions);
    });

    initSessionPanelResize(sessionPanelEl, function(w) {
        if (w > 0) {
            sessionDisplayOptions.panelWidth = w;
            window.__sharedPanelWidth = w;
            vscodeApi.postMessage({ type: 'setSessionDisplayOptions', options: sessionDisplayOptions });
        }
    });

    if (sessionListEl) {
        /* Day heading collapse/expand: toggle on click or Enter/Space. */
        sessionListEl.addEventListener('click', function(e) {
            var heading = e.target.closest('.session-day-heading');
            if (heading) {
                var group = heading.closest('.session-day-group');
                if (!group) return;
                var key = group.getAttribute('data-day-key');
                if (!key) return;
                collapsedDays[key] = !collapsedDays[key];
                /* Remove falsy entries to keep the persisted object small. */
                if (!collapsedDays[key]) delete collapsedDays[key];
                group.classList.toggle('collapsed', !!collapsedDays[key]);
                var chevron = heading.querySelector('.session-day-chevron');
                if (chevron) {
                    chevron.classList.toggle('codicon-chevron-right', !!collapsedDays[key]);
                    chevron.classList.toggle('codicon-chevron-down', !collapsedDays[key]);
                }
                heading.setAttribute('aria-expanded', String(!collapsedDays[key]));
                /* Persist collapsed state through the display-options pipeline. */
                var optsCopy = {};
                for (var ck in sessionDisplayOptions) optsCopy[ck] = sessionDisplayOptions[ck];
                optsCopy.collapsedDays = collapsedDays;
                sessionDisplayOptions = optsCopy;
                vscodeApi.postMessage({ type: 'setSessionDisplayOptions', options: sessionDisplayOptions });
                return;
            }
            var item = e.target.closest('.session-item');
            if (!item) return;
            var uri = item.getAttribute('data-uri') || '';
            /* Hover-action buttons (e.g. reveal in OS) live inside the row but must NOT
               open the log. Dispatch their action directly and skip the row-open path. */
            var actionBtn = e.target.closest('.session-item-action');
            if (actionBtn && item.contains(actionBtn)) {
                e.preventDefault();
                e.stopPropagation();
                var action = actionBtn.getAttribute('data-session-action') || '';
                var filename = item.getAttribute('data-filename') || '';
                if (action) {
                    vscodeApi.postMessage({
                        type: 'sessionAction', action: action,
                        uriStrings: [uri], filenames: [filename],
                    });
                }
                return;
            }
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                selectedSessionUris[uri] = !selectedSessionUris[uri];
                if (cachedSessions) renderSessionList(cachedSessions);
                return;
            }
            selectedSessionUris = Object.create(null);
            if (cachedSessions) renderSessionList(cachedSessions);
            vscodeApi.postMessage({ type: 'openSessionFromPanel', uriString: uri });
        });
        /* Keyboard support: Enter/Space on focused day heading toggles collapse. */
        sessionListEl.addEventListener('keydown', function(e) {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            var heading = e.target.closest('.session-day-heading');
            if (!heading) return;
            e.preventDefault();
            heading.click();
        });
        sessionListEl.addEventListener('contextmenu', function(e) {
            var item = e.target.closest('.session-item');
            if (!item) return;
            e.preventDefault();
            if (typeof showSessionContextMenu !== 'function') return;
            var selected = sessionListEl.querySelectorAll('.session-item-selected');
            var useMulti = selected.length > 0 && Array.prototype.indexOf.call(selected, item) >= 0;
            var uris = useMulti
                ? Array.prototype.map.call(selected, function(el) { return el.getAttribute('data-uri') || ''; })
                : [item.getAttribute('data-uri') || ''];
            var filenames = useMulti
                ? Array.prototype.map.call(selected, function(el) { return el.getAttribute('data-filename') || ''; })
                : [item.getAttribute('data-filename') || ''];
            showSessionContextMenu(e.clientX, e.clientY, uris, filenames, false);
        });
    }

    /* Name filter bar: clear button uses event delegation because the bar content is dynamic. */
    var nameFilterBarEl = document.getElementById('session-name-filter-bar');
    if (nameFilterBarEl) {
        nameFilterBarEl.addEventListener('click', function(e) {
            var btn = e.target.closest('#session-name-filter-clear');
            if (btn && typeof clearSessionNameFilter === 'function') clearSessionNameFilter();
        });
    }

    var closeBtn = document.getElementById('session-close');
    if (closeBtn) closeBtn.addEventListener('click', closeSessionPanel);
    var refreshBtn = document.getElementById('session-refresh');
    if (refreshBtn) refreshBtn.addEventListener('click', requestSessionList);
    if (sessionListPaginationEl) {
        sessionListPaginationEl.addEventListener('click', function(e) {
            var btn = e.target.closest('button');
            if (!btn || !cachedSessions) return;
            if (btn.id === 'session-pagination-prev') { sessionListPage--; renderSessionList(cachedSessions); }
            if (btn.id === 'session-pagination-next') { sessionListPage++; renderSessionList(cachedSessions); }
        });
    }
    var tagsBtn = document.getElementById('session-filter-tags');
    if (tagsBtn) tagsBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        if (typeof toggleSessionTagsSection === 'function') toggleSessionTagsSection();
    });

    document.addEventListener('click', function(e) {
        if (!sessionPanelOpen) return;
        if (sessionPanelEl && sessionPanelEl.contains(e.target)) return;
        var ibBtn = document.getElementById('ib-sessions');
        if (ibBtn && (ibBtn === e.target || ibBtn.contains(e.target))) return;
        var ctxMenu = document.getElementById('session-context-menu');
        if (ctxMenu && ctxMenu.contains(e.target)) return;
        closeSessionPanel();
    });

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
        if (e.data.type === 'sessionList') {
            cachedSessions = e.data.sessions;
            sessionListPage = 0;
            renderSessionList(e.data.sessions);
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

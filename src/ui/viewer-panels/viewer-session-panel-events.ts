/**
 * Session panel: toggle buttons, resize, session list events, close/refresh/pagination/tags,
 * outside click, header path, and message listener. Inlined into the same IIFE as viewer-session-panel.
 */
import { getSessionOptionsMenuScript } from './viewer-session-options-menu';
import { getNewerLogEventsScript } from './viewer-session-panel-events-newer';
import { getControllerEventsScript } from './viewer-session-panel-events-controllers';
import { getSessionMessageListenerScript } from './viewer-session-panel-events-messages';

export function getSessionPanelEventsScript(): string {
  return getSessionOptionsMenuScript() + getNewerLogEventsScript() + getControllerEventsScript() + `
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
            if (el) {
                el.classList.toggle('active', ids[id]);
                /* role="menuitemcheckbox" rows: keep aria-checked in sync with
                   the visual switch so screen readers report state. */
                el.setAttribute('aria-checked', ids[id] ? 'true' : 'false');
            }
        }
        var sortBtn = document.getElementById('session-toggle-reverse');
        if (sortBtn) {
            /* Icon span in the new options-menu markup carries
               .session-options-toggle-icon; falling back to .codicon would still
               work but matching the more specific class avoids picking up the
               wrong icon if the row ever grows additional codicon siblings. */
            var icon = sortBtn.querySelector('.session-options-toggle-icon');
            if (icon) icon.style.transform = sessionDisplayOptions.reverseSort ? 'scaleY(-1)' : '';
        }
        var dateRangeEl = document.getElementById('session-date-range');
        if (dateRangeEl && dateRangeEl.value !== (sessionDisplayOptions.dateRange || 'all')) dateRangeEl.value = sessionDisplayOptions.dateRange || 'all';
        var sizeRangeEl = document.getElementById('session-size-range');
        if (sizeRangeEl && sizeRangeEl.value !== (sessionDisplayOptions.sizeRange || 'all')) sizeRangeEl.value = sessionDisplayOptions.sizeRange || 'all';
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

    /* Filter dropdowns (date range, minimum size) share one binding: clone the options, write the
       selected value under the given key, reset to page 0, persist, and re-render. Cloning keeps the
       persisted object a fresh reference so the host's merge-and-rebroadcast sees a changed value. */
    function bindSelectOption(id, key) {
        var el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('change', function() {
            var copy = {};
            for (var k in sessionDisplayOptions) copy[k] = sessionDisplayOptions[k];
            copy[key] = el.value;
            sessionDisplayOptions = copy;
            sessionListPage = 0;
            vscodeApi.postMessage({ type: 'setSessionDisplayOptions', options: sessionDisplayOptions });
            if (cachedSessions) renderSessionList(cachedSessions);
        });
    }
    bindSelectOption('session-date-range', 'dateRange');
    bindSelectOption('session-size-range', 'sizeRange');

    initPanelSlotResize(function(w) {
        if (w > 0) {
            sessionDisplayOptions.panelWidth = w;
            window.__sharedPanelWidth = w;
            vscodeApi.postMessage({ type: 'setSessionDisplayOptions', options: sessionDisplayOptions });
        }
    });

    if (sessionListEl) {
        /* Session-group chevron collapse/expand: check before the day-heading handler because
           group chevrons live inside session rows which themselves live inside day-group blocks.
           Without this guard the event would fall through to the row-open path. */
        sessionListEl.addEventListener('click', function(e) {
            var chev = e.target.closest('.session-group-chevron');
            if (chev) {
                var groupBlock = chev.closest('.session-group');
                if (!groupBlock) return;
                var gid = groupBlock.getAttribute('data-group-id');
                if (!gid) return;
                e.preventDefault();
                e.stopPropagation();
                collapsedGroups[gid] = !collapsedGroups[gid];
                if (!collapsedGroups[gid]) delete collapsedGroups[gid];
                /* Persist through the display-options pipeline, same pattern as collapsedDays. */
                var optsCopy = {};
                for (var ck in sessionDisplayOptions) optsCopy[ck] = sessionDisplayOptions[ck];
                optsCopy.collapsedGroups = collapsedGroups;
                sessionDisplayOptions = optsCopy;
                vscodeApi.postMessage({ type: 'setSessionDisplayOptions', options: sessionDisplayOptions });
                /* Re-render so the aggregate severity badges on the primary row recompute based
                   on the new collapsed state. A DOM-only toggle would leave stale per-file counts
                   on a newly-collapsed primary. */
                if (cachedSessions) renderSessionList(cachedSessions);
                return;
            }
        }, true);
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
            /* Keep the open-click from bubbling to the document. renderSessionList
               above rebuilt the list DOM, so the clicked node is now detached; other
               document-level click listeners (context menus, popovers, peer-panel
               dismissers) would test a detached node and could mis-fire. The panel
               itself no longer has an outside-click auto-hide. */
            e.stopPropagation();
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

    /* Reset a dropdown filter (date range / minimum size) back to 'all' from its chip [x].
       syncToggleButtons resyncs the dropdown's displayed value; the persist + re-render mirror
       the select-change path so the chip, the dropdown, and the list stay consistent. */
    function clearFilterOption(key) {
        var copy = {};
        for (var k in sessionDisplayOptions) copy[k] = sessionDisplayOptions[k];
        copy[key] = 'all';
        sessionDisplayOptions = copy;
        sessionListPage = 0;
        syncToggleButtons();
        vscodeApi.postMessage({ type: 'setSessionDisplayOptions', options: sessionDisplayOptions });
        if (cachedSessions) renderSessionList(cachedSessions);
    }

    /* Active-filters bar: event delegation because the bar content (chips + pills + buttons) is
       rebuilt on every render. A date/size chip [x] resets that dropdown; a name pill [x] removes
       just that name; the trailing "Show All" button clears the whole name filter. */
    var nameFilterBarEl = document.getElementById('session-name-filter-bar');
    if (nameFilterBarEl) {
        nameFilterBarEl.addEventListener('click', function(e) {
            var chip = e.target.closest('.session-filter-chip-remove');
            if (chip) { clearFilterOption(chip.getAttribute('data-filter-clear') || ''); return; }
            var pill = e.target.closest('.session-name-filter-pill-remove');
            if (pill && typeof removeSessionNameFilter === 'function') {
                removeSessionNameFilter(pill.getAttribute('data-name') || '');
                return;
            }
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

    /* No outside-click auto-hide: clicking in the log viewer (or anywhere outside
       the panel) must NOT close the Logs list — users browse the viewer while the
       list stays open. The panel closes only on an explicit action: its close
       button (above), the Logs icon toggle, Escape, or opening another panel (all
       handled in the icon bar). */

    /* Header-path updater + inbound (host → webview) message listener live in
       getSessionMessageListenerScript(), concatenated below into this same IIFE. */
` + getSessionMessageListenerScript();
}

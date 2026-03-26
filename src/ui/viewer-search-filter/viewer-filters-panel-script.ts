/**
 * Script for the filters panel.
 *
 * Handles open/close, tag chip search, noise reduction controls,
 * and preset/reset button wiring. Tag search filters individual
 * chip labels across Log Tags and Class Tags sections.
 */

/** Returns the JavaScript code for the filters panel. */
export function getFiltersPanelScript(): string {
    return /* javascript */ `
var filtersPanelOpen = false;

/** Filter chips inside a container by query, returning true if any match. */
function filterChipsByQuery(container, q) {
    var chips = container.querySelectorAll('.source-tag-chip');
    var anyMatch = false;
    for (var ci = 0; ci < chips.length; ci++) {
        var label = chips[ci].querySelector('.tag-label');
        var match = label && label.textContent.toLowerCase().indexOf(q) >= 0;
        chips[ci].style.display = match ? '' : 'none';
        if (match) anyMatch = true;
    }
    return anyMatch;
}

/** Check if any .options-row in a section matches the query. */
function anyRowMatches(sec, q) {
    var rows = sec.querySelectorAll('.options-row');
    for (var ri = 0; ri < rows.length; ri++) {
        if (rows[ri].textContent.toLowerCase().indexOf(q) >= 0) return true;
    }
    return false;
}

/** Filter tag chips and sections by query string. */
function filterFiltersPanel(query) {
    var q = (query || '').toLowerCase().trim();
    var clearBtn = document.getElementById('filters-search-clear');
    if (clearBtn) clearBtn.classList.toggle('visible', q.length > 0);
    if (!q) {
        var allChips = document.querySelectorAll('#filters-panel .source-tag-chip');
        for (var i = 0; i < allChips.length; i++) allChips[i].style.display = '';
        var allSections = document.querySelectorAll('#filters-panel .options-section');
        for (var s = 0; s < allSections.length; s++) allSections[s].classList.remove('options-filtered-hidden');
        return;
    }
    var sections = document.querySelectorAll('#filters-panel .options-section');
    for (var si = 0; si < sections.length; si++) {
        var sec = sections[si];
        var title = sec.querySelector('.options-section-title');
        var titleMatch = title && title.textContent.toLowerCase().indexOf(q) >= 0;
        var chipsContainer = sec.querySelector('.source-tag-chips');
        var visible = titleMatch
            || (chipsContainer ? filterChipsByQuery(chipsContainer, q) : anyRowMatches(sec, q));
        sec.classList.toggle('options-filtered-hidden', !visible);
    }
}

/** Open the filters panel. */
function openFiltersPanel() {
    if (filtersPanelOpen) return;
    filtersPanelOpen = true;
    if (typeof closeSearch === 'function') closeSearch();
    var searchInput = document.getElementById('filters-search');
    if (searchInput) { searchInput.value = ''; filterFiltersPanel(''); }
    var panel = document.getElementById('filters-panel');
    if (panel) {
        syncFiltersPanelUi();
        panel.classList.add('visible');
        requestAnimationFrame(function() {
            if (searchInput) searchInput.focus();
        });
    }
}

function closeFiltersPanel() {
    var panel = document.getElementById('filters-panel');
    if (panel) panel.classList.remove('visible');
    filtersPanelOpen = false;
    if (typeof clearActivePanel === 'function') clearActivePanel('filters');
    var ibBtn = document.getElementById('ib-filters');
    if (ibBtn) ibBtn.focus();
}

/** Human-readable label for a stream source id (debug, terminal, or external sidecar prefix). */
function sourceFilterLabel(id) {
    if (id === 'debug') return 'Debug output';
    if (id === 'terminal') return 'Terminal';
    if (typeof id === 'string' && id.indexOf('external:') === 0) {
        var rest = id.slice(9);
        if (!rest || rest === 'external') return 'External (sidecar log)';
        return 'External · ' + rest;
    }
    return id;
}

/** Collect checkboxes under the log-streams list (core rows + external group). */
function getSourceFilterCheckboxes(list) {
    return list.querySelectorAll('input[type="checkbox"][data-source]');
}

/** Rebuild enabledSources from checkbox state; null means all streams on. */
function commitSourceFilterFromCheckboxes(list) {
    var boxes = getSourceFilterCheckboxes(list);
    var checked = [];
    for (var j = 0; j < boxes.length; j++) {
        if (boxes[j].checked) checked.push(boxes[j].dataset.source);
    }
    window.enabledSources = checked.length === boxes.length ? null : checked;
    if (typeof recalcHeights === 'function') recalcHeights();
    if (typeof renderViewport === 'function') renderViewport(true);
}

/** Sync source filter checkboxes from window.availableSources / window.enabledSources. Called after setSources. */
function syncSourceFilterUi() {
    var section = document.getElementById('source-filter-section');
    var list = document.getElementById('source-filter-list');
    if (!section || !list) return;
    var available = (typeof window !== 'undefined' && window.availableSources) ? window.availableSources : [];
    if (available.length < 2) {
        section.style.display = 'none';
        return;
    }
    section.style.display = '';
    var enabled = (typeof window !== 'undefined' && window.enabledSources) ? window.enabledSources : null;
    var allEnabled = !enabled || enabled.length === available.length;
    while (list.firstChild) list.removeChild(list.firstChild);

    function addStreamRow(sid) {
        var row = document.createElement('label');
        row.className = 'options-row';
        var cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.dataset.source = sid;
        cb.checked = allEnabled || (enabled && enabled.indexOf(sid) >= 0);
        cb.addEventListener('change', function() { commitSourceFilterFromCheckboxes(list); });
        row.appendChild(cb);
        row.appendChild(document.createTextNode(' ' + sourceFilterLabel(sid)));
        list.appendChild(row);
    }

    var externals = [];
    for (var i = 0; i < available.length; i++) {
        var sid = available[i];
        if (typeof sid === 'string' && sid.indexOf('external:') === 0) {
            externals.push(sid);
        } else {
            addStreamRow(sid);
        }
    }
    if (externals.length > 0) {
        var groupTitle = document.createElement('div');
        groupTitle.className = 'options-hint source-external-group-title';
        groupTitle.textContent = 'External sidecars (' + externals.length + ')';
        list.appendChild(groupTitle);
        for (var e = 0; e < externals.length; e++) {
            addStreamRow(externals[e]);
        }
    }
}

/** Sync filter-related checkboxes from current state. */
function syncFiltersPanelUi() {
    var exclCheck = document.getElementById('opt-exclusions');
    var appOnlyCheck = document.getElementById('opt-app-only');
    if (exclCheck && typeof exclusionsEnabled !== 'undefined') exclCheck.checked = exclusionsEnabled;
    if (typeof rebuildExclusionChips === 'function') rebuildExclusionChips();
    if (appOnlyCheck && typeof appOnlyMode !== 'undefined') appOnlyCheck.checked = appOnlyMode;
    if (typeof rebuildTagChips === 'function') rebuildTagChips();
    if (typeof rebuildClassTagChips === 'function') rebuildClassTagChips();
    if (typeof syncScopeUi === 'function') syncScopeUi();
    if (typeof syncSourceFilterUi === 'function') syncSourceFilterUi();
    if (typeof updatePresetDropdown === 'function') updatePresetDropdown();
}

// Close button
var filtersCloseBtn = document.querySelector('.filters-close');
if (filtersCloseBtn) filtersCloseBtn.addEventListener('click', closeFiltersPanel);

// Search input
var filtersSearchInput = document.getElementById('filters-search');
var filtersSearchClear = document.getElementById('filters-search-clear');
if (filtersSearchInput) {
    filtersSearchInput.addEventListener('input', function(e) { filterFiltersPanel(e.target.value); });
}
if (filtersSearchClear) {
    filtersSearchClear.addEventListener('click', function() {
        if (filtersSearchInput) { filtersSearchInput.value = ''; filtersSearchInput.focus(); }
        filterFiltersPanel('');
    });
}

// Noise reduction controls
var optExcl = document.getElementById('opt-exclusions');
var optAppOnly = document.getElementById('opt-app-only');
if (optExcl) optExcl.addEventListener('change', function(e) {
    if (typeof setExclusionsEnabled === 'function') setExclusionsEnabled(e.target.checked);
    if (typeof rebuildExclusionChips === 'function') rebuildExclusionChips();
});
if (optAppOnly) optAppOnly.addEventListener('change', function(e) {
    if (typeof setAppOnlyMode === 'function') setAppOnlyMode(e.target.checked);
});

// Reset all filters
var resetBtn = document.getElementById('reset-all-filters');
if (resetBtn) resetBtn.addEventListener('click', function() {
    if (typeof resetAllFilters === 'function') resetAllFilters();
});

var sqlQueryHistFiltersBtn = document.getElementById('open-sql-query-history-from-filters');
if (sqlQueryHistFiltersBtn) {
    sqlQueryHistFiltersBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        if (typeof setActivePanel === 'function') setActivePanel('sqlHistory');
    });
}

// Outside click to close
document.addEventListener('click', function(e) {
    if (!filtersPanelOpen) return;
    var panel = document.getElementById('filters-panel');
    var ibBtn = document.getElementById('ib-filters');
    var badgeBtn = document.getElementById('filter-badge');
    if (panel && !panel.contains(e.target)
        && ibBtn !== e.target && !ibBtn?.contains(e.target)
        && badgeBtn !== e.target) {
        closeFiltersPanel();
    }
});
`;
}

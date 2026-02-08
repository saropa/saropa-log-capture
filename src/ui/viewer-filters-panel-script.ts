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
    }
}

function closeFiltersPanel() {
    var panel = document.getElementById('filters-panel');
    if (panel) panel.classList.remove('visible');
    filtersPanelOpen = false;
    if (typeof clearActivePanel === 'function') clearActivePanel('filters');
}

/** Sync filter-related checkboxes from current state. */
function syncFiltersPanelUi() {
    var exclCheck = document.getElementById('opt-exclusions');
    var appOnlyCheck = document.getElementById('opt-app-only');
    if (exclCheck && typeof exclusionsEnabled !== 'undefined') exclCheck.checked = exclusionsEnabled;
    if (typeof rebuildExclusionChips === 'function') rebuildExclusionChips();
    if (appOnlyCheck && typeof appOnlyMode !== 'undefined') appOnlyCheck.checked = appOnlyMode;
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

/**
 * Script for the filters panel.
 *
 * Handles open/close, tag chip search, noise reduction controls,
 * and preset/reset button wiring. Tag search filters individual
 * chip labels across Message Tags and Code Origins sections.
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
        var allChips = document.querySelectorAll('#filter-drawer .source-tag-chip');
        for (var i = 0; i < allChips.length; i++) allChips[i].style.display = '';
        var allSections = document.querySelectorAll('#filter-drawer .options-section');
        for (var s = 0; s < allSections.length; s++) allSections[s].classList.remove('options-filtered-hidden');
        return;
    }
    var sections = document.querySelectorAll('#filter-drawer .options-section');
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
    filtersPanelOpen = false;
    if (typeof clearActivePanel === 'function') clearActivePanel('filters');
}

/** Update the Log Inputs accordion summary based on tier radio state. */
function updateLogInputsSummary() {
    if (typeof setAccordionSummary !== 'function') return;
    /* Count how many tiers are not at default (Flutter=all, Device=warnplus, External=warnplus) */
    var changed = 0;
    if (typeof showFlutter !== 'undefined' && showFlutter !== 'all') changed++;
    if (typeof showDevice !== 'undefined' && showDevice !== 'warnplus') changed++;
    if (typeof showExternal !== 'undefined' && showExternal !== 'warnplus') changed++;
    setAccordionSummary('log-inputs-section', changed > 0 ? (changed + ' changed') : '');
}

/** Sync filter-related controls from current state. */
function syncFiltersPanelUi() {
    var exclCheck = document.getElementById('opt-exclusions');
    if (exclCheck && typeof exclusionsEnabled !== 'undefined') exclCheck.checked = exclusionsEnabled;
    if (typeof rebuildExclusionChips === 'function') rebuildExclusionChips();
    /* Sync tri-state tier radio buttons from current showFlutter/showDevice/showExternal values */
    if (typeof showFlutter !== 'undefined') {
        var flutterRadio = document.querySelector('input[name="tier-flutter"][value="' + showFlutter + '"]');
        if (flutterRadio) flutterRadio.checked = true;
    }
    if (typeof showDevice !== 'undefined') {
        var deviceRadio = document.querySelector('input[name="tier-device"][value="' + showDevice + '"]');
        if (deviceRadio) deviceRadio.checked = true;
    }
    if (typeof showExternal !== 'undefined') {
        var externalRadio = document.querySelector('input[name="tier-external"][value="' + showExternal + '"]');
        if (externalRadio) externalRadio.checked = true;
    }
    if (typeof rebuildTagChips === 'function') rebuildTagChips();
    if (typeof rebuildClassTagChips === 'function') rebuildClassTagChips();
    if (typeof syncScopeUi === 'function') syncScopeUi();
    if (typeof updatePresetDropdown === 'function') updatePresetDropdown();
}

/* Close button and search input bindings removed — filter drawer handles its own UI. */

// Exclusion controls
var optExcl = document.getElementById('opt-exclusions');
if (optExcl) optExcl.addEventListener('change', function(e) {
    if (typeof setExclusionsEnabled === 'function') setExclusionsEnabled(e.target.checked);
    if (typeof rebuildExclusionChips === 'function') rebuildExclusionChips();
});

// Tier filter controls (Flutter App / Device / External) — tri-state radio groups
var tierFlutterRadios = document.querySelectorAll('input[name="tier-flutter"]');
tierFlutterRadios.forEach(function(radio) {
    radio.addEventListener('change', function(e) {
        if (e.target.checked && typeof setShowFlutter === 'function') setShowFlutter(e.target.value);
    });
});
var tierDeviceRadios = document.querySelectorAll('input[name="tier-device"]');
tierDeviceRadios.forEach(function(radio) {
    radio.addEventListener('change', function(e) {
        if (e.target.checked && typeof setShowDevice === 'function') setShowDevice(e.target.value);
    });
});
var tierExternalRadios = document.querySelectorAll('input[name="tier-external"]');
tierExternalRadios.forEach(function(radio) {
    radio.addEventListener('change', function(e) {
        if (e.target.checked && typeof setShowExternal === 'function') setShowExternal(e.target.value);
    });
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

/* Outside click dismiss removed — toolbar script handles filter drawer dismiss. */
`;
}

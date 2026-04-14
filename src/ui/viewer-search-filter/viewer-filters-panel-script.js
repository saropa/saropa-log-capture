"use strict";
/**
 * Script for the filters panel.
 *
 * Handles open/close, tag chip search, noise reduction controls,
 * and preset/reset button wiring. Tag search filters individual
 * chip labels across Message Tags and Code Origins sections.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFiltersPanelScript = getFiltersPanelScript;
/** Returns the JavaScript code for the filters panel. */
function getFiltersPanelScript() {
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

/** Human-readable label for an input source id. */
function sourceFilterLabel(id) {
    if (id === 'debug') return 'Debug output';
    if (id === 'terminal') return 'Terminal';
    if (id === 'browser') return 'Browser console';
    if (typeof id === 'string' && id.indexOf('external:') === 0) {
        var rest = id.slice(9);
        if (!rest || rest === 'external') return 'External log';
        return rest + ' (external)';
    }
    return id;
}

/** Collect checkboxes under the source filter list. */
function getSourceFilterCheckboxes(list) {
    return list.querySelectorAll('input[type="checkbox"][data-source]');
}

/** Rebuild enabledSources from checkbox state; null means all on. */
function commitSourceFilterFromCheckboxes(list) {
    var boxes = getSourceFilterCheckboxes(list);
    var checked = [];
    for (var j = 0; j < boxes.length; j++) {
        if (boxes[j].checked) checked.push(boxes[j].dataset.source);
    }
    window.enabledSources = checked.length === boxes.length ? null : checked;
    if (typeof updateLogInputsSummary === 'function') updateLogInputsSummary();
    if (typeof recalcHeights === 'function') recalcHeights();
    if (typeof renderViewport === 'function') renderViewport(true);
}

/** Sync source filter checkboxes from window.availableSources / window.enabledSources. */
function syncSourceFilterUi() {
    var section = document.getElementById('log-inputs-section');
    var list = document.getElementById('source-filter-list');
    var divider = document.getElementById('log-inputs-divider');
    if (!list) return;
    var available = (typeof window !== 'undefined' && window.availableSources) ? window.availableSources : [];
    var hasSources = available.length >= 2;
    while (list.firstChild) list.removeChild(list.firstChild);
    if (divider) divider.style.display = 'none';

    if (!hasSources) {
        if (typeof updateLogInputsSummary === 'function') updateLogInputsSummary();
        return;
    }

    var enabled = (typeof window !== 'undefined' && window.enabledSources) ? window.enabledSources : null;
    var allEnabled = !enabled || enabled.length === available.length;

    for (var i = 0; i < available.length; i++) {
        var sid = available[i];
        var row = document.createElement('label');
        row.className = 'options-row';
        row.title = 'Show or hide ' + sourceFilterLabel(sid) + ' output';
        var cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.dataset.source = sid;
        cb.checked = allEnabled || (enabled && enabled.indexOf(sid) >= 0);
        cb.addEventListener('change', function() { commitSourceFilterFromCheckboxes(list); });
        row.appendChild(cb);
        row.appendChild(document.createTextNode(' ' + sourceFilterLabel(sid)));
        list.appendChild(row);
    }

    // Show divider if categories also exist
    var channelsList = document.getElementById('output-channels-list');
    if (divider && channelsList && channelsList.children.length > 0) {
        divider.style.display = '';
    }
    if (typeof updateLogInputsSummary === 'function') updateLogInputsSummary();
}

/** Update the combined Log Inputs accordion summary (sources + categories). */
function updateLogInputsSummary() {
    if (typeof setAccordionSummary !== 'function') return;
    var sourceList = document.getElementById('source-filter-list');
    var channelsList = document.getElementById('output-channels-list');
    var totalSrc = 0, enabledSrc = 0, totalCat = 0, enabledCat = 0;
    if (sourceList) {
        var srcBoxes = sourceList.querySelectorAll('input[type="checkbox"][data-source]');
        totalSrc = srcBoxes.length;
        for (var s = 0; s < srcBoxes.length; s++) { if (srcBoxes[s].checked) enabledSrc++; }
    }
    if (channelsList) {
        var catBoxes = channelsList.querySelectorAll('input[type="checkbox"]');
        totalCat = catBoxes.length;
        for (var c = 0; c < catBoxes.length; c++) { if (catBoxes[c].checked) enabledCat++; }
    }
    var total = totalSrc + totalCat;
    var enabled = enabledSrc + enabledCat;
    setAccordionSummary('log-inputs-section', total > 0 ? (enabled + '/' + total) : '');
}

/** Sync filter-related controls from current state. */
function syncFiltersPanelUi() {
    var exclCheck = document.getElementById('opt-exclusions');
    if (exclCheck && typeof exclusionsEnabled !== 'undefined') exclCheck.checked = exclusionsEnabled;
    if (typeof rebuildExclusionChips === 'function') rebuildExclusionChips();
    /* Sync tri-state tier radio buttons from current showFlutter/showDevice values */
    if (typeof showFlutter !== 'undefined') {
        var flutterRadio = document.querySelector('input[name="tier-flutter"][value="' + showFlutter + '"]');
        if (flutterRadio) flutterRadio.checked = true;
    }
    if (typeof showDevice !== 'undefined') {
        var deviceRadio = document.querySelector('input[name="tier-device"][value="' + showDevice + '"]');
        if (deviceRadio) deviceRadio.checked = true;
    }
    if (typeof rebuildTagChips === 'function') rebuildTagChips();
    if (typeof rebuildClassTagChips === 'function') rebuildClassTagChips();
    if (typeof syncScopeUi === 'function') syncScopeUi();
    if (typeof syncSourceFilterUi === 'function') syncSourceFilterUi();
    if (typeof updatePresetDropdown === 'function') updatePresetDropdown();
}

/* Close button and search input bindings removed — filter drawer handles its own UI. */

// Exclusion controls
var optExcl = document.getElementById('opt-exclusions');
if (optExcl) optExcl.addEventListener('change', function(e) {
    if (typeof setExclusionsEnabled === 'function') setExclusionsEnabled(e.target.checked);
    if (typeof rebuildExclusionChips === 'function') rebuildExclusionChips();
});

// Tier filter controls (Flutter / Device) — tri-state radio groups
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
//# sourceMappingURL=viewer-filters-panel-script.js.map
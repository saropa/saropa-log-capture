/**
 * Script for the Tags & Origins slide-out panel.
 *
 * Handles open/close, tag chip search across Message Tags / Code Origins /
 * SQL Commands sections, and sync of panel UI state on open.
 *
 * Tier radio wiring and exclusion controls live in the filter drawer
 * (toolbar script) — not here.
 */

/** Returns the JavaScript code for the Tags & Origins panel. */
export function getTagsPanelScript(): string {
    return /* javascript */ `
var tagsPanelOpen = false;

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

/** Filter tag chips and sections in the Tags & Origins panel by query string. */
function filterTagsPanel(query) {
    var q = (query || '').toLowerCase().trim();
    var clearBtn = document.getElementById('tags-search-clear');
    if (clearBtn) clearBtn.classList.toggle('visible', q.length > 0);
    if (!q) {
        var allChips = document.querySelectorAll('#tags-panel .source-tag-chip');
        for (var i = 0; i < allChips.length; i++) allChips[i].style.display = '';
        var allSections = document.querySelectorAll('#tags-panel .options-section');
        for (var s = 0; s < allSections.length; s++) allSections[s].classList.remove('options-filtered-hidden');
        return;
    }
    var sections = document.querySelectorAll('#tags-panel .options-section');
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

/** Open the Tags & Origins panel. */
function openTagsPanel() {
    if (tagsPanelOpen) return;
    tagsPanelOpen = true;
    if (typeof closeSearch === 'function') closeSearch();
    var searchInput = document.getElementById('tags-search');
    if (searchInput) { searchInput.value = ''; filterTagsPanel(''); }
    var panel = document.getElementById('tags-panel');
    if (panel) {
        syncTagsPanelUi();
        panel.classList.add('visible');
        requestAnimationFrame(function() {
            if (searchInput) searchInput.focus();
        });
    }
}

/** Close the Tags & Origins panel. */
function closeTagsPanel() {
    tagsPanelOpen = false;
    var panel = document.getElementById('tags-panel');
    if (panel) panel.classList.remove('visible');
    if (typeof clearActivePanel === 'function') clearActivePanel('tags');
}

/* Backward-compat aliases — other scripts may still call these names. */
function openFiltersPanel() { openTagsPanel(); }
function closeFiltersPanel() { closeTagsPanel(); }

/** Update the Log Sources accordion summary based on tier radio state. */
function updateLogSourcesSummary() {
    if (typeof setAccordionSummary !== 'function') return;
    /* Count how many tiers are not at default (Flutter DAP=all, Device=warnplus, External=warnplus) */
    var changed = 0;
    if (typeof showFlutter !== 'undefined' && showFlutter !== 'all') changed++;
    if (typeof showDevice !== 'undefined' && showDevice !== 'warnplus') changed++;
    if (typeof showExternal !== 'undefined' && showExternal !== 'warnplus') changed++;
    setAccordionSummary('log-sources-section', changed > 0 ? (changed + ' changed') : '');
}

/* Backward-compat alias for code that still calls the old name. */
function updateLogInputsSummary() { updateLogSourcesSummary(); }

/** Sync tag/origin chip state when the Tags & Origins panel opens. */
function syncTagsPanelUi() {
    if (typeof rebuildTagChips === 'function') rebuildTagChips();
    if (typeof rebuildClassTagChips === 'function') rebuildClassTagChips();
    if (typeof rebuildSqlPatternChips === 'function') rebuildSqlPatternChips();
}

/** Sync filter-related controls from current state (called by filter drawer). */
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
    if (typeof updatePresetDropdown === 'function') updatePresetDropdown();
    if (typeof syncScopeUi === 'function') syncScopeUi();
}

// Tags panel search input binding
var tagsSearchInput = document.getElementById('tags-search');
if (tagsSearchInput) {
    tagsSearchInput.addEventListener('input', function(e) {
        filterTagsPanel(e.target.value);
    });
}
var tagsSearchClear = document.getElementById('tags-search-clear');
if (tagsSearchClear) {
    tagsSearchClear.addEventListener('click', function() {
        var inp = document.getElementById('tags-search');
        if (inp) { inp.value = ''; filterTagsPanel(''); inp.focus(); }
    });
}

// Tags panel close button
var tagsCloseBtn = document.querySelector('.tags-close');
if (tagsCloseBtn) {
    tagsCloseBtn.addEventListener('click', function() {
        closeTagsPanel();
    });
}

// Exclusion controls (in the filter drawer, wired here for script load order)
var optExcl = document.getElementById('opt-exclusions');
if (optExcl) optExcl.addEventListener('change', function(e) {
    if (typeof setExclusionsEnabled === 'function') setExclusionsEnabled(e.target.checked);
    if (typeof rebuildExclusionChips === 'function') rebuildExclusionChips();
});

// Tier filter controls (Flutter DAP / Device / External) — tri-state radio groups
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

// SQL Query History button (now in Tags panel instead of filter drawer)
var sqlQueryHistTagsBtn = document.getElementById('open-sql-query-history-from-tags');
if (sqlQueryHistTagsBtn) {
    sqlQueryHistTagsBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        if (typeof setActivePanel === 'function') setActivePanel('sqlHistory');
    });
}
`;
}

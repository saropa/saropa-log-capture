/**
 * Script for the Filters slide-out panel.
 *
 * Provides open/close functions for the panel-slot panel, tier radio
 * wiring, exclusion controls, tab count updates, and chip rebuild
 * on panel open.
 */

/** Returns the JavaScript code for the filter panel controls. */
export function getTagsPanelScript(): string {
    return /* javascript */ `

/** Open the Filters slide-out panel. Called by setActivePanel('filters'). */
function openFiltersSlideout() {
    var panel = document.getElementById('filters-panel');
    if (!panel) return;
    panel.classList.add('visible');
    if (typeof syncFiltersPanelUi === 'function') syncFiltersPanelUi();
}

/** Close the Filters slide-out panel. */
function closeFiltersSlideout() {
    var panel = document.getElementById('filters-panel');
    if (panel) panel.classList.remove('visible');
    if (typeof clearActivePanel === 'function') clearActivePanel('filters');
}

/* Close button in panel header */
var _filtersCloseBtn = document.querySelector('.filters-panel-close');
if (_filtersCloseBtn) {
    _filtersCloseBtn.addEventListener('click', closeFiltersSlideout);
}

/** Update the Log Sources tab count based on tier radio state. */
function updateLogSourcesSummary() {
    if (typeof setAccordionSummary !== 'function') return;
    var changed = 0;
    if (typeof showFlutter !== 'undefined' && showFlutter !== 'all') changed++;
    if (typeof showDevice !== 'undefined' && showDevice !== 'warnplus') changed++;
    if (typeof showExternal !== 'undefined' && showExternal !== 'warnplus') changed++;
    setAccordionSummary('log-sources-section', changed > 0 ? (changed + ' changed') : '');
}

/* Backward-compat alias for code that still calls the old name. */
function updateLogInputsSummary() { updateLogSourcesSummary(); }

/** Sync filter-related controls from current state (called on panel open). */
function syncFiltersPanelUi() {
    var exclCheck = document.getElementById('opt-exclusions');
    if (exclCheck && typeof exclusionsEnabled !== 'undefined') exclCheck.checked = exclusionsEnabled;
    if (typeof rebuildExclusionChips === 'function') rebuildExclusionChips();
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
    if (typeof rebuildTagChips === 'function') rebuildTagChips();
    if (typeof rebuildClassTagChips === 'function') rebuildClassTagChips();
    if (typeof rebuildSqlPatternChips === 'function') rebuildSqlPatternChips();
}

// Exclusion controls
var optExcl = document.getElementById('opt-exclusions');
if (optExcl) optExcl.addEventListener('change', function(e) {
    if (typeof setExclusionsEnabled === 'function') setExclusionsEnabled(e.target.checked);
    if (typeof rebuildExclusionChips === 'function') rebuildExclusionChips();
});

// Tier filter controls (Flutter DAP / Device / External)
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

// SQL Query History button
var sqlQueryHistTagsBtn = document.getElementById('open-sql-query-history-from-tags');
if (sqlQueryHistTagsBtn) {
    sqlQueryHistTagsBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        if (typeof setActivePanel === 'function') setActivePanel('sqlHistory');
    });
}
`;
}

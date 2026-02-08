/**
 * Viewer Presets Script
 *
 * Provides filter preset functionality in the webview including:
 * - Dropdown to select and apply presets (in options panel)
 * - Save current filters as a new preset
 * - Reset all filters to defaults
 * - Message handling for preset data from extension
 */

/**
 * Returns the JavaScript code for preset handling in the webview.
 */
export function getPresetsScript(): string {
    return /* javascript */ `
/**
 * Available filter presets received from the extension.
 * Each preset: { name, categories?, searchPattern?, exclusionsEnabled? }
 */
var filterPresets = [];

/** Currently active preset name, or null if none/custom. */
var activePresetName = null;

/**
 * Handle preset list update from extension.
 * Rebuilds the preset dropdown with new options.
 */
function handleSetPresets(msg) {
    filterPresets = msg.presets || [];
    updatePresetDropdown();
}

/**
 * Apply a preset by name - sets filters and notifies extension.
 */
function applyPreset(presetName) {
    var preset = null;
    for (var i = 0; i < filterPresets.length; i++) {
        if (filterPresets[i].name === presetName) {
            preset = filterPresets[i];
            break;
        }
    }

    if (!preset) {
        return;
    }

    activePresetName = preset.name;

    // Apply category filter
    if (preset.categories && preset.categories.length > 0) {
        activeFilters = new Set(preset.categories);
        syncChannelCheckboxes();
        applyFilter();
    }

    // Apply search pattern
    if (preset.searchPattern) {
        var searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.value = preset.searchPattern;
            if (typeof runSearch === 'function') {
                runSearch();
            }
        }
    }

    // Apply exclusions toggle
    if (preset.exclusionsEnabled !== undefined && typeof setExclusionsEnabled === 'function') {
        setExclusionsEnabled(preset.exclusionsEnabled);
    }

    // Apply app-only mode toggle
    if (preset.appOnlyMode !== undefined && typeof setAppOnlyMode === 'function') {
        setAppOnlyMode(preset.appOnlyMode);
    }

    updatePresetDropdown();
    vscodeApi.postMessage({ type: 'presetApplied', name: preset.name });
}

/**
 * Sync output channel checkboxes with activeFilters set.
 */
function syncChannelCheckboxes() {
    var boxes = document.querySelectorAll('#output-channels-list input[type="checkbox"]');
    for (var i = 0; i < boxes.length; i++) {
        boxes[i].checked = !activeFilters || activeFilters.has(boxes[i].dataset.category);
    }
}

/**
 * Update the preset dropdown to reflect current state.
 */
function updatePresetDropdown() {
    var dropdown = document.getElementById('preset-select');
    if (!dropdown) {
        return;
    }

    dropdown.innerHTML = '';

    var noneOpt = document.createElement('option');
    noneOpt.value = '';
    noneOpt.textContent = 'None';
    dropdown.appendChild(noneOpt);

    for (var i = 0; i < filterPresets.length; i++) {
        var opt = document.createElement('option');
        opt.value = filterPresets[i].name;
        opt.textContent = filterPresets[i].name;
        dropdown.appendChild(opt);
    }

    var saveOpt = document.createElement('option');
    saveOpt.value = '__save__';
    saveOpt.textContent = '+ Save current filters...';
    dropdown.appendChild(saveOpt);

    dropdown.value = activePresetName || '';
}

/**
 * Handle preset dropdown change.
 */
function onPresetSelectChange(e) {
    var value = e.target.value;

    if (value === '__save__') {
        vscodeApi.postMessage({ type: 'savePresetRequest', filters: getCurrentFilters() });
        e.target.value = activePresetName || '';
        return;
    }

    if (value === '') {
        activePresetName = null;
        resetAllFilters();
        return;
    }

    applyPreset(value);
}

/**
 * Get current filter state for saving as preset.
 */
function getCurrentFilters() {
    var filters = {};

    // Get category filter from checkboxes
    if (activeFilters) {
        filters.categories = Array.from(activeFilters);
    }

    // Get search pattern
    var searchInput = document.getElementById('search-input');
    if (searchInput && searchInput.value) {
        filters.searchPattern = searchInput.value;
    }

    // Get exclusions state
    if (typeof exclusionsEnabled !== 'undefined') {
        filters.exclusionsEnabled = exclusionsEnabled;
    }

    return filters;
}

/**
 * Mark preset as "dirty" (modified from saved state).
 */
function markPresetDirty() {
    if (activePresetName) {
        activePresetName = null;
        updatePresetDropdown();
    }
}

/** Re-enable all level filters and update footer circle buttons. */
function resetLevelFilters() {
    if (typeof enabledLevels !== 'undefined') {
        enabledLevels = new Set(['info', 'warning', 'error', 'performance', 'todo', 'debug', 'notice']);
    }
    var ids = ['info', 'warning', 'error', 'performance', 'todo', 'debug', 'notice'];
    for (var li = 0; li < ids.length; li++) {
        var btn = document.getElementById('level-' + ids[li] + '-toggle');
        if (btn) btn.classList.add('active');
    }
}

/** Clear the search input and re-run to remove any active search filter. */
function clearSearchFilter() {
    var input = document.getElementById('search-input');
    if (input && input.value) {
        input.value = '';
        if (typeof runSearch === 'function') runSearch();
    }
}

/** Reset all filters back to defaults. */
function resetAllFilters() {
    resetLevelFilters();
    activeFilters = null;
    syncChannelCheckboxes();
    if (typeof setExclusionsEnabled === 'function') setExclusionsEnabled(false);
    if (typeof appOnlyMode !== 'undefined' && appOnlyMode && typeof toggleAppOnly === 'function') toggleAppOnly();
    if (typeof selectAllTags === 'function') selectAllTags();
    if (typeof selectAllClassTags === 'function') selectAllClassTags();
    clearSearchFilter();
    activePresetName = null;
    updatePresetDropdown();
    if (typeof applyLevelFilter === 'function') applyLevelFilter();
    if (typeof applyExclusions === 'function') applyExclusions();
    applyFilter();
    if (typeof syncOptionsPanelUi === 'function') syncOptionsPanelUi();
    if (typeof updateFilterBadge === 'function') updateFilterBadge();
}

// Hook into filter changes to mark preset as dirty
var _origApplyFilter = typeof applyFilter === 'function' ? applyFilter : null;
if (_origApplyFilter) {
    applyFilter = function(cat) {
        markPresetDirty();
        return _origApplyFilter(cat);
    };
}

// Register message handler
window.addEventListener('message', function(event) {
    var msg = event.data;
    if (msg.type === 'setPresets') {
        handleSetPresets(msg);
    } else if (msg.type === 'applyPreset') {
        applyPreset(msg.name);
    }
});

// Register preset dropdown change handler
var presetSelect = document.getElementById('preset-select');
if (presetSelect) {
    presetSelect.addEventListener('change', onPresetSelectChange);
}
`;
}


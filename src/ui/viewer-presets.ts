/**
 * Viewer Presets Script
 *
 * Provides filter preset functionality in the webview including:
 * - Dropdown to select and apply presets
 * - Save current filters as a new preset
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
        // Set filter dropdown to first category (simplified)
        var filterSelect = document.getElementById('filter-select');
        if (filterSelect && preset.categories[0]) {
            filterSelect.value = preset.categories[0];
            if (typeof applyFilter === 'function') {
                applyFilter(preset.categories[0]);
            }
        }
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

    updatePresetDropdown();
    vscodeApi.postMessage({ type: 'presetApplied', name: preset.name });
}

/**
 * Update the preset dropdown to reflect current state.
 */
function updatePresetDropdown() {
    var dropdown = document.getElementById('preset-select');
    if (!dropdown) {
        return;
    }

    // Clear existing options
    dropdown.innerHTML = '';

    // Add default "None" option
    var noneOpt = document.createElement('option');
    noneOpt.value = '';
    noneOpt.textContent = 'Preset: None';
    dropdown.appendChild(noneOpt);

    // Add preset options
    for (var i = 0; i < filterPresets.length; i++) {
        var opt = document.createElement('option');
        opt.value = filterPresets[i].name;
        opt.textContent = filterPresets[i].name;
        dropdown.appendChild(opt);
    }

    // Add "Save current..." option
    var saveOpt = document.createElement('option');
    saveOpt.value = '__save__';
    saveOpt.textContent = '+ Save current filters...';
    dropdown.appendChild(saveOpt);

    // Set current selection
    dropdown.value = activePresetName || '';
}

/**
 * Handle preset dropdown change.
 */
function onPresetSelectChange(e) {
    var value = e.target.value;

    if (value === '__save__') {
        // Request extension to prompt for save
        vscodeApi.postMessage({ type: 'savePresetRequest', filters: getCurrentFilters() });
        // Reset dropdown to previous value
        e.target.value = activePresetName || '';
        return;
    }

    if (value === '') {
        // Clear preset
        activePresetName = null;
        return;
    }

    applyPreset(value);
}

/**
 * Get current filter state for saving as preset.
 */
function getCurrentFilters() {
    var filters = {};

    // Get category filter
    var filterSelect = document.getElementById('filter-select');
    if (filterSelect && filterSelect.value && filterSelect.value !== 'all') {
        filters.categories = [filterSelect.value];
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

/**
 * Returns the HTML for the preset dropdown control.
 */
export function getPresetDropdownHtml(): string {
    return `<select id="preset-select" title="Filter Presets">
        <option value="">Preset: None</option>
    </select>`;
}

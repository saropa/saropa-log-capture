/**
 * Presets Submenu Script
 *
 * Builds and manages the filter presets flyout submenu inside the
 * kebab actions dropdown. Each preset item shows a detailed tooltip
 * describing what filters it changes.
 *
 * Depends on globals from viewer-presets.ts: filterPresets,
 * activePresetName, applyPreset, resetAllFilters, getCurrentFilters.
 */

/**
 * Returns the JavaScript for the presets submenu in the kebab menu.
 *
 * Must be loaded after getPresetsScript() so that `filterPresets`,
 * `activePresetName`, `applyPreset`, `resetAllFilters`, and
 * `getCurrentFilters` are already defined.
 */
export function getPresetsSubmenuScript(): string {
    return /* javascript */ `

/** Rebuild the presets submenu in the kebab actions dropdown. */
function updatePresetsSubmenu() {
    var submenu = document.getElementById('presets-submenu');
    if (!submenu) return;
    submenu.innerHTML = '';

    /* Default (reset) option — always first */
    var defBtn = document.createElement('button');
    defBtn.type = 'button';
    defBtn.className = 'footer-actions-item preset-submenu-item';
    defBtn.setAttribute('data-preset', '');
    defBtn.setAttribute('role', 'menuitem');
    defBtn.title = 'Reset all filters to defaults: all levels enabled, ' +
        'Flutter DAP=All, Device=Warn+, External=Warn+, no search or exclusions';
    defBtn.innerHTML = '<span class="codicon codicon-clear-all" ' +
        'aria-hidden="true"></span> Default';
    if (!activePresetName) defBtn.classList.add('preset-active');
    submenu.appendChild(defBtn);

    /* User-saved presets */
    for (var i = 0; i < filterPresets.length; i++) {
        var p = filterPresets[i];
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'footer-actions-item preset-submenu-item';
        btn.setAttribute('data-preset', p.name);
        btn.setAttribute('role', 'menuitem');
        btn.title = buildPresetTooltip(p);
        btn.innerHTML = '<span class="codicon codicon-bookmark" aria-hidden="true"></span> ' +
            presetEscapeHtml(p.name);
        if (activePresetName === p.name) btn.classList.add('preset-active');
        submenu.appendChild(btn);
    }

    /* Separator + Save current option — always last */
    var sep = document.createElement('hr');
    sep.className = 'footer-actions-separator';
    sep.setAttribute('role', 'separator');
    submenu.appendChild(sep);

    var saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.className = 'footer-actions-item preset-submenu-item';
    saveBtn.setAttribute('data-preset', '__save__');
    saveBtn.setAttribute('role', 'menuitem');
    saveBtn.title = 'Save the current combination of levels, sources, ' +
        'search, and exclusion filters as a named preset';
    saveBtn.innerHTML = '<span class="codicon codicon-save" ' +
        'aria-hidden="true"></span> Save current filters\\u2026';
    submenu.appendChild(saveBtn);

    /* Wire click handlers for all submenu items */
    var items = submenu.querySelectorAll('.preset-submenu-item');
    for (var j = 0; j < items.length; j++) {
        items[j].addEventListener('click', onPresetSubmenuClick);
    }
}

/**
 * Build a descriptive tooltip for a preset showing what it changes.
 * Each non-default filter value appears on its own line.
 */
function buildPresetTooltip(preset) {
    var parts = [];
    if (preset.levels && preset.levels.length > 0) {
        parts.push('Levels: ' + preset.levels.join(', '));
    }
    if (preset.flutterMode && preset.flutterMode !== 'all') {
        parts.push('Flutter DAP: ' + preset.flutterMode);
    }
    if (preset.deviceMode && preset.deviceMode !== 'warnplus') {
        parts.push('Device: ' + preset.deviceMode);
    }
    if (preset.externalMode && preset.externalMode !== 'warnplus') {
        parts.push('External: ' + preset.externalMode);
    }
    if (preset.searchPattern) {
        parts.push('Search: ' + preset.searchPattern);
    }
    if (preset.exclusionsEnabled) {
        parts.push('Exclusions: enabled');
    }
    if (preset.categories && preset.categories.length > 0) {
        parts.push('Categories: ' + preset.categories.join(', '));
    }
    if (parts.length === 0) {
        return 'Apply the "' + preset.name + '" preset';
    }
    return parts.join('\\n');
}

/** Minimal HTML escaping for preset names in innerHTML. */
function presetEscapeHtml(text) {
    var el = document.createElement('span');
    el.textContent = text;
    return el.innerHTML;
}

/** Handle click on a preset submenu item. */
function onPresetSubmenuClick(e) {
    var btn = e.currentTarget;
    var value = btn.getAttribute('data-preset');
    if (value === '__save__') {
        vscodeApi.postMessage({
            type: 'savePresetRequest',
            filters: getCurrentFilters(),
        });
    } else if (value === '' || value === null) {
        activePresetName = null;
        resetAllFilters();
    } else {
        applyPreset(value);
    }
    /* Close the actions dropdown after selection */
    if (typeof window.setFooterActionsOpen === 'function') {
        window.setFooterActionsOpen(false);
    }
}
`;
}

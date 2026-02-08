/** Returns the JavaScript code for the options panel. */
export function getOptionsPanelScript(): string {
    return /* javascript */ `
var optionsPanelOpen = false;

/** Test if a row (and its indent sibling) matches the filter; toggle visibility. */
function matchRowAndIndent(row, q) {
    var match = row.textContent.toLowerCase().indexOf(q) >= 0;
    row.classList.toggle('options-filtered-hidden', !match);
    var next = row.nextElementSibling;
    if (next && next.classList.contains('options-indent')) {
        var indentMatch = next.textContent.toLowerCase().indexOf(q) >= 0;
        next.classList.toggle('options-filtered-hidden', !match && !indentMatch);
        if (indentMatch) row.classList.remove('options-filtered-hidden');
        return match || indentMatch;
    }
    return match;
}

/** Filter options panel sections/rows by query string. */
function filterOptionsPanel(query) {
    var q = (query || '').toLowerCase().trim();
    var clearBtn = document.getElementById('options-search-clear');
    if (clearBtn) clearBtn.classList.toggle('visible', q.length > 0);
    var sections = document.querySelectorAll('#options-panel .options-section');
    for (var s = 0; s < sections.length; s++) {
        var sec = sections[s];
        var title = sec.querySelector('.options-section-title');
        var titleMatch = title && title.textContent.toLowerCase().indexOf(q) >= 0;
        if (!q || titleMatch) {
            sec.classList.remove('options-filtered-hidden');
            var allItems = sec.querySelectorAll('.options-row, .options-indent, .exclusion-input-wrapper, .exclusion-chips, .options-hint');
            for (var i = 0; i < allItems.length; i++) allItems[i].classList.remove('options-filtered-hidden');
            continue;
        }
        var rows = sec.querySelectorAll(':scope > .options-row');
        var anyVisible = false;
        for (var r = 0; r < rows.length; r++) {
            if (matchRowAndIndent(rows[r], q)) anyVisible = true;
        }
        var extras = sec.querySelectorAll(':scope > .exclusion-input-wrapper, :scope > .exclusion-chips, :scope > .options-hint');
        for (var x = 0; x < extras.length; x++) extras[x].classList.toggle('options-filtered-hidden', !anyVisible);
        sec.classList.toggle('options-filtered-hidden', !anyVisible);
    }
}

function toggleOptionsPanel() {
    var panel = document.getElementById('options-panel');
    if (!panel) return;
    optionsPanelOpen = !optionsPanelOpen;
    if (optionsPanelOpen) {
        if (typeof closeSearch === 'function') closeSearch();
        var searchInput = document.getElementById('options-search');
        if (searchInput) { searchInput.value = ''; filterOptionsPanel(''); }
        syncOptionsPanelUi();
        panel.classList.add('visible');
    } else {
        panel.classList.remove('visible');
    }
}

/** Open the options panel (called from icon bar). */
function openOptionsPanel() {
    if (optionsPanelOpen) return;
    optionsPanelOpen = true;
    if (typeof closeSearch === 'function') closeSearch();
    var searchInput = document.getElementById('options-search');
    if (searchInput) { searchInput.value = ''; filterOptionsPanel(''); }
    var panel = document.getElementById('options-panel');
    if (panel) {
        syncOptionsPanelUi();
        panel.classList.add('visible');
    }
}

function closeOptionsPanel() {
    var panel = document.getElementById('options-panel');
    if (panel) panel.classList.remove('visible');
    optionsPanelOpen = false;
    if (typeof clearActivePanel === 'function') clearActivePanel('options');
}

/** Sync display checkboxes and sliders from state. */
function syncDisplayUi() {
    var wrapCheck = document.getElementById('opt-wrap');
    var decoCheck = document.getElementById('opt-decorations');
    var decoIndent = document.getElementById('decoration-options');
    if (wrapCheck) wrapCheck.checked = wordWrap;
    if (decoCheck) decoCheck.checked = showDecorations;
    if (decoIndent) {
        decoIndent.classList.toggle('options-indent-disabled', !showDecorations);
        var decoInputs = decoIndent.querySelectorAll('input, select');
        for (var i = 0; i < decoInputs.length; i++) decoInputs[i].disabled = !showDecorations;
    }
    var fSlider = document.getElementById('font-size-slider');
    var fLabel = document.getElementById('font-size-label');
    if (fSlider && typeof logFontSize !== 'undefined') {
        fSlider.value = logFontSize;
        if (fLabel) fLabel.textContent = logFontSize + 'px';
    }
    var lhSlider = document.getElementById('line-height-slider');
    var lhLabel = document.getElementById('line-height-label');
    if (lhSlider && typeof logLineHeight !== 'undefined') {
        lhSlider.value = Math.round(logLineHeight * 10);
        if (lhLabel) lhLabel.textContent = logLineHeight.toFixed(1);
    }
}

/** Sync decoration sub-option checkboxes from state. */
function syncDecoUi() {
    var decoDot = document.getElementById('opt-deco-dot');
    var decoCtr = document.getElementById('opt-deco-counter');
    var decoTs = document.getElementById('opt-deco-timestamp');
    var decoMs = document.getElementById('opt-deco-milliseconds');
    var decoElapsed = document.getElementById('opt-deco-elapsed');
    var lineColor = document.getElementById('opt-line-color');
    var decoBar = document.getElementById('opt-deco-bar');
    if (decoDot) decoDot.checked = decoShowDot;
    if (decoCtr) decoCtr.checked = decoShowCounter;
    if (decoTs) decoTs.checked = decoShowTimestamp;
    if (decoMs) decoMs.checked = (typeof showMilliseconds !== 'undefined') && showMilliseconds;
    if (decoElapsed) decoElapsed.checked = showElapsed;
    if (lineColor) lineColor.value = decoLineColorMode;
    if (decoBar && typeof decoShowBar !== 'undefined') decoBar.checked = decoShowBar;
}

/** Sync audio checkboxes and sliders from state. */
function syncAudioUi() {
    var audioCheck = document.getElementById('opt-audio');
    var audioOpts = document.getElementById('audio-options');
    if (audioCheck && typeof audioEnabled !== 'undefined') audioCheck.checked = audioEnabled;
    if (audioOpts) audioOpts.style.display = audioEnabled ? 'block' : 'none';
    var volSlider = document.getElementById('audio-volume-slider');
    var volLabel = document.getElementById('audio-volume-label');
    if (volSlider && typeof audioVolume !== 'undefined') {
        volSlider.value = Math.round(audioVolume * 100);
        if (volLabel) volLabel.textContent = Math.round(audioVolume * 100) + '%';
    }
    var rl = document.getElementById('audio-rate-limit');
    if (rl && typeof audioRateLimit !== 'undefined') rl.value = audioRateLimit.toString();
}

/** Sync all options panel controls from current state variables. */
function syncOptionsPanelUi() {
    syncDisplayUi();
    syncDecoUi();
    var exclCheck = document.getElementById('opt-exclusions');
    var appOnlyCheck = document.getElementById('opt-app-only');
    if (exclCheck && typeof exclusionsEnabled !== 'undefined') exclCheck.checked = exclusionsEnabled;
    if (typeof rebuildExclusionChips === 'function') rebuildExclusionChips();
    if (appOnlyCheck && typeof appOnlyMode !== 'undefined') appOnlyCheck.checked = appOnlyMode;
    var vsCheck = document.getElementById('opt-visual-spacing');
    if (vsCheck && typeof visualSpacingEnabled !== 'undefined') vsCheck.checked = visualSpacingEnabled;
    syncAudioUi();
    if (typeof updatePresetDropdown === 'function') updatePresetDropdown();
}

/* Register event listeners for options panel controls. */
var optionsCloseBtn = document.querySelector('.options-close');
if (optionsCloseBtn) optionsCloseBtn.addEventListener('click', closeOptionsPanel);

// Options search filter
var optionsSearchInput = document.getElementById('options-search');
var optionsSearchClear = document.getElementById('options-search-clear');
if (optionsSearchInput) {
    optionsSearchInput.addEventListener('input', function(e) { filterOptionsPanel(e.target.value); });
}
if (optionsSearchClear) {
    optionsSearchClear.addEventListener('click', function() {
        if (optionsSearchInput) { optionsSearchInput.value = ''; optionsSearchInput.focus(); }
        filterOptionsPanel('');
    });
}

// Font size and line height sliders
var fontSizeSlider = document.getElementById('font-size-slider');
var fontSizeLabel = document.getElementById('font-size-label');
var lineHeightSlider = document.getElementById('line-height-slider');
var lineHeightLabel = document.getElementById('line-height-label');
if (fontSizeSlider && fontSizeLabel) {
    fontSizeSlider.addEventListener('input', function(e) {
        var size = parseInt(e.target.value, 10);
        fontSizeLabel.textContent = size + 'px';
        if (typeof setFontSize === 'function') setFontSize(size);
    });
}
if (lineHeightSlider && lineHeightLabel) {
    lineHeightSlider.addEventListener('input', function(e) {
        var height = parseInt(e.target.value, 10) / 10;
        lineHeightLabel.textContent = height.toFixed(1);
        if (typeof setLineHeight === 'function') setLineHeight(height);
    });
}

// Display options
var optWrap = document.getElementById('opt-wrap');
var optDeco = document.getElementById('opt-decorations');
if (optWrap) optWrap.addEventListener('change', function(e) {
    if (typeof toggleWrap === 'function') toggleWrap();
    syncOptionsPanelUi();
});
if (optDeco) optDeco.addEventListener('change', function(e) {
    if (typeof toggleDecorations === 'function') toggleDecorations();
    syncOptionsPanelUi();
});
// Decoration sub-options — sync to deco settings panel and delegate to onDecoOptionChange
var decoCheckIds = [
    'opt-deco-dot', 'opt-deco-counter', 'opt-deco-timestamp',
    'opt-deco-milliseconds', 'opt-deco-elapsed', 'opt-deco-bar'
];
decoCheckIds.forEach(function(id) {
    var el = document.getElementById(id);
    var decoId = id.replace('opt-deco-', 'deco-opt-');
    if (el) el.addEventListener('change', function(e) {
        var decoEl = document.getElementById(decoId);
        if (decoEl) decoEl.checked = e.target.checked;
        if (typeof onDecoOptionChange === 'function') onDecoOptionChange();
    });
});
var optLineColor = document.getElementById('opt-line-color');
if (optLineColor) optLineColor.addEventListener('change', function(e) {
    var decoMode = document.getElementById('deco-line-color-mode');
    if (decoMode) decoMode.value = e.target.value;
    if (typeof onDecoOptionChange === 'function') onDecoOptionChange();
});

// Noise reduction options
var optExcl = document.getElementById('opt-exclusions');
var optAppOnly = document.getElementById('opt-app-only');
if (optExcl) optExcl.addEventListener('change', function(e) {
    if (typeof setExclusionsEnabled === 'function') setExclusionsEnabled(e.target.checked);
    if (typeof rebuildExclusionChips === 'function') rebuildExclusionChips();
    syncOptionsPanelUi();
});
if (optAppOnly) optAppOnly.addEventListener('change', function(e) {
    if (typeof setAppOnlyMode === 'function') setAppOnlyMode(e.target.checked);
    syncOptionsPanelUi();
});

// Layout options
var optVisualSpacing = document.getElementById('opt-visual-spacing');
if (optVisualSpacing) optVisualSpacing.addEventListener('change', function(e) {
    if (typeof toggleVisualSpacing === 'function') toggleVisualSpacing();
    syncOptionsPanelUi();
});

// Audio
var optAudio = document.getElementById('opt-audio');
if (optAudio) optAudio.addEventListener('change', function(e) {
    if (typeof toggleAudio === 'function') toggleAudio();
    syncOptionsPanelUi();
});

// Audio sub-options
var audioVolumeSlider = document.getElementById('audio-volume-slider');
var audioVolumeLabel = document.getElementById('audio-volume-label');
var audioRateLimitSelect = document.getElementById('audio-rate-limit');
var previewErrorBtn = document.getElementById('preview-error-sound');
var previewWarningBtn = document.getElementById('preview-warning-sound');

if (audioVolumeSlider) {
    audioVolumeSlider.addEventListener('input', function(e) {
        var value = parseInt(e.target.value, 10);
        if (audioVolumeLabel) audioVolumeLabel.textContent = value + '%';
        if (typeof setAudioVolume === 'function') setAudioVolume(value);
    });
}
if (audioRateLimitSelect) {
    audioRateLimitSelect.addEventListener('change', function(e) {
        if (typeof audioRateLimit !== 'undefined') {
            audioRateLimit = parseInt(e.target.value, 10);
        }
    });
}
if (previewErrorBtn) previewErrorBtn.addEventListener('click', function(e) {
    e.preventDefault(); if (typeof previewAudioSound === 'function') previewAudioSound('error');
});
if (previewWarningBtn) previewWarningBtn.addEventListener('click', function(e) {
    e.preventDefault(); if (typeof previewAudioSound === 'function') previewAudioSound('warning');
});

var resetBtn = document.getElementById('reset-all-filters');
if (resetBtn) resetBtn.addEventListener('click', function() {
    if (typeof resetAllFilters === 'function') resetAllFilters();
});

document.addEventListener('click', function(e) {
    if (!optionsPanelOpen) return;
    var panel = document.getElementById('options-panel');
    var ibBtn = document.getElementById('ib-options');
    var badgeBtn = document.getElementById('filter-badge');
    if (panel && !panel.contains(e.target)
        && ibBtn !== e.target && !ibBtn?.contains(e.target)
        && badgeBtn !== e.target) {
        closeOptionsPanel();
    }
});
`;
}

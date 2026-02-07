/**
 * JavaScript code for the options panel.
 *
 * Handles opening/closing the panel, syncing UI state with internal variables,
 * and wiring up event listeners for all controls.
 */

/** Returns the JavaScript code for the options panel. */
export function getOptionsPanelScript(): string {
    return /* javascript */ `
var optionsPanelOpen = false;

/**
 * Toggle the options panel open/closed.
 */
function toggleOptionsPanel() {
    var panel = document.getElementById('options-panel');
    if (!panel) return;

    optionsPanelOpen = !optionsPanelOpen;
    if (optionsPanelOpen) {
        if (typeof closeSearch === 'function') closeSearch();
        if (typeof closeSessionPanel === 'function') closeSessionPanel();
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
    if (typeof closeSessionPanel === 'function') closeSessionPanel();
    var panel = document.getElementById('options-panel');
    if (panel) {
        syncOptionsPanelUi();
        panel.classList.add('visible');
    }
}

/**
 * Close the options panel.
 */
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
if (optionsCloseBtn) {
    optionsCloseBtn.addEventListener('click', closeOptionsPanel);
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
if (previewErrorBtn) {
    previewErrorBtn.addEventListener('click', function(e) {
        e.preventDefault();
        if (typeof previewAudioSound === 'function') previewAudioSound('error');
    });
}
if (previewWarningBtn) {
    previewWarningBtn.addEventListener('click', function(e) {
        e.preventDefault();
        if (typeof previewAudioSound === 'function') previewAudioSound('warning');
    });
}

// Reset all filters button
var resetBtn = document.getElementById('reset-all-filters');
if (resetBtn) {
    resetBtn.addEventListener('click', function() {
        if (typeof resetAllFilters === 'function') resetAllFilters();
    });
}

/* Close panel when clicking outside it. */
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

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
        syncOptionsPanelUi();
        panel.classList.add('visible');
    } else {
        panel.classList.remove('visible');
    }
}

/**
 * Close the options panel.
 */
function closeOptionsPanel() {
    var panel = document.getElementById('options-panel');
    if (panel) panel.classList.remove('visible');
    optionsPanelOpen = false;
}

/**
 * Sync all options panel checkboxes/selects from current state variables.
 */
function syncOptionsPanelUi() {
    // Display options
    var wrapCheck = document.getElementById('opt-wrap');
    var decoCheck = document.getElementById('opt-decorations');
    var inlineCtxCheck = document.getElementById('opt-inline-context');
    var decoIndent = document.getElementById('decoration-options');
    if (wrapCheck) wrapCheck.checked = wordWrap;
    if (decoCheck) decoCheck.checked = showDecorations;
    if (inlineCtxCheck && typeof showInlineContext !== 'undefined') inlineCtxCheck.checked = showInlineContext;
    if (decoIndent) decoIndent.style.display = showDecorations ? 'block' : 'none';

    // Font size and line height
    var fontSizeSlider = document.getElementById('font-size-slider');
    var fontSizeLabel = document.getElementById('font-size-label');
    var lineHeightSlider = document.getElementById('line-height-slider');
    var lineHeightLabel = document.getElementById('line-height-label');
    if (fontSizeSlider && typeof logFontSize !== 'undefined') {
        fontSizeSlider.value = logFontSize;
        if (fontSizeLabel) fontSizeLabel.textContent = logFontSize + 'px';
    }
    if (lineHeightSlider && typeof logLineHeight !== 'undefined') {
        lineHeightSlider.value = Math.round(logLineHeight * 10);
        if (lineHeightLabel) lineHeightLabel.textContent = logLineHeight.toFixed(1);
    }

    // Decoration sub-options
    var decoDot = document.getElementById('opt-deco-dot');
    var decoCtr = document.getElementById('opt-deco-counter');
    var decoTs = document.getElementById('opt-deco-timestamp');
    var decoElapsed = document.getElementById('opt-deco-elapsed');
    var lineColor = document.getElementById('opt-line-color');
    if (decoDot) decoDot.checked = decoShowDot;
    if (decoCtr) decoCtr.checked = decoShowCounter;
    if (decoTs) decoTs.checked = decoShowTimestamp;
    if (decoElapsed) decoElapsed.checked = showElapsed;
    if (lineColor) lineColor.value = decoLineColorMode;

    // Level filters
    var levelInfo = document.getElementById('opt-level-info');
    var levelWarn = document.getElementById('opt-level-warning');
    var levelError = document.getElementById('opt-level-error');
    var levelPerf = document.getElementById('opt-level-perf');
    var levelTodo = document.getElementById('opt-level-todo');
    var levelDebug = document.getElementById('opt-level-debug');
    var levelNotice = document.getElementById('opt-level-notice');
    if (levelInfo && typeof enabledLevels !== 'undefined') levelInfo.checked = enabledLevels.has('info');
    if (levelWarn && typeof enabledLevels !== 'undefined') levelWarn.checked = enabledLevels.has('warning');
    if (levelError && typeof enabledLevels !== 'undefined') levelError.checked = enabledLevels.has('error');
    if (levelPerf && typeof enabledLevels !== 'undefined') levelPerf.checked = enabledLevels.has('performance');
    if (levelTodo && typeof enabledLevels !== 'undefined') levelTodo.checked = enabledLevels.has('todo');
    if (levelDebug && typeof enabledLevels !== 'undefined') levelDebug.checked = enabledLevels.has('debug');
    if (levelNotice && typeof enabledLevels !== 'undefined') levelNotice.checked = enabledLevels.has('notice');

    // Filtering options
    var exclCheck = document.getElementById('opt-exclusions');
    var appOnlyCheck = document.getElementById('opt-app-only');
    if (exclCheck && typeof exclusionsActive !== 'undefined') exclCheck.checked = exclusionsActive;
    if (appOnlyCheck && typeof appOnlyMode !== 'undefined') appOnlyCheck.checked = appOnlyMode;

    // Layout options
    var visualSpacingCheck = document.getElementById('opt-visual-spacing');
    if (visualSpacingCheck && typeof visualSpacingEnabled !== 'undefined') visualSpacingCheck.checked = visualSpacingEnabled;

    // Audio
    var audioCheck = document.getElementById('opt-audio');
    var audioOptions = document.getElementById('audio-options');
    if (audioCheck && typeof audioEnabled !== 'undefined') audioCheck.checked = audioEnabled;
    if (audioOptions) audioOptions.style.display = audioEnabled ? 'block' : 'none';

    // Audio sub-options
    var volumeSlider = document.getElementById('audio-volume-slider');
    var volumeLabel = document.getElementById('audio-volume-label');
    var rateLimit = document.getElementById('audio-rate-limit');
    if (volumeSlider && typeof audioVolume !== 'undefined') {
        volumeSlider.value = Math.round(audioVolume * 100);
        if (volumeLabel) volumeLabel.textContent = Math.round(audioVolume * 100) + '%';
    }
    if (rateLimit && typeof audioRateLimit !== 'undefined') {
        rateLimit.value = audioRateLimit.toString();
    }
}

/* Register event listeners for options panel controls. */
var optionsPanelBtn = document.getElementById('options-panel-btn');
var optionsCloseBtn = document.querySelector('.options-close');
if (optionsPanelBtn) {
    optionsPanelBtn.addEventListener('click', toggleOptionsPanel);
}
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
var optInlineCtx = document.getElementById('opt-inline-context');
if (optWrap) optWrap.addEventListener('change', function(e) {
    if (typeof toggleWrap === 'function') toggleWrap();
    syncOptionsPanelUi();
});
if (optDeco) optDeco.addEventListener('change', function(e) {
    if (typeof toggleDecorations === 'function') toggleDecorations();
    syncOptionsPanelUi();
});
if (optInlineCtx) optInlineCtx.addEventListener('change', function(e) {
    if (typeof toggleInlineContext === 'function') toggleInlineContext();
    syncOptionsPanelUi();
});

// Decoration sub-options
var optDecoDot = document.getElementById('opt-deco-dot');
var optDecoCtr = document.getElementById('opt-deco-counter');
var optDecoTs = document.getElementById('opt-deco-timestamp');
var optDecoElapsed = document.getElementById('opt-deco-elapsed');
var optLineColor = document.getElementById('opt-line-color');
if (optDecoDot) optDecoDot.addEventListener('change', function(e) {
    decoShowDot = e.target.checked;
    renderViewport(true);
});
if (optDecoCtr) optDecoCtr.addEventListener('change', function(e) {
    decoShowCounter = e.target.checked;
    renderViewport(true);
});
if (optDecoTs) optDecoTs.addEventListener('change', function(e) {
    decoShowTimestamp = e.target.checked;
    renderViewport(true);
});
if (optDecoElapsed) optDecoElapsed.addEventListener('change', function(e) {
    showElapsed = e.target.checked;
    renderViewport(true);
});
if (optLineColor) optLineColor.addEventListener('change', function(e) {
    decoLineColorMode = e.target.value;
    renderViewport(true);
});

// Level filters
var optLevelInfo = document.getElementById('opt-level-info');
var optLevelWarn = document.getElementById('opt-level-warning');
var optLevelError = document.getElementById('opt-level-error');
var optLevelPerf = document.getElementById('opt-level-perf');
var optLevelTodo = document.getElementById('opt-level-todo');
var optLevelDebug = document.getElementById('opt-level-debug');
var optLevelNotice = document.getElementById('opt-level-notice');
if (optLevelInfo) optLevelInfo.addEventListener('change', function(e) {
    if (typeof toggleLevel === 'function') toggleLevel('info');
});
if (optLevelWarn) optLevelWarn.addEventListener('change', function(e) {
    if (typeof toggleLevel === 'function') toggleLevel('warning');
});
if (optLevelError) optLevelError.addEventListener('change', function(e) {
    if (typeof toggleLevel === 'function') toggleLevel('error');
});
if (optLevelPerf) optLevelPerf.addEventListener('change', function(e) {
    if (typeof toggleLevel === 'function') toggleLevel('performance');
});
if (optLevelTodo) optLevelTodo.addEventListener('change', function(e) {
    if (typeof toggleLevel === 'function') toggleLevel('todo');
});
if (optLevelDebug) optLevelDebug.addEventListener('change', function(e) {
    if (typeof toggleLevel === 'function') toggleLevel('debug');
});
if (optLevelNotice) optLevelNotice.addEventListener('change', function(e) {
    if (typeof toggleLevel === 'function') toggleLevel('notice');
});

// Filtering options
var optExcl = document.getElementById('opt-exclusions');
var optAppOnly = document.getElementById('opt-app-only');
if (optExcl) optExcl.addEventListener('change', function(e) {
    if (typeof toggleExclusions === 'function') toggleExclusions();
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

/* Close panel when clicking outside it. */
document.addEventListener('click', function(e) {
    if (!optionsPanelOpen) return;
    var panel = document.getElementById('options-panel');
    var optionsBtn = document.getElementById('options-panel-btn');
    if (panel && !panel.contains(e.target) && optionsBtn !== e.target && !optionsBtn?.contains(e.target)) {
        closeOptionsPanel();
    }
});
`;
}

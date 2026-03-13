/** Returns the JavaScript event wiring code for the options panel controls. */
export function getOptionsEventHandlers(): string {
    return /* javascript */ `
/* Register event listeners for options panel controls. */
var optionsCloseBtn = document.querySelector('#options-panel .options-close');
if (optionsCloseBtn) optionsCloseBtn.addEventListener('click', closeOptionsPanel);

// Capture master switch
var optCaptureEnabled = document.getElementById('opt-capture-enabled');
if (optCaptureEnabled) optCaptureEnabled.addEventListener('change', function(e) {
    var enabled = !!e.target.checked;
    vscodeApi.postMessage({ type: 'setCaptureEnabled', enabled: enabled });
});

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

// Layout options
var optVisualSpacing = document.getElementById('opt-visual-spacing');
if (optVisualSpacing) optVisualSpacing.addEventListener('change', function(e) {
    if (typeof toggleVisualSpacing === 'function') toggleVisualSpacing();
    syncOptionsPanelUi();
});
var optHideBlankLines = document.getElementById('opt-hide-blank-lines');
if (optHideBlankLines) optHideBlankLines.addEventListener('change', function(e) {
    if (typeof toggleHideBlankLines === 'function') toggleHideBlankLines();
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
var volumePreviewDebounceTimer = null;

if (audioVolumeSlider) {
    audioVolumeSlider.addEventListener('input', function(e) {
        var value = parseInt(e.target.value, 10);
        if (audioVolumeLabel) audioVolumeLabel.textContent = value + '%';
        if (typeof setAudioVolume === 'function') setAudioVolume(value);
        // Debounced preview: play sound after user stops dragging
        if (volumePreviewDebounceTimer) clearTimeout(volumePreviewDebounceTimer);
        volumePreviewDebounceTimer = setTimeout(function() {
            if (typeof previewAudioSound === 'function') previewAudioSound('warning');
        }, 300);
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

// Export current view: open the same export modal as context menu "Export current view…".
var optionsExportBtn = document.getElementById('options-export-btn');
if (optionsExportBtn) {
    optionsExportBtn.addEventListener('click', function(e) {
        e.preventDefault();
        if (typeof window.openExportModal === 'function') window.openExportModal();
    });
}

// Reset to default: restore all options panel values (display, layout, audio).
var resetOptionsBtn = document.getElementById('reset-options-btn');
if (resetOptionsBtn && typeof resetOptionsToDefault === 'function') {
    resetOptionsBtn.addEventListener('click', function(e) {
        e.preventDefault();
        resetOptionsToDefault();
    });
}

// Reset extension settings: run host command (confirmation in host).
var resetSettingsBtn = document.getElementById('reset-settings-btn');
if (resetSettingsBtn) {
    resetSettingsBtn.addEventListener('click', function(e) {
        e.preventDefault();
        if (typeof vscodeApi !== 'undefined' && vscodeApi.postMessage) {
            vscodeApi.postMessage({ type: 'resetAllSettings' });
        }
    });
}

// Integrations: collect checked adapter ids and send to host on change.
var integrationsSection = document.getElementById('integrations-section');
if (integrationsSection) {
    integrationsSection.addEventListener('change', function(e) {
        if (!e.target || !e.target.matches || !e.target.matches('input[data-adapter-id]')) return;
        var inputs = integrationsSection.querySelectorAll('input[data-adapter-id]:checked');
        var adapterIds = [];
        for (var i = 0; i < inputs.length; i++) {
            var id = inputs[i].getAttribute('data-adapter-id');
            if (id) adapterIds.push(id);
        }
        if (typeof vscodeApi !== 'undefined' && vscodeApi.postMessage) {
            vscodeApi.postMessage({ type: 'setIntegrationsAdapters', adapterIds: adapterIds });
        }
    });
}

document.addEventListener('click', function(e) {
    if (!optionsPanelOpen) return;
    var panel = document.getElementById('options-panel');
    var ibBtn = document.getElementById('ib-options');
    if (panel && !panel.contains(e.target)
        && ibBtn !== e.target && !ibBtn?.contains(e.target)) {
        closeOptionsPanel();
    }
});
`;
}

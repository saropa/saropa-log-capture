import { getOptionsEventHandlers } from './viewer-options-events';
import { getOptionsIntegrationsHelperScript } from './viewer-options-integrations-helper';
import { getOptionsPanelViewsScript } from './viewer-options-panel-views';

/** Returns the JavaScript code for the options panel. */
export function getOptionsPanelScript(): string {
    return /* javascript */ `
var optionsPanelOpen = false;
var minimapShowSqlDensity = true;
// Keeps Options › Layout scroll map width in sync with workspace saropaLogCapture.minimapWidth.
var minimapWidthSetting = 'medium';

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
            var allItems = sec.querySelectorAll('.options-row, .options-indent');
            for (var i = 0; i < allItems.length; i++) allItems[i].classList.remove('options-filtered-hidden');
            continue;
        }
        var rows = sec.querySelectorAll(':scope > .options-row');
        var anyVisible = false;
        for (var r = 0; r < rows.length; r++) {
            if (matchRowAndIndent(rows[r], q)) anyVisible = true;
        }
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

/** Open the options panel (called from icon bar). Moves focus into panel for a11y. */
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
        requestAnimationFrame(function() {
            var first = panel.querySelector('button.options-close, #options-search');
            if (first) first.focus();
        });
    }
}

function closeOptionsPanel() {
    /* Return to Options view when closing so next open shows Options, not Integrations/shortcuts. */
    if (integrationsViewOpen) closeIntegrationsView();
    if (shortcutsViewOpen) closeShortcutsView();
    var panel = document.getElementById('options-panel');
    if (panel) panel.classList.remove('visible');
    optionsPanelOpen = false;
    if (typeof clearActivePanel === 'function') clearActivePanel('options');
    /* Return focus to icon bar for keyboard/screen-reader users (a11y). */
    var optsBtn = document.getElementById('ib-options');
    if (optsBtn) optsBtn.focus();
}

/** Sync display checkboxes and sliders from state. */
function syncDisplayUi() {
    var wrapCheck = document.getElementById('opt-wrap');
    if (wrapCheck) wrapCheck.checked = wordWrap;
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

${getOptionsPanelViewsScript()}
${getOptionsIntegrationsHelperScript()}

/** Sync capture-enabled checkbox from window.captureEnabled (set by host message). */
function syncCaptureEnabledUi() {
    var check = document.getElementById('opt-capture-enabled');
    if (check) check.checked = (typeof window !== 'undefined' && window.captureEnabled !== false);
}

/** Render the severity keywords display from the current keyword config. */
function renderSeverityKeywordsDisplay() {
    var container = document.getElementById('severity-keywords-display');
    if (!container) return;
    var levels = [
        { key: 'error', label: 'Error', color: 'var(--vscode-debugConsole-errorForeground, #f48771)' },
        { key: 'warning', label: 'Warning', color: 'var(--vscode-debugConsole-warningForeground, #cca700)' },
        { key: 'performance', label: 'Performance', color: 'var(--vscode-charts-purple, #b180d7)' },
        { key: 'todo', label: 'TODO', color: 'var(--vscode-charts-blue, #75beff)' },
        { key: 'debug', label: 'Debug', color: 'var(--vscode-debugConsole-infoForeground, #75beff)' },
        { key: 'notice', label: 'Notice', color: 'var(--vscode-charts-green, #89d185)' },
    ];
    var html = '';
    for (var i = 0; i < levels.length; i++) {
        var lv = levels[i];
        var kws = (currentSeverityKeywords && currentSeverityKeywords[lv.key]) || [];
        var kwHtml = kws.map(function(k) { return '<span class="sk-pill">' + escapeHtml(k) + '</span>'; }).join(' ');
        html += '<div class="sk-level-row">'
            + '<span class="sk-dot" style="background:' + lv.color + '"></span>'
            + '<span class="sk-label">' + lv.label + '</span>'
            + '<span class="sk-pills">' + (kwHtml || '<em>none</em>') + '</span>'
            + '</div>';
    }
    container.innerHTML = html;
}

var currentSeverityKeywords = null;

/** Sync all options panel controls from current state variables. */
function syncOptionsPanelUi() {
    syncCaptureEnabledUi();
    syncDisplayUi();
    syncDecoUi();
    var vsCheck = document.getElementById('opt-visual-spacing');
    var minimapSqlDensityCheck = document.getElementById('opt-minimap-sql-density');
    if (minimapSqlDensityCheck && typeof minimapShowSqlDensity !== 'undefined') minimapSqlDensityCheck.checked = minimapShowSqlDensity;
    if (vsCheck && typeof visualSpacingEnabled !== 'undefined') vsCheck.checked = visualSpacingEnabled;
    var hideBlankCheck = document.getElementById('opt-hide-blank-lines');
    if (hideBlankCheck && typeof hideBlankLines !== 'undefined') hideBlankCheck.checked = hideBlankLines;
    var compressCheck = document.getElementById('opt-compress-lines');
    if (compressCheck && typeof compressLinesMode !== 'undefined') compressCheck.checked = compressLinesMode;
    var compressGlobalCheck = document.getElementById('opt-compress-lines-global');
    if (compressGlobalCheck && typeof compressNonConsecutiveMode !== 'undefined') compressGlobalCheck.checked = compressNonConsecutiveMode;
    syncIntegrationsUi();
    syncAudioUi();
    renderSeverityKeywordsDisplay();
    if (typeof syncFiltersPanelUi === 'function') syncFiltersPanelUi();
}

/** Reset all options panel options to default (viewer display/layout/audio only; not workspace settings). */
function resetOptionsToDefault() {
    /* Reset to user's configured setting (seeded into logFontSizeDefault / logLineHeightDefault
       by setLogFontSize / setLogLineHeight host messages) — not the webview's hard-coded fallback.
       Falls back to fallback literal if the settings-driven default was never received. */
    if (typeof setFontSize === 'function') setFontSize(typeof logFontSizeDefault === 'number' ? logFontSizeDefault : 13);
    if (typeof setLineHeight === 'function') setLineHeight(typeof logLineHeightDefault === 'number' ? logLineHeightDefault : 1.1);
    wordWrap = false;
    var logEl = document.getElementById('log-content');
    if (logEl) logEl.classList.toggle('nowrap', true);
    if (typeof resetDecoDefaults === 'function') resetDecoDefaults();
    if (typeof showMilliseconds !== 'undefined') showMilliseconds = false;
    showElapsed = false;
    if (typeof lineColorsEnabled !== 'undefined') lineColorsEnabled = true;
    if (typeof updateDecoButton === 'function') updateDecoButton();
    if (typeof visualSpacingEnabled !== 'undefined') {
        visualSpacingEnabled = logViewerVisualSpacingDefault;
    }
    if (typeof vscodeApi !== 'undefined' && vscodeApi.postMessage) {
        vscodeApi.postMessage({ type: 'setLogViewerVisualSpacing', value: !!visualSpacingEnabled });
    }
    minimapShowSqlDensity = true;
    if (typeof handleMinimapShowSqlDensity === 'function') handleMinimapShowSqlDensity({ show: true });
    if (typeof vscodeApi !== 'undefined' && vscodeApi.postMessage) {
        vscodeApi.postMessage({ type: 'setMinimapSqlDensity', value: true });
    }
    minimapWidthSetting = 'medium';
    if (typeof handleMinimapWidth === 'function') handleMinimapWidth({ width: 'medium' });
    if (typeof vscodeApi !== 'undefined' && vscodeApi.postMessage) {
        vscodeApi.postMessage({ type: 'setMinimapWidth', value: 'medium' });
    }
    if (typeof hideBlankLines !== 'undefined') hideBlankLines = false;
    if (typeof compressLinesMode !== 'undefined') compressLinesMode = false;
    if (typeof compressNonConsecutiveMode !== 'undefined') compressNonConsecutiveMode = false;
    if (typeof audioEnabled !== 'undefined') audioEnabled = false;
    if (typeof audioRateLimit !== 'undefined') audioRateLimit = 2000;
    if (typeof setAudioVolume === 'function') setAudioVolume(30);
    if (typeof updateAudioButton === 'function') updateAudioButton();
    if (typeof syncDecoSettingsUi === 'function') syncDecoSettingsUi();
    syncOptionsPanelUi();
    if (typeof recalcAndRender === 'function') recalcAndRender();
    else if (typeof renderViewport === 'function') renderViewport(true);
}

// Integrations screen: open (from Options) and back (to Options). Same panel, two views; no async load.
var optionsOpenIntegrationsBtn = document.getElementById('options-open-integrations');
var integrationsBackBtn = document.getElementById('integrations-back');
if (optionsOpenIntegrationsBtn) optionsOpenIntegrationsBtn.addEventListener('click', openIntegrationsView);
if (integrationsBackBtn) integrationsBackBtn.addEventListener('click', closeIntegrationsView);

// Keyboard shortcuts screen: open and back.
var optionsOpenShortcutsBtn = document.getElementById('options-open-shortcuts');
var shortcutsBackBtn = document.getElementById('shortcuts-back');
if (optionsOpenShortcutsBtn) optionsOpenShortcutsBtn.addEventListener('click', openShortcutsView);
if (shortcutsBackBtn) shortcutsBackBtn.addEventListener('click', closeShortcutsView);

// Double-click: power shortcut row -> start record key; command row -> open Keyboard Shortcuts.
var shortcutsContent = document.querySelector('#shortcuts-view .shortcuts-content');
if (shortcutsContent) shortcutsContent.addEventListener('dblclick', function(e) {
    var row = e.target && e.target.closest && e.target.closest('tr');
    if (!row || typeof vscodeApi === 'undefined') return;
    var actionId = row.getAttribute && row.getAttribute('data-action-id');
    if (actionId) {
        vscodeApi.postMessage({ type: 'startRecordViewerKey', actionId: actionId });
        return;
    }
    var search = row.getAttribute && row.getAttribute('data-keybinding-search');
    if (search) vscodeApi.postMessage({ type: 'openKeybindings', search: search });
});

${getOptionsEventHandlers()}
`;
}

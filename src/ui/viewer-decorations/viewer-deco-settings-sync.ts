/**
 * Decoration settings panel ↔ state synchronization.
 *
 * Two mirror-image functions, extracted from viewer-deco-settings.ts to keep that
 * file under the max-lines cap (it sat exactly at the limit):
 *   - syncDecoSettingsUi(): writes current state variables INTO the panel controls.
 *   - onDecoOptionChange(): reads panel control values OUT into the state variables.
 *
 * Both operate on the same global state vars declared in viewer-deco-settings.ts and
 * are invoked only at runtime (panel open / change events), so this script may load
 * after that one. Concatenated into the same webview script scope.
 */

/** Returns the JavaScript for the decoration panel sync functions. */
export function getDecoSettingsSyncScript(): string {
    return /* javascript */ `
/** Sync checkbox/select UI elements from the current state variables. */
function syncDecoSettingsUi() {
    var dot = document.getElementById('deco-opt-dot');
    var ctr = document.getElementById('deco-opt-counter');
    var ctrBlank = document.getElementById('deco-opt-counter-on-blank');
    var ts = document.getElementById('deco-opt-timestamp');
    var ms = document.getElementById('deco-opt-milliseconds');
    var elapsed = document.getElementById('deco-opt-elapsed');
    var sessEl = document.getElementById('deco-opt-session-elapsed');
    var bar = document.getElementById('deco-opt-bar');
    var quality = document.getElementById('deco-opt-quality');
    var catBdg = document.getElementById('deco-opt-category-badge');
    var lintBdg = document.getElementById('deco-opt-lint-badge');
    var lc = document.getElementById('deco-opt-line-colors');
    var mode = document.getElementById('deco-line-color-mode');
    var stripTag = document.getElementById('deco-opt-strip-source-tag');
    if (dot) dot.checked = decoShowDot;
    if (ctr) ctr.checked = decoShowCounter;
    if (ctrBlank) ctrBlank.checked = decoShowCounterOnBlank;
    if (ts) ts.checked = decoShowTimestamp;
    if (ms) ms.checked = showMilliseconds;
    if (elapsed) elapsed.checked = showElapsed;
    if (sessEl) sessEl.checked = decoShowSessionElapsed;
    if (bar) bar.checked = decoShowBar;
    if (quality) quality.checked = decoShowQuality;
    if (catBdg) catBdg.checked = showCategoryBadges;
    if (lintBdg) lintBdg.checked = decoShowLintBadges;
    if (lc) lc.checked = lineColorsEnabled;
    if (mode) mode.value = decoLineColorMode;
    if (stripTag) stripTag.checked = stripSourceTagPrefix;
    var structParse = document.getElementById('deco-opt-structured-parsing');
    var showPT = document.getElementById('deco-opt-show-pid-tid');
    var showLP = document.getElementById('deco-opt-show-level-prefix');
    if (structParse) structParse.checked = (typeof structuredLineParsing !== 'undefined') ? structuredLineParsing : true;
    if (showPT) showPT.checked = (typeof showParsedPidTid !== 'undefined') ? showParsedPidTid : false;
    if (showLP) showLP.checked = (typeof showParsedLevelPrefix !== 'undefined') ? showParsedLevelPrefix : false;
    var stackState = document.getElementById('deco-stack-default-state');
    var stackPreview = document.getElementById('deco-stack-preview-count');
    if (stackState) stackState.value = stackDefaultState === true ? 'collapsed' : (stackDefaultState === 'preview' ? 'preview' : 'expanded');
    if (stackPreview) stackPreview.value = String(stackPreviewCount);
}

/**
 * Handle any change to a decoration option checkbox or dropdown.
 * Reads UI values into state variables, updates the footer button, and re-renders.
 */
function onDecoOptionChange() {
    var dot = document.getElementById('deco-opt-dot');
    var ctr = document.getElementById('deco-opt-counter');
    var ctrBlank = document.getElementById('deco-opt-counter-on-blank');
    var ts = document.getElementById('deco-opt-timestamp');
    var ms = document.getElementById('deco-opt-milliseconds');
    var elapsed = document.getElementById('deco-opt-elapsed');
    var sessEl = document.getElementById('deco-opt-session-elapsed');
    var bar = document.getElementById('deco-opt-bar');
    var quality = document.getElementById('deco-opt-quality');
    var catBdg = document.getElementById('deco-opt-category-badge');
    var lintBdg = document.getElementById('deco-opt-lint-badge');
    var lc = document.getElementById('deco-opt-line-colors');
    var mode = document.getElementById('deco-line-color-mode');
    var stripTag = document.getElementById('deco-opt-strip-source-tag');
    decoShowDot = dot ? dot.checked : true;
    decoShowCounter = ctr ? ctr.checked : true;
    decoShowCounterOnBlank = ctrBlank ? ctrBlank.checked : false;
    decoShowTimestamp = ts ? ts.checked : true;
    showMilliseconds = ms ? ms.checked : false;
    showElapsed = elapsed ? elapsed.checked : false;
    if (typeof vscodeApi !== 'undefined' && vscodeApi.postMessage) { vscodeApi.postMessage({ type: 'setShowElapsed', value: showElapsed }); } // Persist setShowElapsed → workspace setShowElapsed → showElapsedTime mapping
    decoShowSessionElapsed = sessEl ? sessEl.checked : false;
    decoShowBar = bar ? bar.checked : false;
    decoShowQuality = quality ? quality.checked : true;
    showCategoryBadges = catBdg ? catBdg.checked : false;
    decoShowLintBadges = lintBdg ? lintBdg.checked : false;
    lineColorsEnabled = lc ? lc.checked : true;
    decoLineColorMode = mode ? mode.value : 'none';
    stripSourceTagPrefix = stripTag ? stripTag.checked : true;
    var structParse = document.getElementById('deco-opt-structured-parsing');
    var showPT = document.getElementById('deco-opt-show-pid-tid');
    var showLP = document.getElementById('deco-opt-show-level-prefix');
    if (typeof structuredLineParsing !== 'undefined') structuredLineParsing = structParse ? structParse.checked : true;
    if (typeof showParsedPidTid !== 'undefined') showParsedPidTid = showPT ? showPT.checked : false;
    if (typeof showParsedLevelPrefix !== 'undefined') showParsedLevelPrefix = showLP ? showLP.checked : false;
    var stackState = document.getElementById('deco-stack-default-state'), stackPreview = document.getElementById('deco-stack-preview-count');
    var sv = stackState ? stackState.value : 'expanded';
    stackDefaultState = sv === 'collapsed' ? true : (sv === 'preview' ? 'preview' : false);
    stackPreviewCount = stackPreview ? Math.max(1, Math.min(20, parseInt(stackPreview.value, 10) || 3)) : 3;
    // The deco panel's counter / timestamp / session-elapsed checkboxes drive the same
    // Columns toggles as the context menu, so persist here too — otherwise a change made
    // in the panel would not survive a reload while the same change via the menu would.
    persistColumnPrefs();
    if (typeof updateDecoButton === 'function') updateDecoButton();
    renderViewport(true);
}
`;
}

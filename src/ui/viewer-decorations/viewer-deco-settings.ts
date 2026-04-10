/**
 * Decoration settings panel for the log viewer.
 *
 * Provides a popover (anchored above the footer gear button) with:
 *   - Checkboxes to toggle individual prefix parts (dot, counter, timestamp)
 *   - A dropdown for line-coloring mode (none / whole line)
 *   - Strip source tag prefix toggle (hides [log], [SDA] etc. from display)
 *   - Stack frame defaults: initial collapsed state and preview frame count
 *
 * State variables (decoShowDot, decoShowCounter, decoShowTimestamp,
 * decoShowSessionElapsed, decoLineColorMode, stripSourceTagPrefix,
 * stackDefaultState, stackPreviewCount) are globals shared with
 * viewer-decorations.ts and viewer-data-add.ts via the concatenated
 * script scope.
 *
 * Each decoration option is independently togglable; areDecorationsOn()
 * derives the overall state from whether any sub-toggle is active.
 * Strip/stack settings are NOT included in areDecorationsOn() since they
 * control content/layout, not the decoration prefix.
 *
 * Concatenated into the same script scope as viewer-script.ts.
 */

/** Returns the HTML for the decoration settings panel element. */
export function getDecoSettingsHtml(): string {
    return `<div id="deco-settings" class="deco-settings-panel">
    <div class="deco-settings-header">
        Decoration Settings
        <button class="deco-settings-close" title="Close">&times;</button>
    </div>
    <label class="deco-settings-row">
        <input type="checkbox" id="deco-opt-dot" checked />
        Severity dot (copy only)
    </label>
    <label class="deco-settings-row">
        <input type="checkbox" id="deco-opt-counter" checked />
        Counter
    </label>
    <label class="deco-settings-row deco-indent">
        <input type="checkbox" id="deco-opt-counter-on-blank" title="Show line number on blank lines so Go to Line matches file" />
        Show line number on blank lines
    </label>
    <label class="deco-settings-row">
        <input type="checkbox" id="deco-opt-timestamp" checked />
        Timestamp
    </label>
    <label class="deco-settings-row deco-indent">
        <input type="checkbox" id="deco-opt-milliseconds" />
        Show milliseconds
    </label>
    <label class="deco-settings-row">
        <input type="checkbox" id="deco-opt-elapsed" />
        Elapsed time (+Nms)
    </label>
    <label class="deco-settings-row">
        <input type="checkbox" id="deco-opt-session-elapsed" />
        Session elapsed
    </label>
    <div class="deco-settings-separator"></div>
    <label class="deco-settings-row">
        <input type="checkbox" id="deco-opt-line-colors" checked />
        Level text colors
    </label>
    <div class="deco-settings-row">
        <span>Line coloring</span>
        <select id="deco-line-color-mode">
            <option value="none">None</option>
            <option value="line">Whole line</option>
        </select>
    </div>
    <label class="deco-settings-row">
        <input type="checkbox" id="deco-opt-bar" checked />
        Severity bar (left border)
    </label>
    <label class="deco-settings-row">
        <input type="checkbox" id="deco-opt-quality" checked />
        Coverage badge
    </label>
    <label class="deco-settings-row">
        <input type="checkbox" id="deco-opt-category-badge" />
        Channel badge
    </label>
    <label class="deco-settings-row">
        <input type="checkbox" id="deco-opt-lint-badge" />
        Lint badge
    </label>
    <div class="deco-settings-separator"></div>
    <label class="deco-settings-row">
        <input type="checkbox" id="deco-opt-strip-source-tag" checked />
        Strip source tag prefix
    </label>
    <div class="deco-settings-separator"></div>
    <div class="deco-settings-row">
        <span>Stack frames</span>
        <select id="deco-stack-default-state">
            <option value="expanded">Expanded</option>
            <option value="preview">Preview</option>
            <option value="collapsed">Collapsed</option>
        </select>
    </div>
    <div class="deco-settings-row deco-indent">
        <span>Preview count</span>
        <input type="number" id="deco-stack-preview-count" min="1" max="20" value="3" style="width:3.5em" />
    </div>
</div>`;
}

/** Returns the JavaScript code for the decoration settings panel. */
export function getDecoSettingsScript(): string {
    return /* javascript */ `
/** Sub-toggle: show colored severity dot in decoration prefix. */
var decoShowDot = true;
/** Sub-toggle: show sequential counter in decoration prefix. */
var decoShowCounter = true;
/** Sub-toggle: show counter on blank lines (file line number); off by default. */
var decoShowCounterOnBlank = false;
/** Sub-toggle: show wall-clock timestamp in decoration prefix. */
var decoShowTimestamp = true;
/** Sub-toggle: show elapsed time (+Nms) between log lines. */
var showElapsed = false;
/** Sub-toggle: show session elapsed time (e.g. 5m 15s) from first log line. */
var decoShowSessionElapsed = false;
/** Line coloring mode: 'none' (default) or 'line' (whole-line tint). */
var decoLineColorMode = 'none';
/** Show severity bar (colored left border). */
var decoShowBar = true;
/** Apply level-based text colors to log lines. */
var lineColorsEnabled = true;
/** Strip bracket source tag prefix (e.g. [log]) from displayed line text. */
var stripSourceTagPrefix = true;
/** Default collapsed state for new stack groups: false (expanded), true (collapsed), 'preview'. */
var stackDefaultState = false;
/** Number of app frames shown in preview mode. */
var stackPreviewCount = 3;
/** Whether the settings panel popover is currently visible. */
var decoSettingsOpen = false;

/**
 * Position and show the settings panel above the gear button.
 * Syncs checkbox/select state from current variables before showing.
 */
function openDecoSettings() {
    var panel = document.getElementById('deco-settings');
    var btn = document.getElementById('deco-settings-btn');
    if (!panel || !btn) return;
    syncDecoSettingsUi();
    var rect = btn.getBoundingClientRect();
    panel.style.left = Math.max(0, rect.left) + 'px';
    panel.style.bottom = (window.innerHeight - rect.top + 4) + 'px';
    panel.style.top = 'auto';
    panel.classList.add('visible');
    decoSettingsOpen = true;
}

/** Hide the settings panel popover. */
function closeDecoSettings() {
    var panel = document.getElementById('deco-settings');
    if (panel) panel.classList.remove('visible');
    decoSettingsOpen = false;
}

/** Toggle the settings panel via the gear button. */
function toggleDecoSettings() {
    if (decoSettingsOpen) {
        closeDecoSettings();
    } else {
        openDecoSettings();
    }
}

/**
 * Toggle timestamp in the line decoration prefix.
 * Callable from the context menu (Layout → Timestamp).
 */
function toggleTimestamp() {
    decoShowTimestamp = !decoShowTimestamp;
    if (typeof updateDecoButton === 'function') updateDecoButton();
    syncDecoSettingsUi();
    if (typeof renderViewport === 'function') renderViewport(true);
}

/**
 * Toggle session elapsed time in the line decoration prefix.
 * Callable from the context menu (Layout → Session elapsed).
 */
function toggleSessionElapsed() {
    decoShowSessionElapsed = !decoShowSessionElapsed;
    if (typeof updateDecoButton === 'function') updateDecoButton();
    syncDecoSettingsUi();
    if (typeof renderViewport === 'function') renderViewport(true);
}

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
    decoShowSessionElapsed = sessEl ? sessEl.checked : false;
    decoShowBar = bar ? bar.checked : false;
    decoShowQuality = quality ? quality.checked : true;
    showCategoryBadges = catBdg ? catBdg.checked : false;
    decoShowLintBadges = lintBdg ? lintBdg.checked : false;
    lineColorsEnabled = lc ? lc.checked : true;
    decoLineColorMode = mode ? mode.value : 'none';
    stripSourceTagPrefix = stripTag ? stripTag.checked : true;
    var stackState = document.getElementById('deco-stack-default-state');
    var stackPreview = document.getElementById('deco-stack-preview-count');
    var sv = stackState ? stackState.value : 'expanded';
    stackDefaultState = sv === 'collapsed' ? true : (sv === 'preview' ? 'preview' : false);
    stackPreviewCount = stackPreview ? Math.max(1, Math.min(20, parseInt(stackPreview.value, 10) || 3)) : 3;
    if (typeof updateDecoButton === 'function') updateDecoButton();
    renderViewport(true);
}

/* Register event listeners for settings panel controls. */
var decoSettingsBtn = document.getElementById('deco-settings-btn');
var decoCloseBtn = document.querySelector('.deco-settings-close');
var decoOptDot = document.getElementById('deco-opt-dot');
var decoOptCounter = document.getElementById('deco-opt-counter');
var decoOptCounterOnBlank = document.getElementById('deco-opt-counter-on-blank');
var decoOptTimestamp = document.getElementById('deco-opt-timestamp');
var decoOptMilliseconds = document.getElementById('deco-opt-milliseconds');
var decoOptElapsed = document.getElementById('deco-opt-elapsed');
var decoOptSessionElapsed = document.getElementById('deco-opt-session-elapsed');
var decoOptBar = document.getElementById('deco-opt-bar');
var decoOptQuality = document.getElementById('deco-opt-quality');
var decoOptCategoryBadge = document.getElementById('deco-opt-category-badge');
var decoOptLintBadge = document.getElementById('deco-opt-lint-badge');
var decoOptLineColors = document.getElementById('deco-opt-line-colors');
var decoLineColorSelect = document.getElementById('deco-line-color-mode');
var decoOptStripSourceTag = document.getElementById('deco-opt-strip-source-tag');
var decoStackDefaultState = document.getElementById('deco-stack-default-state');
var decoStackPreviewCount = document.getElementById('deco-stack-preview-count');

if (decoSettingsBtn) decoSettingsBtn.addEventListener('click', toggleDecoSettings);
if (decoCloseBtn) decoCloseBtn.addEventListener('click', closeDecoSettings);
if (decoOptDot) decoOptDot.addEventListener('change', onDecoOptionChange);
if (decoOptCounter) decoOptCounter.addEventListener('change', onDecoOptionChange);
if (decoOptCounterOnBlank) decoOptCounterOnBlank.addEventListener('change', onDecoOptionChange);
if (decoOptTimestamp) decoOptTimestamp.addEventListener('change', onDecoOptionChange);
if (decoOptMilliseconds) decoOptMilliseconds.addEventListener('change', onDecoOptionChange);
if (decoOptElapsed) decoOptElapsed.addEventListener('change', onDecoOptionChange);
if (decoOptSessionElapsed) decoOptSessionElapsed.addEventListener('change', onDecoOptionChange);
if (decoOptBar) decoOptBar.addEventListener('change', onDecoOptionChange);
if (decoOptQuality) decoOptQuality.addEventListener('change', onDecoOptionChange);
if (decoOptCategoryBadge) decoOptCategoryBadge.addEventListener('change', onDecoOptionChange);
if (decoOptLintBadge) decoOptLintBadge.addEventListener('change', onDecoOptionChange);
if (decoOptLineColors) decoOptLineColors.addEventListener('change', onDecoOptionChange);
if (decoLineColorSelect) decoLineColorSelect.addEventListener('change', onDecoOptionChange);
if (decoOptStripSourceTag) decoOptStripSourceTag.addEventListener('change', onDecoOptionChange);
if (decoStackDefaultState) decoStackDefaultState.addEventListener('change', onDecoOptionChange);
if (decoStackPreviewCount) decoStackPreviewCount.addEventListener('change', onDecoOptionChange);

/* Close panel when clicking outside it or the gear button. */
document.addEventListener('click', function(e) {
    if (!decoSettingsOpen) return;
    var panel = document.getElementById('deco-settings');
    var gearBtn = document.getElementById('deco-settings-btn');
    if (panel && !panel.contains(e.target) && gearBtn !== e.target) {
        closeDecoSettings();
    }
});
`;
}

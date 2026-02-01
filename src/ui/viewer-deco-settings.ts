/**
 * Decoration settings panel for the log viewer.
 *
 * Provides a popover (anchored above the footer gear button) with:
 *   - Checkboxes to toggle individual prefix parts (dot, counter, timestamp)
 *   - A dropdown for line-coloring mode (none / whole line)
 *
 * State variables (decoShowDot, decoShowCounter, decoShowTimestamp,
 * decoLineColorMode) are globals shared with viewer-decorations.ts
 * via the concatenated script scope.
 *
 * Auto-off rule: when all checkboxes are unchecked AND coloring is "none",
 * the master showDecorations toggle is automatically turned off.
 *
 * Concatenated into the same script scope as viewer-script.ts.
 */

/** Returns the HTML for the decoration settings panel element. */
export function getDecoSettingsHtml(): string {
    return `<div id="deco-settings" class="deco-settings-panel">
    <div class="deco-settings-header">
        Decoration Settings
        <button class="deco-settings-close">&times;</button>
    </div>
    <label class="deco-settings-row">
        <input type="checkbox" id="deco-opt-dot" checked />
        Severity dot
    </label>
    <label class="deco-settings-row">
        <input type="checkbox" id="deco-opt-counter" checked />
        Counter (#N)
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
    <div class="deco-settings-separator"></div>
    <div class="deco-settings-row">
        <span>Line coloring</span>
        <select id="deco-line-color-mode">
            <option value="none">None</option>
            <option value="line">Whole line</option>
        </select>
    </div>
    <label class="deco-settings-row">
        <input type="checkbox" id="deco-opt-bar" />
        Severity bar (left border)
    </label>
</div>`;
}

/** Returns the JavaScript code for the decoration settings panel. */
export function getDecoSettingsScript(): string {
    return /* javascript */ `
/** Sub-toggle: show colored severity dot in decoration prefix. */
var decoShowDot = true;
/** Sub-toggle: show sequential counter (#N) in decoration prefix. */
var decoShowCounter = true;
/** Sub-toggle: show wall-clock timestamp in decoration prefix. */
var decoShowTimestamp = true;
/** Sub-toggle: show elapsed time (+Nms) between log lines. */
var showElapsed = false;
/** Line coloring mode: 'none' (default) or 'line' (whole-line tint). */
var decoLineColorMode = 'none';
/** Show severity bar (colored left border). */
var decoShowBar = false;
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

/**
 * Toggle the settings panel via the gear button.
 * If decorations are OFF: turns them ON first, then opens the panel.
 * If decorations are ON: toggles the panel open/closed.
 */
function toggleDecoSettings() {
    if (!showDecorations) {
        toggleDecorations();
        openDecoSettings();
        return;
    }
    if (decoSettingsOpen) {
        closeDecoSettings();
    } else {
        openDecoSettings();
    }
}

/** Sync checkbox/select UI elements from the current state variables. */
function syncDecoSettingsUi() {
    var dot = document.getElementById('deco-opt-dot');
    var ctr = document.getElementById('deco-opt-counter');
    var ts = document.getElementById('deco-opt-timestamp');
    var ms = document.getElementById('deco-opt-milliseconds');
    var elapsed = document.getElementById('deco-opt-elapsed');
    var bar = document.getElementById('deco-opt-bar');
    var mode = document.getElementById('deco-line-color-mode');
    if (dot) dot.checked = decoShowDot;
    if (ctr) ctr.checked = decoShowCounter;
    if (ts) ts.checked = decoShowTimestamp;
    if (ms) ms.checked = showMilliseconds;
    if (elapsed) elapsed.checked = showElapsed;
    if (bar) bar.checked = decoShowBar;
    if (mode) mode.value = decoLineColorMode;
}

/**
 * Handle any change to a decoration option checkbox or dropdown.
 * Reads UI values into state variables and re-renders the viewport.
 * If all prefix parts are off AND line coloring is "none", automatically
 * disables the master toggle (avoids "on but invisible" state).
 */
function onDecoOptionChange() {
    var dot = document.getElementById('deco-opt-dot');
    var ctr = document.getElementById('deco-opt-counter');
    var ts = document.getElementById('deco-opt-timestamp');
    var ms = document.getElementById('deco-opt-milliseconds');
    var elapsed = document.getElementById('deco-opt-elapsed');
    var bar = document.getElementById('deco-opt-bar');
    var mode = document.getElementById('deco-line-color-mode');
    decoShowDot = dot ? dot.checked : true;
    decoShowCounter = ctr ? ctr.checked : true;
    decoShowTimestamp = ts ? ts.checked : true;
    showMilliseconds = ms ? ms.checked : false;
    showElapsed = elapsed ? elapsed.checked : false;
    decoShowBar = bar ? bar.checked : false;
    decoLineColorMode = mode ? mode.value : 'none';
    var allOff = !decoShowDot && !decoShowCounter && !decoShowTimestamp && !showElapsed && !decoShowBar && decoLineColorMode === 'none';
    if (allOff) {
        showDecorations = false;
        closeDecoSettings();
        updateDecoButton();
    }
    renderViewport(true);
}

/* Register event listeners for settings panel controls. */
var decoSettingsBtn = document.getElementById('deco-settings-btn');
var decoCloseBtn = document.querySelector('.deco-settings-close');
var decoOptDot = document.getElementById('deco-opt-dot');
var decoOptCounter = document.getElementById('deco-opt-counter');
var decoOptTimestamp = document.getElementById('deco-opt-timestamp');
var decoOptMilliseconds = document.getElementById('deco-opt-milliseconds');
var decoOptElapsed = document.getElementById('deco-opt-elapsed');
var decoOptBar = document.getElementById('deco-opt-bar');
var decoLineColorSelect = document.getElementById('deco-line-color-mode');

if (decoSettingsBtn) decoSettingsBtn.addEventListener('click', toggleDecoSettings);
if (decoCloseBtn) decoCloseBtn.addEventListener('click', closeDecoSettings);
if (decoOptDot) decoOptDot.addEventListener('change', onDecoOptionChange);
if (decoOptCounter) decoOptCounter.addEventListener('change', onDecoOptionChange);
if (decoOptTimestamp) decoOptTimestamp.addEventListener('change', onDecoOptionChange);
if (decoOptMilliseconds) decoOptMilliseconds.addEventListener('change', onDecoOptionChange);
if (decoOptElapsed) decoOptElapsed.addEventListener('change', onDecoOptionChange);
if (decoOptBar) decoOptBar.addEventListener('change', onDecoOptionChange);
if (decoLineColorSelect) decoLineColorSelect.addEventListener('change', onDecoOptionChange);

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

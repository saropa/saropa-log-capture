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
import { t } from '../../l10n';

/** Returns the HTML for the decoration settings panel element. */
export function getDecoSettingsHtml(): string {
    return /* html */ `<div id="deco-settings" class="deco-settings-panel">
    <div class="deco-settings-header">
        ${t('viewer.decoSettings.title')}
        <button class="deco-settings-close" title="${t('viewer.decoSettings.close')}">&times;</button>
    </div>
    <label class="deco-settings-row">
        <input type="checkbox" id="deco-opt-dot" checked /> ${t('viewer.decoSettings.severityDot')}
    </label>
    <label class="deco-settings-row">
        <input type="checkbox" id="deco-opt-counter" checked />
        ${t('viewer.decoSettings.lineNumbers')}
    </label>
    <label class="deco-settings-row deco-indent">
        <input type="checkbox" id="deco-opt-counter-on-blank" title="${t('viewer.decoSettings.lineNumbersOnBlank.title')}" />
        ${t('viewer.decoSettings.lineNumbersOnBlank')}
    </label>
    <label class="deco-settings-row">
        <input type="checkbox" id="deco-opt-timestamp" checked />
        ${t('viewer.decoSettings.timestamp')}
    </label>
    <label class="deco-settings-row deco-indent">
        <input type="checkbox" id="deco-opt-milliseconds" />
        ${t('viewer.decoSettings.milliseconds')}
    </label>
    <label class="deco-settings-row">
        <input type="checkbox" id="deco-opt-elapsed" />
        ${t('viewer.decoSettings.elapsed')}
    </label>
    <label class="deco-settings-row">
        <input type="checkbox" id="deco-opt-session-elapsed" />
        ${t('viewer.decoSettings.sessionElapsed')}
    </label>
    <div class="deco-settings-separator"></div>
    <label class="deco-settings-row">
        <input type="checkbox" id="deco-opt-line-colors" checked />
        ${t('viewer.decoSettings.levelTextColors')}
    </label>
    <div class="deco-settings-row">
        <span>${t('viewer.decoSettings.lineColoring')}</span>
        <select id="deco-line-color-mode">
            <option value="none">${t('viewer.decoSettings.lineColoring.none')}</option>
            <option value="line">${t('viewer.decoSettings.lineColoring.wholeLine')}</option>
        </select>
    </div>
    <label class="deco-settings-row">
        <input type="checkbox" id="deco-opt-bar" checked />
        ${t('viewer.decoSettings.severityBar')}
    </label>
    <label class="deco-settings-row">
        <input type="checkbox" id="deco-opt-quality" checked />
        ${t('viewer.decoSettings.coverageBadge')}
    </label>
    <label class="deco-settings-row">
        <input type="checkbox" id="deco-opt-category-badge" />
        ${t('viewer.decoSettings.channelBadge')}
    </label>
    <label class="deco-settings-row">
        <input type="checkbox" id="deco-opt-lint-badge" />
        ${t('viewer.decoSettings.lintBadge')}
    </label>
    <div class="deco-settings-separator"></div>
    <label class="deco-settings-row">
        <input type="checkbox" id="deco-opt-strip-source-tag" checked />
        ${t('viewer.decoSettings.stripSourceTag')}
    </label>
    <label class="deco-settings-row">
        <input type="checkbox" id="deco-opt-structured-parsing" checked />
        ${t('viewer.decoSettings.stripStructuredPrefix')}
    </label>
    <label class="deco-settings-row deco-indent">
        <input type="checkbox" id="deco-opt-show-pid-tid" />
        ${t('viewer.decoSettings.showPidTid')}
    </label>
    <label class="deco-settings-row deco-indent">
        <input type="checkbox" id="deco-opt-show-level-prefix" />
        ${t('viewer.decoSettings.showLevelPrefix')}
    </label>
    <div class="deco-settings-separator"></div>
    <div class="deco-settings-row">
        <span>${t('viewer.decoSettings.stackFrames')}</span>
        <select id="deco-stack-default-state">
            <!-- Order matches the JS default (stackDefaultState = true / collapsed) so the dropdown's
                 visible default lines up with runtime state before syncDecoSettingsUi() runs. Without
                 this, the panel briefly shows "Expanded" while new stacks actually arrive collapsed —
                 confusing the user when they first open Decoration Settings on a fresh session. -->
            <option value="collapsed">${t('viewer.decoSettings.stackFrames.collapsed')}</option>
            <option value="preview">${t('viewer.decoSettings.stackFrames.preview')}</option>
            <option value="expanded">${t('viewer.decoSettings.stackFrames.expanded')}</option>
        </select>
    </div>
    <div class="deco-settings-row deco-indent">
        <span>${t('viewer.decoSettings.previewCount')}</span>
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
/** Show the parsed source tag column (e.g. flutter, HWUI) in the decoration prefix.
 *  Independent of structuredLineParsing — that toggle controls whether the prefix
 *  is stripped from the message text; this toggle controls whether the chip is
 *  rendered in the reserved tag column. */
var decoShowParsedTag = true;
/** Default collapsed state for new stack groups: false (expanded), true (collapsed), 'preview'.
 *  Out-of-the-box default is true (collapsed) — a noisy log (Drift SELECT flood, logcat
 *  debug spam, full Dart call chains on every log() if the app starts emitting structured
 *  stacks for non-Error levels) otherwise renders thousands of visible stack frames on
 *  first paint. Users who prefer the full trace expanded by default switch this in
 *  Decorations → Stack frames. The fallback in viewer-data-add.ts addToData() must also
 *  default to true — if it ever resolves before this var is set, defaulting to expanded
 *  reproduces the exact noise pattern this default exists to prevent. Toggle UI per stack
 *  group is the inline .stack-toggle chevron in the header (▶ collapsed, ▼ expanded);
 *  see bugs/048_plan-severity-gutter-decoupling.md. */
var stackDefaultState = true;
/** Number of app frames shown in preview mode. */
var stackPreviewCount = 3;
/** Whether the settings panel popover is currently visible. */
var decoSettingsOpen = false;

/* persistColumnPrefs() / restoreColumnPrefs() are defined in viewer-deco-column-prefs.ts
   (loaded immediately after this script). The toggles below call persistColumnPrefs by its
   global name; restore runs at that script's init to override the defaults declared above. */

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
    persistColumnPrefs();
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
    persistColumnPrefs();
    if (typeof updateDecoButton === 'function') updateDecoButton();
    syncDecoSettingsUi();
    if (typeof renderViewport === 'function') renderViewport(true);
}

/**
 * Toggle line numbers (counter) in the decoration prefix.
 * Callable from the context menu (Columns → Line numbers).
 */
function toggleLineNumbers() {
    decoShowCounter = !decoShowCounter;
    persistColumnPrefs();
    if (typeof updateDecoButton === 'function') updateDecoButton();
    syncDecoSettingsUi();
    if (typeof renderViewport === 'function') renderViewport(true);
}

/**
 * Toggle the parsed source tag column (e.g. flutter, HWUI).
 * Callable from the context menu (Columns → Tag).
 */
function toggleParsedTag() {
    decoShowParsedTag = !decoShowParsedTag;
    persistColumnPrefs();
    if (typeof updateDecoButton === 'function') updateDecoButton();
    syncDecoSettingsUi();
    if (typeof renderViewport === 'function') renderViewport(true);
}

/* syncDecoSettingsUi() (state vars → panel controls) and onDecoOptionChange()
   (panel controls → state vars) are defined in viewer-deco-settings-sync.ts, loaded
   after this script. The toggles above and openDecoSettings() call syncDecoSettingsUi
   by its global name; both run only at runtime so the later load order is safe. */
`;
}

/**
 * Decoration state management: snapshot/restore, toggle-all, and button sync.
 * Concatenated into the viewer script scope alongside viewer-decorations.ts.
 * Extracted from viewer-decorations.ts to keep that file under the 300-line limit.
 */
export function getDecorationsStateScript(): string {
    return /* javascript */ `
/** Saved decoration state for restore when toggling back on. Null means no snapshot taken yet. */
var savedDecoState = null;

/** Capture current decoration sub-toggle values so they can be restored later. */
function snapshotDecoState() {
    return {
        dot: decoShowDot,
        counter: decoShowCounter,
        counterOnBlank: decoShowCounterOnBlank,
        timestamp: decoShowTimestamp,
        elapsed: showElapsed,
        sessionElapsed: decoShowSessionElapsed,
        bar: decoShowBar,
        lineColorMode: decoLineColorMode,
        quality: (typeof decoShowQuality !== 'undefined') ? decoShowQuality : true,
        categoryBadges: (typeof showCategoryBadges !== 'undefined') ? showCategoryBadges : false,
        lintBadges: (typeof decoShowLintBadges !== 'undefined') ? decoShowLintBadges : false,
    };
}

/** Restore decoration sub-toggles from a previously saved snapshot. */
function restoreDecoState(s) {
    decoShowDot = s.dot;
    decoShowCounter = s.counter;
    decoShowCounterOnBlank = s.counterOnBlank;
    decoShowTimestamp = s.timestamp;
    showElapsed = s.elapsed;
    decoShowSessionElapsed = s.sessionElapsed;
    decoShowBar = s.bar;
    decoLineColorMode = s.lineColorMode;
    if (typeof decoShowQuality !== 'undefined') decoShowQuality = s.quality;
    if (typeof showCategoryBadges !== 'undefined') showCategoryBadges = s.categoryBadges;
    if (typeof decoShowLintBadges !== 'undefined') decoShowLintBadges = s.lintBadges;
}

/** Turn all decoration sub-toggles off. */
function clearAllDecoToggles() {
    decoShowDot = false;
    decoShowCounter = false;
    decoShowCounterOnBlank = false;
    decoShowTimestamp = false;
    showElapsed = false;
    decoShowSessionElapsed = false;
    decoShowBar = false;
    decoLineColorMode = 'none';
    if (typeof decoShowQuality !== 'undefined') decoShowQuality = false;
    if (typeof showCategoryBadges !== 'undefined') showCategoryBadges = false;
    if (typeof decoShowLintBadges !== 'undefined') decoShowLintBadges = false;
}

/**
 * Toggle all decorations on or off from the toolbar button.
 * When turning off: snapshots current state, then clears all toggles.
 * When turning on: restores the snapshot. If no snapshot exists (user
 * never had decorations on), defaults to elapsed time only.
 */
function toggleAllDecorations() {
    if (areDecorationsOn()) {
        /* Currently on — save state and turn everything off. */
        savedDecoState = snapshotDecoState();
        clearAllDecoToggles();
    } else {
        /* Currently off — restore saved state or default to elapsed time. */
        if (savedDecoState) {
            restoreDecoState(savedDecoState);
        } else {
            /* No previous state: enable elapsed time as the sensible default. */
            showElapsed = true;
        }
    }
    if (typeof syncDecoSettingsUi === 'function') syncDecoSettingsUi();
    updateDecoButton();
    renderViewport(true);
}

/** Update the Deco button style and tooltip to reflect whether any decoration is active. */
function updateDecoButton() {
    var on = areDecorationsOn();
    /* Legacy footer button (may not exist in current HTML). */
    var btn = document.getElementById('deco-toggle');
    if (btn) {
        btn.title = on
            ? 'Decorations ON (click gear to configure)'
            : 'Decorations OFF (click gear to configure)';
        if (on) { btn.classList.remove('toggle-inactive'); }
        else { btn.classList.add('toggle-inactive'); }
    }
    /* Toolbar button. */
    var tbBtn = document.getElementById('toolbar-deco-btn');
    if (tbBtn) {
        tbBtn.title = on
            ? 'Decorations ON \\u2014 click to turn off'
            : 'Decorations OFF \\u2014 click to turn on';
        tbBtn.classList.toggle('toolbar-deco-inactive', !on);
    }
}

/** Reset all sub-toggles to their defaults. Used by the options panel "Reset to defaults" action. */
function resetDecoDefaults() {
    decoShowDot = true;
    decoShowCounter = true;
    decoShowCounterOnBlank = false;
    decoShowTimestamp = true;
    decoShowSessionElapsed = false;
    decoLineColorMode = 'none';
    decoShowBar = true;
    stripSourceTagPrefix = true;
    /* Default matches the initial value in viewer-deco-settings.ts — collapsed by default so
       noisy logs do not render thousands of stack frames on first paint. */
    stackDefaultState = true;
    stackPreviewCount = 3;
}

// Register decoration button click — opens settings panel directly
var decoToggleBtn = document.getElementById('deco-toggle');
if (decoToggleBtn) {
    decoToggleBtn.addEventListener('click', function() {
        if (typeof toggleDecoSettings === 'function') toggleDecoSettings();
    });
}

// Toolbar decoration toggle — on/off with state save/restore
var toolbarDecoBtn = document.getElementById('toolbar-deco-btn');
if (toolbarDecoBtn) {
    toolbarDecoBtn.addEventListener('click', function() {
        toggleAllDecorations();
    });
}

applyDecorationLayoutWidth();
updateDecoButton();
`;
}

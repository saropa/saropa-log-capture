import { getLevelClassifyScript } from './viewer-level-classify';
import { getLevelEventHandlers } from './viewer-level-events';

/** Fly-up level filter menu with dot summary, select all/none, and per-file persistence. */
export function getLevelFilterScript(): string {
    return /* javascript */ `
var enabledLevels = new Set(['error', 'warning', 'info', 'performance', 'todo', 'notice', 'debug', 'database']);
var allLevelNames = ['error', 'warning', 'info', 'performance', 'todo', 'notice', 'debug', 'database'];
var contextLinesBefore = 3;
var levelMenuOpen = false;

${getLevelClassifyScript()}
${getApplyLevelFilterFn()}
${getToggleLevelFn()}
${getLevelFilterOutEmitFn()}
${getSyncLevelDotsFn()}
${getFlyupFns()}
${getSelectFns()}
${getContextSliderFn()}
${getPersistenceFns()}
${getLevelEventHandlers()}
`;
}

/** Three-pass filter: mark filtered, restore context, mark context group boundaries. */
function getApplyLevelFilterFn(): string {
    return /* javascript */ `
function applyLevelFilter() {
    var allEnabled = enabledLevels.size === allLevelNames.length;
    for (var i = 0; i < allLines.length; i++) {
        var item = allLines[i];
        item.isContext = false;
        item.isContextFirst = false;
        if (item.type === 'marker') { item.levelFiltered = false; continue; }
        item.levelFiltered = allEnabled ? false : !enabledLevels.has(item.level);
    }
    if (!allEnabled && contextLinesBefore > 0) {
        for (var i = 0; i < allLines.length; i++) {
            if (allLines[i].levelFiltered || allLines[i].type === 'marker') continue;
            for (var j = 1; j <= contextLinesBefore && (i - j) >= 0; j++) {
                var ctx = allLines[i - j];
                // Synthetic analysis rows (repeat chips, N+1 signals) describe the surrounding
                // SQL — they are not "what led to the error" and only add noise when dragged in
                // as context. Skip them so the 3-line window walks back to real log content
                // (stack frames, info lines, etc.) which actually shows causality.
                if (ctx.type === 'marker' || ctx.type === 'repeat-notification' || ctx.type === 'n-plus-one-signal') continue;
                if (ctx.levelFiltered) { ctx.levelFiltered = false; ctx.isContext = true; }
            }
        }
        for (var i = 0, pc = true; i < allLines.length; i++) {
            if (allLines[i].levelFiltered) continue;
            if (allLines[i].isContext && !pc) allLines[i].isContextFirst = true;
            pc = allLines[i].isContext || allLines[i].type === 'marker';
        }
    }
    if (typeof recalcAndRender === 'function') { recalcAndRender(); }
    else { recalcHeights(); renderViewport(true); }
}`;
}

/** Toggle a single level and sync dots + persistence.
 *  Plan 053-B: when a level transitions from enabled → disabled, emit `filter-out` interactions
 *  for the lines that just became hidden. This is the missing emitter — the InteractionType
 *  union already declares `'filter-out'` but no source existed until now. */
function getToggleLevelFn(): string {
    return /* javascript */ `
function toggleLevel(level) {
    var wasEnabled = enabledLevels.has(level);
    if (wasEnabled) { enabledLevels.delete(level); }
    else { enabledLevels.add(level); }
    var btn = document.getElementById('level-' + level + '-toggle');
    if (btn) btn.classList.toggle('active', enabledLevels.has(level));
    syncLevelDots();
    applyLevelFilter();
    saveLevelState();
    if (typeof markPresetDirty === 'function') markPresetDirty();
    /* Only emit on enabled → disabled. Re-enabling a level provides no noise signal. */
    if (wasEnabled && typeof emitFilterOutForLevels === 'function') {
        emitFilterOutForLevels([level]);
    }
}`;
}

/** Plan 053-B: emit `filter-out` interactions for lines belonging to one or more disabled levels.
 *  Per-toggle cap of 50 events with index-based dedupe, mirroring the scroll-burst pattern in
 *  viewer-script.ts. Truncates lineText to 100 chars to match the existing scroll emission shape.
 *  Gated by learningEnabled — when learning is off, the call is a no-op. */
export function getLevelFilterOutEmitFn(): string {
    return /* javascript */ `
function emitFilterOutForLevels(disabledLevels) {
    if (typeof learningEnabled !== 'undefined' && !learningEnabled) return;
    if (typeof allLines === 'undefined' || !allLines.length) return;
    if (typeof vscodeApi === 'undefined') return;
    var levelSet = {};
    for (var li = 0; li < disabledLevels.length; li++) { levelSet[disabledLevels[li]] = 1; }
    var sent = 0;
    var seen = {};
    var cap = 50;
    for (var i = 0; i < allLines.length && sent < cap; i++) {
        var row = allLines[i];
        if (!row || (row.type !== 'line' && row.type !== 'stack-frame')) continue;
        if (!levelSet[row.level]) continue;
        if (seen[i]) continue;
        seen[i] = 1;
        var plain = stripTags(row.html || '');
        if (!plain) continue;
        vscodeApi.postMessage({
            type: 'trackInteraction',
            interactionType: 'filter-out',
            lineText: plain.length > 100 ? plain.substring(0, 100) : plain,
            lineLevel: row.level || ''
        });
        sent++;
    }
}`;
}

/** Sync the compact footer dots to match enabledLevels. */
function getSyncLevelDotsFn(): string {
    return /* javascript */ `
function syncLevelDots() {
    var groups = document.querySelectorAll('.level-dot-group');
    for (var i = 0; i < groups.length; i++) {
        var lvl = groups[i].getAttribute('data-level');
        var dot = groups[i].querySelector('.level-dot');
        if (dot) dot.classList.toggle('active', enabledLevels.has(lvl));
    }
    var count = enabledLevels.size;
    var label = document.getElementById('level-trigger-label');
    if (label) {
        if (count === allLevelNames.length) label.textContent = 'All';
        else if (count === 0) label.textContent = 'None';
        else label.textContent = count + '/' + allLevelNames.length;
    }
    var selAll = document.getElementById('level-select-all');
    var selNone = document.getElementById('level-select-none');
    if (selAll) selAll.classList.toggle('active', count === allLevelNames.length);
    if (selNone) selNone.classList.toggle('active', count === 0);
}`;
}

/** Level menu open/close/toggle — delegates to toolbar filter drawer. */
function getFlyupFns(): string {
    return /* javascript */ `
function toggleLevelMenu() {
    if (typeof toggleFilterDrawer === 'function') toggleFilterDrawer();
}
function openLevelMenu() {
    if (typeof openFilterDrawer === 'function') openFilterDrawer();
    levelMenuOpen = true;
    syncContextSlider();
}
function closeLevelMenu() {
    if (typeof closeFilterDrawer === 'function') closeFilterDrawer();
    levelMenuOpen = false;
}`;
}

/** Select All / Select None bulk toggles. */
function getSelectFns(): string {
    return /* javascript */ `
function selectAllLevels() {
    enabledLevels = new Set(allLevelNames);
    syncAllLevelButtons(true);
    syncLevelDots();
    applyLevelFilter();
    saveLevelState();
    if (typeof markPresetDirty === 'function') markPresetDirty();
}
function selectNoneLevels() {
    /* Plan 053-B: snapshot what's being disabled before we wipe the set so we can emit
       filter-out events for every previously-visible level. */
    var disabledNow = Array.from(enabledLevels);
    enabledLevels = new Set();
    syncAllLevelButtons(false);
    syncLevelDots();
    applyLevelFilter();
    saveLevelState();
    if (typeof markPresetDirty === 'function') markPresetDirty();
    if (disabledNow.length > 0 && typeof emitFilterOutForLevels === 'function') {
        emitFilterOutForLevels(disabledNow);
    }
}
function soloLevel(level) {
    if (enabledLevels.size === 1 && enabledLevels.has(level)) { selectAllLevels(); return; }
    /* Plan 053-B: solo disables every level except the chosen one — snapshot the previously-
       enabled set MINUS the soloed level so we emit filter-out for the levels that just hid. */
    var disabledNow = [];
    var prevEnabled = enabledLevels;
    for (var li = 0; li < allLevelNames.length; li++) {
        var nm = allLevelNames[li];
        if (prevEnabled.has(nm) && nm !== level) disabledNow.push(nm);
    }
    enabledLevels = new Set([level]);
    syncAllLevelButtons(false);
    var btn = document.getElementById('level-' + level + '-toggle');
    if (btn) btn.classList.add('active');
    syncLevelDots();
    applyLevelFilter();
    saveLevelState();
    if (typeof markPresetDirty === 'function') markPresetDirty();
    if (disabledNow.length > 0 && typeof emitFilterOutForLevels === 'function') {
        emitFilterOutForLevels(disabledNow);
    }
}
function syncAllLevelButtons(active) {
    for (var i = 0; i < allLevelNames.length; i++) {
        var btn = document.getElementById('level-' + allLevelNames[i] + '-toggle');
        if (btn) btn.classList.toggle('active', active);
    }
}`;
}

/** Sync the context-lines slider value and label to current state. */
function getContextSliderFn(): string {
    return /* javascript */ `
function syncContextSlider() {
    var slider = document.getElementById('context-lines-slider');
    var label = document.getElementById('context-lines-label');
    if (slider) slider.value = contextLinesBefore;
    if (label) label.textContent = '\u00B1' + contextLinesBefore;
}`;
}

/** Send/restore level filter state for per-file persistence. */
function getPersistenceFns(): string {
    return /* javascript */ `
function saveLevelState() {
    var fn = typeof currentFilename !== 'undefined' ? currentFilename : '';
    if (!fn) return;
    vscodeApi.postMessage({
        type: 'saveLevelFilters',
        filename: fn,
        levels: Array.from(enabledLevels)
    });
}
function restoreLevelState(levels) {
    enabledLevels = new Set(levels);
    syncAllLevelButtons(false);
    for (var i = 0; i < levels.length; i++) {
        var btn = document.getElementById('level-' + levels[i] + '-toggle');
        if (btn) btn.classList.add('active');
    }
    syncLevelDots();
    applyLevelFilter();
}`;
}

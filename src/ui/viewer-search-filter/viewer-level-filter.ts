import { getLevelClassifyScript } from './viewer-level-classify';
import { getLevelEventHandlers } from './viewer-level-events';

/** Fly-up level filter menu with dot summary, select all/none, and per-file persistence. */
export function getLevelFilterScript(): string {
    return /* javascript */ `
var enabledLevels = new Set(['info', 'warning', 'error', 'performance', 'todo', 'debug', 'notice']);
var allLevelNames = ['info', 'warning', 'error', 'performance', 'todo', 'debug', 'notice'];
var contextLinesBefore = 3;
var levelMenuOpen = false;

${getLevelClassifyScript()}
${getApplyLevelFilterFn()}
${getToggleLevelFn()}
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
    var allEnabled = enabledLevels.size === 7;
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
                if (ctx.type === 'marker') continue;
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

/** Toggle a single level and sync dots + persistence. */
function getToggleLevelFn(): string {
    return /* javascript */ `
function toggleLevel(level) {
    if (enabledLevels.has(level)) { enabledLevels.delete(level); }
    else { enabledLevels.add(level); }
    var btn = document.getElementById('level-' + level + '-toggle');
    if (btn) btn.classList.toggle('active', enabledLevels.has(level));
    syncLevelDots();
    applyLevelFilter();
    saveLevelState();
    if (typeof markPresetDirty === 'function') markPresetDirty();
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
        if (count === 7) label.textContent = 'All';
        else if (count === 0) label.textContent = 'None';
        else label.textContent = count + '/7';
    }
    var selAll = document.getElementById('level-select-all');
    var selNone = document.getElementById('level-select-none');
    if (selAll) selAll.classList.toggle('active', count === 7);
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
    enabledLevels = new Set();
    syncAllLevelButtons(false);
    syncLevelDots();
    applyLevelFilter();
    saveLevelState();
    if (typeof markPresetDirty === 'function') markPresetDirty();
}
function soloLevel(level) {
    if (enabledLevels.size === 1 && enabledLevels.has(level)) { selectAllLevels(); return; }
    enabledLevels = new Set([level]);
    syncAllLevelButtons(false);
    var btn = document.getElementById('level-' + level + '-toggle');
    if (btn) btn.classList.add('active');
    syncLevelDots();
    applyLevelFilter();
    saveLevelState();
    if (typeof markPresetDirty === 'function') markPresetDirty();
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
    if (label) label.textContent = contextLinesBefore + (contextLinesBefore === 1 ? ' line' : ' lines');
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

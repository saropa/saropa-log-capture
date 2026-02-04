/** Fly-up level filter menu with dot summary, select all/none, and per-file persistence. */
export function getLevelFilterScript(): string {
    return /* javascript */ `
/** Set of currently enabled log levels. All enabled by default. */
var enabledLevels = new Set(['info', 'warning', 'error', 'performance', 'todo', 'debug', 'notice']);

/** All known level names (order matches footer dots). */
var allLevelNames = ['info', 'warning', 'error', 'performance', 'todo', 'debug', 'notice'];

/** Number of preceding context lines to show when filtering. */
var contextLinesBefore = 3;

/** Whether the level fly-up menu is currently open. */
var levelMenuOpen = false;

var errorPattern = /\\b(error|exception|fail(ed|ure)?|fatal|panic|critical)\\b/i;
var warnPattern = /\\b(warn(ing)?|caution)\\b/i;
var perfPattern = /\\b(performance|dropped\\s+frame|fps|framerate|jank|stutter|skipped\\s+\\d+\\s+frames?|choreographer|doing\\s+too\\s+much\\s+work|gc\\s+pause|anr|application\\s+not\\s+responding)\\b/i;
var todoPattern = /\\b(TODO|FIXME|HACK|XXX)\\b/i;
var debugPattern = /\\b(breadcrumb|trace|debug)\\b/i;
var noticePattern = /\\b(notice|note|important)\\b/i;

${getClassifyLevelFn()}
${getApplyLevelFilterFn()}
${getToggleLevelFn()}
${getSyncLevelDotsFn()}
${getFlyupFns()}
${getSelectFns()}
${getContextSliderFn()}
${getPersistenceFns()}
${getEventHandlers()}
`;
}

/** Classification function — determines level from text + category. */
function getClassifyLevelFn(): string {
    return /* javascript */ `
function classifyLevel(plainText, category) {
    if (category === 'stderr' || errorPattern.test(plainText)) return 'error';
    if (warnPattern.test(plainText)) return 'warning';
    if (perfPattern.test(plainText)) return 'performance';
    if (todoPattern.test(plainText)) return 'todo';
    if (debugPattern.test(plainText)) return 'debug';
    if (noticePattern.test(plainText)) return 'notice';
    return 'info';
}`;
}

/** Two-pass filter: mark filtered lines, then restore context lines. */
function getApplyLevelFilterFn(): string {
    return /* javascript */ `
function applyLevelFilter() {
    var allEnabled = enabledLevels.size === 7;
    for (var i = 0; i < allLines.length; i++) {
        var item = allLines[i];
        item.isContext = false;
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

/** Fly-up menu open/close/toggle. */
function getFlyupFns(): string {
    return /* javascript */ `
function toggleLevelMenu() {
    levelMenuOpen ? closeLevelMenu() : openLevelMenu();
}
function openLevelMenu() {
    var flyup = document.getElementById('level-flyup');
    if (flyup) flyup.classList.add('visible');
    levelMenuOpen = true;
    syncContextSlider();
}
function closeLevelMenu() {
    var flyup = document.getElementById('level-flyup');
    if (flyup) flyup.classList.remove('visible');
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

/** Message handlers, click handlers, and dismiss logic. */
function getEventHandlers(): string {
    return /* javascript */ `
// Message handlers
window.addEventListener('message', function(event) {
    var msg = event.data;
    if (msg.type === 'setContextLines') {
        contextLinesBefore = typeof msg.count === 'number' ? msg.count : 3;
        syncContextSlider();
        if (enabledLevels.size < 7) applyLevelFilter();
    } else if (msg.type === 'restoreLevelFilters' && msg.levels) {
        restoreLevelState(msg.levels);
    }
});

// Individual dot group clicks toggle that level directly; double-click solos it
var dotGroups = document.querySelectorAll('.level-dot-group');
for (var di = 0; di < dotGroups.length; di++) {
    (function(group) {
        group.addEventListener('click', function(e) {
            e.stopPropagation();
            var lvl = group.getAttribute('data-level');
            if (lvl) toggleLevel(lvl);
        });
        group.addEventListener('dblclick', function(e) {
            e.stopPropagation();
            var lvl = group.getAttribute('data-level');
            if (lvl) soloLevel(lvl);
        });
    })(dotGroups[di]);
}

// Label text triggers the fly-up menu
var triggerLabel = document.getElementById('level-trigger-label');
if (triggerLabel) {
    triggerLabel.addEventListener('click', function(e) {
        e.stopPropagation();
        toggleLevelMenu();
    });
}

// Select all / none links
var selAll = document.getElementById('level-select-all');
var selNone = document.getElementById('level-select-none');
if (selAll) selAll.addEventListener('click', function(e) { e.preventDefault(); selectAllLevels(); });
if (selNone) selNone.addEventListener('click', function(e) { e.preventDefault(); selectNoneLevels(); });

// Context lines slider in fly-up
var ctxSlider = document.getElementById('context-lines-slider');
if (ctxSlider) {
    ctxSlider.addEventListener('input', function(e) {
        contextLinesBefore = parseInt(e.target.value, 10);
        syncContextSlider();
        if (enabledLevels.size < 7) applyLevelFilter();
    });
}

// Level circle click handlers (inside fly-up)
var levelIds = allLevelNames;
for (var li = 0; li < levelIds.length; li++) {
    (function(lvl) {
        var btn = document.getElementById('level-' + lvl + '-toggle');
        if (btn) btn.addEventListener('click', function() { toggleLevel(lvl); });
    })(levelIds[li]);
}

// Close fly-up on click outside (but not inside fly-up or trigger)
document.addEventListener('click', function(e) {
    if (!levelMenuOpen) return;
    var flyup = document.getElementById('level-flyup');
    var trigger = document.getElementById('level-menu-btn');
    if (flyup && !flyup.contains(e.target) && trigger && !trigger.contains(e.target)) {
        closeLevelMenu();
    }
});

// Close fly-up on Escape
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && levelMenuOpen) closeLevelMenu();
});
`;
}

/**
 * Viewer Level Filter Script
 *
 * Provides fly-up menu with level toggle buttons, select all/none,
 * and per-file state persistence. Footer shows compact dot summary.
 *
 * Integration points:
 * - addToData() classifies each line's level (error/warning/info)
 * - Footer dot summary opens fly-up; fly-up buttons toggle levels
 * - renderItem() applies context-line dimming via CSS class
 * - Extension sends contextLinesBefore count via setContextLines message
 * - Extension sends restoreLevelFilters on file load
 */

/**
 * Returns the JavaScript code for level filtering in the webview.
 */
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

/** Error-level pattern for heuristic classification. */
var errorPattern = /\\b(error|exception|fail(ed|ure)?|fatal|panic|critical)\\b/i;

/** Warning-level pattern for heuristic classification. */
var warnPattern = /\\b(warn(ing)?|caution)\\b/i;

/** Performance-level pattern for heuristic classification. */
var perfPattern = /\\b(performance|dropped\\s+frame|fps|framerate|slow|lag|jank|stutter|skipped\\s+\\d+\\s+frames?|choreographer|doing\\s+too\\s+much\\s+work|gc\\s+pause|anr|application\\s+not\\s+responding)\\b/i;

/** TODO-level pattern for task markers and code comments. */
var todoPattern = /\\b(TODO|FIXME|HACK|XXX)\\b/i;

/** Debug/Breadcrumb-level pattern for trace logging. */
var debugPattern = /\\b(breadcrumb|trace|debug)\\b/i;

/** Notice-level pattern for important informational messages. */
var noticePattern = /\\b(notice|note|important)\\b/i;

${getClassifyLevelFn()}
${getApplyLevelFilterFn()}
${getToggleLevelFn()}
${getSyncLevelDotsFn()}
${getFlyupFns()}
${getSelectFns()}
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
    recalcHeights();
    renderViewport(true);
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
    var dots = document.querySelectorAll('.level-dot');
    for (var i = 0; i < dots.length; i++) {
        var lvl = dots[i].getAttribute('data-level');
        dots[i].classList.toggle('active', enabledLevels.has(lvl));
    }
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
function syncAllLevelButtons(active) {
    for (var i = 0; i < allLevelNames.length; i++) {
        var btn = document.getElementById('level-' + allLevelNames[i] + '-toggle');
        if (btn) btn.classList.toggle('active', active);
    }
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
        if (enabledLevels.size < 7) applyLevelFilter();
    } else if (msg.type === 'restoreLevelFilters' && msg.levels) {
        restoreLevelState(msg.levels);
    }
});

// Fly-up trigger (compact dot summary)
var levelMenuBtn = document.getElementById('level-menu-btn');
if (levelMenuBtn) levelMenuBtn.addEventListener('click', toggleLevelMenu);

// Select all / none links
var selAll = document.getElementById('level-select-all');
var selNone = document.getElementById('level-select-none');
if (selAll) selAll.addEventListener('click', function(e) { e.preventDefault(); selectAllLevels(); });
if (selNone) selNone.addEventListener('click', function(e) { e.preventDefault(); selectNoneLevels(); });

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

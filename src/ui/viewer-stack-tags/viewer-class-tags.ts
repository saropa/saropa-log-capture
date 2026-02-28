/**
 * Code Tag Filter for the log viewer webview.
 *
 * Detects class names, method names, and constructor calls from log lines and
 * stack frames. Patterns: "AppBadgeService.load()" → class + method,
 * "ResizeImage()" → constructor. Generic lifecycle methods are blacklisted.
 *
 * Integration points:
 * - addToData() calls parseClassTags() and registerClassTags() for each line
 * - calcItemHeight() checks item.classFiltered flag
 * - clear handler calls resetClassTags()
 * - trimData() calls unregisterClassTags() for removed lines
 */

/** Returns the JavaScript for class tag parsing, tracking, and filtering. */
export function getClassTagsScript(): string {
    return /* javascript */ `
var classTagCounts = {};
var hiddenClassTags = {};
var classTagOtherKey = '__classother__';
var classTagMinChip = 2;
var classTagShowAll = false;
var classTagMaxChips = 20;

/** Known file extensions to reject as false positives. */
var classTagExtensions = /^(?:dart|ts|tsx|js|jsx|py|java|go|cs|kt|swift|rb|rs|cpp|c|h|m|mm)$/;

/** Generic lifecycle methods that add no diagnostic value as tags. */
var genericMethods = { build: 1, dispose: 1, initState: 1, createElement: 1, toString: 1, hashCode: 1, debugFillProperties: 1, didChangeDependencies: 1, didUpdateWidget: 1, deactivate: 1, activate: 1 };

/** Parse code tags from plain text. Returns deduplicated array of class and method names. */
function parseClassTags(plainText) {
    var result = [];
    var seen = {};
    var m;
    function add(name) { if (!seen[name]) { seen[name] = true; result.push(name); } }
    var dotPat = /(?:^|[^a-zA-Z0-9_\\/])(_?[A-Z][a-zA-Z0-9_]{2,})\\.([a-z_][a-zA-Z0-9_]*)/g;
    dotPat.lastIndex = 0;
    while ((m = dotPat.exec(plainText)) !== null) {
        if (classTagExtensions.test(m[2])) continue;
        add(m[1]);
        if (!genericMethods[m[2]]) add(m[2]);
    }
    var ctorPat = /(?:^|[^a-zA-Z0-9_\\/])(_?[A-Z][a-zA-Z0-9_]{2,})\\(/g;
    ctorPat.lastIndex = 0;
    while ((m = ctorPat.exec(plainText)) !== null) { add(m[1]); }
    return result;
}

/** Increment counts for each class tag on an item. Sets classFiltered if all hidden. */
function registerClassTags(item) {
    var tags = item.classTags;
    if (!tags || tags.length === 0) {
        classTagCounts[classTagOtherKey] = (classTagCounts[classTagOtherKey] || 0) + 1;
    } else {
        for (var i = 0; i < tags.length; i++) {
            classTagCounts[tags[i]] = (classTagCounts[tags[i]] || 0) + 1;
        }
    }
    if (isClassFiltered(item)) { item.classFiltered = true; }
    updateClassTagSummary();
}

/** Decrement counts for each class tag on an item (used by trimData). */
function unregisterClassTags(item) {
    var tags = item.classTags;
    if (!tags || tags.length === 0) {
        if (classTagCounts[classTagOtherKey]) {
            classTagCounts[classTagOtherKey]--;
            if (classTagCounts[classTagOtherKey] <= 0) delete classTagCounts[classTagOtherKey];
        }
        return;
    }
    for (var i = 0; i < tags.length; i++) {
        var key = tags[i];
        if (classTagCounts[key]) {
            classTagCounts[key]--;
            if (classTagCounts[key] <= 0) delete classTagCounts[key];
        }
    }
}

/** Check if a line should be hidden by class tag filter. */
function isClassFiltered(item) {
    if (item.type === 'marker') return false;
    if (Object.keys(hiddenClassTags).length === 0) return false;
    var tags = item.classTags;
    if (!tags || tags.length === 0) return !!hiddenClassTags[classTagOtherKey];
    for (var i = 0; i < tags.length; i++) {
        if (!hiddenClassTags[tags[i]]) return false;
    }
    return true;
}

/** Set classFiltered flag on all lines based on hiddenClassTags. */
function applyClassTagFilter() {
    for (var i = 0; i < allLines.length; i++) {
        var item = allLines[i];
        if (item.type === 'marker') continue;
        item.classFiltered = isClassFiltered(item);
    }
    if (typeof recalcAndRender === 'function') { recalcAndRender(); }
    else { recalcHeights(); renderViewport(true); }
}

/** Toggle a single class tag on/off and re-apply the filter. */
function toggleClassTag(tag) {
    if (hiddenClassTags[tag]) {
        delete hiddenClassTags[tag];
    } else {
        hiddenClassTags[tag] = true;
    }
    applyClassTagFilter();
    rebuildClassTagChips();
    if (typeof markPresetDirty === 'function') { markPresetDirty(); }
}

/** Show all class tags (remove all from hidden set). */
function selectAllClassTags() {
    hiddenClassTags = {};
    applyClassTagFilter();
    rebuildClassTagChips();
}

/** Hide all class tags (add all to hidden set). */
function deselectAllClassTags() {
    var keys = Object.keys(classTagCounts);
    for (var i = 0; i < keys.length; i++) {
        hiddenClassTags[keys[i]] = true;
    }
    applyClassTagFilter();
    rebuildClassTagChips();
}

/** Solo a class tag: show only lines with this tag. Click again to clear. */
function soloClassTag(tag) {
    var keys = Object.keys(classTagCounts);
    var hiddenCount = Object.keys(hiddenClassTags).length;
    var isSolo = hiddenCount === keys.length - 1 && !hiddenClassTags[tag];
    if (isSolo) {
        hiddenClassTags = {};
    } else {
        hiddenClassTags = {};
        for (var i = 0; i < keys.length; i++) {
            if (keys[i] !== tag) hiddenClassTags[keys[i]] = true;
        }
    }
    applyClassTagFilter();
    rebuildClassTagChips();
    if (typeof markPresetDirty === 'function') { markPresetDirty(); }
}

/** Update the summary text in the class tags section. */
function updateClassTagSummary() {
    var el = document.getElementById('class-tag-summary');
    if (!el) return;
    var keys = Object.keys(classTagCounts);
    var chipCount = 0;
    for (var i = 0; i < keys.length; i++) {
        if (keys[i] !== classTagOtherKey && classTagCounts[keys[i]] >= classTagMinChip) chipCount++;
    }
    var hiddenKeys = Object.keys(hiddenClassTags);
    var hidden = 0;
    for (var hi = 0; hi < hiddenKeys.length; hi++) {
        if (classTagCounts[hiddenKeys[hi]]) hidden++;
    }
    el.textContent = chipCount + ' tag' + (chipCount !== 1 ? 's' : '')
        + (hidden > 0 ? ' (' + hidden + ' hidden)' : '');
    var section = document.getElementById('class-tags-section');
    if (section) { section.style.display = chipCount > 0 ? '' : 'none'; }
}

function rebuildClassTagChips() {
    var container = document.getElementById('class-tag-chips');
    if (!container) return;
    var esc = (typeof escapeTagHtml === 'function') ? escapeTagHtml : escapeHtml;
    var keys = Object.keys(classTagCounts);
    var chipKeys = [];
    for (var i = 0; i < keys.length; i++) {
        if (keys[i] !== classTagOtherKey && classTagCounts[keys[i]] >= classTagMinChip) chipKeys.push(keys[i]);
    }
    chipKeys.sort(function(a, b) { return classTagCounts[b] - classTagCounts[a]; });
    var limit = classTagShowAll ? chipKeys.length : Math.min(chipKeys.length, classTagMaxChips);
    var parts = [];
    if (chipKeys.length > 0) {
        parts.push('<span class="source-tag-actions">'
            + '<button class="tag-action-btn" data-classaction="all">All</button>'
            + '<button class="tag-action-btn" data-classaction="none">None</button></span>');
    }
    for (var j = 0; j < limit; j++) {
        var key = chipKeys[j];
        var active = !hiddenClassTags[key];
        var cls = 'source-tag-chip' + (active ? ' active' : '');
        parts.push('<button class="' + cls + '" data-classtag="' + esc(key) + '">'
            + '<span class="tag-label">' + esc(key) + '</span>'
            + '<span class="tag-count">' + classTagCounts[key] + '</span></button>');
    }
    if (chipKeys.length > classTagMaxChips) {
        var showLabel = classTagShowAll ? 'Show less' : 'Show all (' + chipKeys.length + ')';
        parts.push('<button class="tag-show-all-btn" data-classaction="toggle-all">' + showLabel + '</button>');
    }
    container.innerHTML = parts.join('');
    updateClassTagSummary();
}

/* Event delegation for class tag chip clicks. */
(function() {
    var chipsEl = document.getElementById('class-tag-chips');
    if (!chipsEl) return;
    chipsEl.addEventListener('click', function(e) {
        var chip = e.target.closest('[data-classtag]');
        if (chip && chip.dataset.classtag) { toggleClassTag(chip.dataset.classtag); return; }
        var btn = e.target.closest('[data-classaction]');
        if (!btn) return;
        if (btn.dataset.classaction === 'all') { selectAllClassTags(); }
        else if (btn.dataset.classaction === 'none') { deselectAllClassTags(); }
        else if (btn.dataset.classaction === 'toggle-all') { classTagShowAll = !classTagShowAll; rebuildClassTagChips(); }
    });
})();

/** Reset all class tag state. Called on clear. */
function resetClassTags() {
    classTagCounts = {};
    hiddenClassTags = {};
    var section = document.getElementById('class-tags-section');
    if (section) { section.style.display = 'none'; }
    var container = document.getElementById('class-tag-chips');
    if (container) { container.innerHTML = ''; }
    updateClassTagSummary();
}
`;
}

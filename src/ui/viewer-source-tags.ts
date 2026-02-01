/**
 * Source Tag Filter for the log viewer webview.
 *
 * Parses source tags from Android logcat prefixes (e.g. "D/FlutterJNI( 3861):")
 * and bracket prefixes (e.g. "[log]"). Tags are grouped by name only, ignoring
 * the level prefix. A collapsible strip above the log lines shows chips with
 * counts; clicking a chip toggles visibility of that source's lines.
 *
 * Integration points:
 * - addToData() calls parseSourceTag() and registerSourceTag() for each line
 * - calcItemHeight() checks item.sourceFiltered flag
 * - clear handler calls resetSourceTags()
 * - trimData() calls unregisterSourceTag() for removed lines
 */

/** Returns the HTML for the collapsible source tag strip. */
export function getSourceTagsHtml(): string {
    return /* html */ `<div id="source-tag-strip" class="source-tag-strip collapsed" style="display:none">
    <div class="source-tag-header">
        <span class="source-tag-chevron">&#x25B6;</span>
        <span>Sources</span>
        <span id="source-tag-summary" class="source-tag-summary"></span>
    </div>
    <div id="source-tag-chips" class="source-tag-chips"></div>
</div>`;
}

/** Returns the JavaScript for source tag parsing, tracking, and filtering. */
export function getSourceTagsScript(): string {
    return /* javascript */ `
/** Tag -> line count. Key '__other__' represents lines with no recognized tag. */
var sourceTagCounts = {};

/** Set of tag keys currently hidden (toggled off). */
var hiddenSourceTags = {};

/** Whether the tag strip is expanded (showing chips). */
var sourceTagStripExpanded = false;

/** Sentinel key for lines with no recognized source tag. */
var otherKey = '__other__';

/**
 * Regex to parse source tags from plain text.
 * Group 1: logcat level (V/D/I/W/E/F/A) — captured but ignored for grouping.
 * Group 2: logcat tag name (e.g. "FlutterJNI", "flutter").
 * Group 3: bracket tag name (e.g. "log" from "[log]").
 */
var sourceTagPattern = /^(?:([VDIWEFA])\\/([^(:\\s]+)\\s*(?:\\(\\s*\\d+\\))?:\\s|\\[([^\\]]+)\\]\\s)/;

/**
 * Parse a source tag from the plain text of a log line.
 * @param {string} plainText - HTML-stripped line content
 * @returns {string|null} Lowercase tag name, or null if unrecognized
 */
function parseSourceTag(plainText) {
    var m = sourceTagPattern.exec(plainText);
    if (m) {
        var raw = m[2] || m[3];
        return raw ? raw.toLowerCase() : null;
    }
    return null;
}

/** Increment the count for a line item's source tag. */
function registerSourceTag(item) {
    var key = item.sourceTag || otherKey;
    sourceTagCounts[key] = (sourceTagCounts[key] || 0) + 1;
    if (hiddenSourceTags[key]) { item.sourceFiltered = true; }
    updateTagSummary();
}

/** Decrement the count for a line item's source tag (used by trimData). */
function unregisterSourceTag(item) {
    var key = item.sourceTag || otherKey;
    if (sourceTagCounts[key]) {
        sourceTagCounts[key]--;
        if (sourceTagCounts[key] <= 0) { delete sourceTagCounts[key]; }
    }
}

/**
 * Set sourceFiltered flag on all lines based on hiddenSourceTags.
 * Delegates to recalcHeights() so all filter flags compose correctly.
 */
function applySourceTagFilter() {
    for (var i = 0; i < allLines.length; i++) {
        var item = allLines[i];
        if (item.type === 'marker') { continue; }
        var key = item.sourceTag || otherKey;
        item.sourceFiltered = !!hiddenSourceTags[key];
    }
    recalcHeights();
    renderViewport(true);
}

/** Toggle a single source tag on/off and re-apply the filter. */
function toggleSourceTag(tag) {
    if (hiddenSourceTags[tag]) {
        delete hiddenSourceTags[tag];
    } else {
        hiddenSourceTags[tag] = true;
    }
    applySourceTagFilter();
    rebuildTagChips();
    if (typeof markPresetDirty === 'function') { markPresetDirty(); }
}

/** Show all source tags (remove all from hidden set). */
function selectAllTags() {
    hiddenSourceTags = {};
    applySourceTagFilter();
    rebuildTagChips();
}

/** Hide all source tags (add all to hidden set). */
function deselectAllTags() {
    var keys = Object.keys(sourceTagCounts);
    for (var i = 0; i < keys.length; i++) {
        hiddenSourceTags[keys[i]] = true;
    }
    applySourceTagFilter();
    rebuildTagChips();
}

/** Toggle collapse/expand of the source tag strip. */
function toggleTagStrip() {
    sourceTagStripExpanded = !sourceTagStripExpanded;
    var strip = document.getElementById('source-tag-strip');
    if (!strip) { return; }
    strip.classList.toggle('collapsed', !sourceTagStripExpanded);
    strip.classList.toggle('expanded', sourceTagStripExpanded);
    var chevron = strip.querySelector('.source-tag-chevron');
    if (chevron) {
        chevron.innerHTML = sourceTagStripExpanded ? '&#x25BC;' : '&#x25B6;';
    }
    if (sourceTagStripExpanded) { rebuildTagChips(); }
}

/** Update the summary text in the strip header ("12 tags (3 hidden)"). */
function updateTagSummary() {
    var el = document.getElementById('source-tag-summary');
    if (!el) { return; }
    var total = Object.keys(sourceTagCounts).length;
    var hiddenKeys = Object.keys(hiddenSourceTags);
    var hidden = 0;
    for (var hi = 0; hi < hiddenKeys.length; hi++) {
        if (sourceTagCounts[hiddenKeys[hi]]) { hidden++; }
    }
    el.textContent = total + ' source' + (total !== 1 ? 's' : '')
        + (hidden > 0 ? ' (' + hidden + ' hidden)' : '');
    var strip = document.getElementById('source-tag-strip');
    if (strip) { strip.style.display = total > 0 ? '' : 'none'; }
}

/** Escape HTML special characters for safe insertion into chip labels. */
function escapeTagHtml(text) {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Rebuild the chip HTML inside the tag strip. Sorted by count descending. */
function rebuildTagChips() {
    var container = document.getElementById('source-tag-chips');
    if (!container) { return; }
    var keys = Object.keys(sourceTagCounts);
    keys.sort(function(a, b) { return sourceTagCounts[b] - sourceTagCounts[a]; });
    var parts = [];
    parts.push(
        '<span class="source-tag-actions">'
        + '<button class="tag-action-btn" data-action="all">All</button>'
        + '<button class="tag-action-btn" data-action="none">None</button>'
        + '</span>'
    );
    for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        var label = key === otherKey ? '(Other)' : escapeTagHtml(key);
        var count = sourceTagCounts[key];
        var active = !hiddenSourceTags[key];
        var cls = 'source-tag-chip' + (active ? ' active' : '');
        parts.push(
            '<button class="' + cls + '" data-tag="' + escapeTagHtml(key) + '">'
            + '<span class="tag-label">' + label + '</span>'
            + '<span class="tag-count">' + count + '</span>'
            + '</button>'
        );
    }
    container.innerHTML = parts.join('');
    updateTagSummary();
}

/* Event delegation for chip clicks — avoids inline onclick escaping issues. */
(function() {
    var chipsEl = document.getElementById('source-tag-chips');
    if (!chipsEl) { return; }
    chipsEl.addEventListener('click', function(e) {
        var chip = e.target.closest('.source-tag-chip');
        if (chip && chip.dataset.tag) { toggleSourceTag(chip.dataset.tag); return; }
        var btn = e.target.closest('.tag-action-btn');
        if (btn && btn.dataset.action === 'all') { selectAllTags(); }
        if (btn && btn.dataset.action === 'none') { deselectAllTags(); }
    });
})();

/** Reset all source tag state. Called on clear. */
function resetSourceTags() {
    sourceTagCounts = {};
    hiddenSourceTags = {};
    sourceTagStripExpanded = false;
    var strip = document.getElementById('source-tag-strip');
    if (strip) {
        strip.classList.add('collapsed');
        strip.classList.remove('expanded');
        strip.style.display = 'none';
        var chevron = strip.querySelector('.source-tag-chevron');
        if (chevron) { chevron.innerHTML = '&#x25B6;'; }
    }
    var container = document.getElementById('source-tag-chips');
    if (container) { container.innerHTML = ''; }
    updateTagSummary();
}

// Register click handler for tag strip header
var tagHeader = document.querySelector('.source-tag-header');
if (tagHeader) {
    tagHeader.addEventListener('click', toggleTagStrip);
}
`;
}

/**
 * Source Tag Filter for the log viewer webview.
 *
 * Parses source tags from Android logcat prefixes (e.g. "D/FlutterJNI( 3861):")
 * and bracket prefixes (e.g. "[log]"). Tags are grouped by name only, ignoring
 * the level prefix. Chips in the filters panel Log Tags section show tag names
 * and counts; clicking a chip toggles visibility of that tag's lines.
 *
 * Integration points:
 * - addToData() calls parseSourceTag() and registerSourceTag() for each line
 * - calcItemHeight() checks item.sourceFiltered flag
 * - clear handler calls resetSourceTags()
 * - trimData() calls unregisterSourceTag() for removed lines
 */

import { getSourceTagUiScript } from './viewer-source-tags-ui';

/** Returns empty HTML — log tags now live inside the filters panel. */
export function getSourceTagsHtml(): string {
    return '';
}

/** Returns the JavaScript for source tag parsing, tracking, and filtering. */
export function getSourceTagsScript(): string {
    return /* javascript */ `
var sourceTagCounts = {};
var hiddenSourceTags = {};
var otherKey = '__other__';
var sourceTagShowAll = false;
var sourceTagMaxChips = 20;

/**
 * Regex to parse source tags from plain text (start of line only).
 * Group 1: logcat level (V/D/I/W/E/F/A) — captured but ignored for grouping.
 * Group 2: logcat tag name (e.g. "FlutterJNI", "flutter").
 * Group 3: bracket tag name (e.g. "log" from "[log]").
 */
var sourceTagPattern = /^(?:([VDIWEFA])\\/([^(:\\s]+)\\s*(?:\\(\\s*\\d+\\))?:\\s|\\[([^\\]]+)\\]\\s)/;

/** Bracket tag anywhere in text: [TagName] (allows spaces for multi-word tags). */
var inlineTagPattern = /\\[([A-Za-z][A-Za-z0-9 _-]*)\\]/g;

/** ALL-CAPS prefix at start of message body (e.g. HERO-DEBUG, MY_APP). */
var capsPrefix = /^([A-Z][A-Z0-9_-]+) /;

/** Generic logcat tags where sub-tag detection looks into the message body. */
var genericLogcatTags = { 'flutter': 1, 'android': 1, 'system.err': 1 };

/** Extract a sub-tag from the message body of a generic logcat line. */
function extractSubTag(body) {
    var cm = capsPrefix.exec(body);
    if (cm && cm[1] && cm[1].length >= 3) return cm[1].toLowerCase();
    inlineTagPattern.lastIndex = 0;
    var bm = inlineTagPattern.exec(body);
    if (bm && bm[1]) return bm[1].toLowerCase();
    return null;
}

/** Return the raw logcat prefix tag (e.g. "flutter" from "I/flutter"). Null for non-logcat. */
function parseLogcatTag(plainText) {
    var m = sourceTagPattern.exec(plainText);
    if (!m || !m[2]) return null;
    return m[2].toLowerCase();
}

/** Parse a source tag from the plain text of a log line. */
function parseSourceTag(plainText) {
    var m = sourceTagPattern.exec(plainText);
    if (m) {
        var raw = m[2] || m[3];
        if (!raw) return null;
        var tag = raw.toLowerCase();
        if (m[2] && genericLogcatTags[tag]) {
            var sub = extractSubTag(plainText.slice(m[0].length));
            if (sub) return sub;
        }
        return tag;
    }
    inlineTagPattern.lastIndex = 0;
    var inlineMatch = inlineTagPattern.exec(plainText);
    if (inlineMatch && inlineMatch[1]) return inlineMatch[1].toLowerCase();
    return null;
}

/** Increment the count for a line item's source tag (and logcat parent tag if different). */
function registerSourceTag(item) {
    var key = item.sourceTag || otherKey;
    sourceTagCounts[key] = (sourceTagCounts[key] || 0) + 1;
    var lk = item.logcatTag;
    if (lk && lk !== key) { sourceTagCounts[lk] = (sourceTagCounts[lk] || 0) + 1; }
    var primaryHidden = !!hiddenSourceTags[key];
    var parentHidden = lk ? !!hiddenSourceTags[lk] : true;
    if (primaryHidden && (!lk || parentHidden)) { item.sourceFiltered = true; }
    updateTagSummary();
}

/** Decrement the count for a line item's source tag and logcat parent (used by trimData). */
function unregisterSourceTag(item) {
    var key = item.sourceTag || otherKey;
    if (sourceTagCounts[key]) {
        sourceTagCounts[key]--;
        if (sourceTagCounts[key] <= 0) { delete sourceTagCounts[key]; }
    }
    var lk = item.logcatTag;
    if (lk && lk !== key && sourceTagCounts[lk]) {
        sourceTagCounts[lk]--;
        if (sourceTagCounts[lk] <= 0) { delete sourceTagCounts[lk]; }
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
        var lk = item.logcatTag;
        var primaryHidden = !!hiddenSourceTags[key];
        var parentHidden = lk ? !!hiddenSourceTags[lk] : true;
        item.sourceFiltered = primaryHidden && (!lk || parentHidden);
    }
    if (typeof recalcAndRender === 'function') { recalcAndRender(); }
    else { recalcHeights(); renderViewport(true); }
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

/** Update the summary text in the log tags section. */
function updateTagSummary() {
    var el = document.getElementById('source-tag-summary');
    if (!el) { return; }
    var total = Object.keys(sourceTagCounts).length;
    var hiddenKeys = Object.keys(hiddenSourceTags);
    var hidden = 0;
    for (var hi = 0; hi < hiddenKeys.length; hi++) {
        if (sourceTagCounts[hiddenKeys[hi]]) { hidden++; }
    }
    el.textContent = total + ' tag' + (total !== 1 ? 's' : '')
        + (hidden > 0 ? ' (' + hidden + ' hidden)' : '');
    var section = document.getElementById('log-tags-section');
    if (section) { section.style.display = total > 0 ? '' : 'none'; }
}

${getSourceTagUiScript()}
`;
}

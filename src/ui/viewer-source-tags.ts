/**
 * Source Tag Filter for the log viewer webview.
 *
 * Parses source tags from Android logcat prefixes (e.g. "D/FlutterJNI( 3861):")
 * and bracket prefixes (e.g. "[log]"). Tags are grouped by name only, ignoring
 * the level prefix. Chips in the options panel Log Tags section show tag names
 * and counts; clicking a chip toggles visibility of that tag's lines.
 *
 * Integration points:
 * - addToData() calls parseSourceTag() and registerSourceTag() for each line
 * - calcItemHeight() checks item.sourceFiltered flag
 * - clear handler calls resetSourceTags()
 * - trimData() calls unregisterSourceTag() for removed lines
 */

/** Returns empty HTML — log tags now live inside the options panel. */
export function getSourceTagsHtml(): string {
    return '';
}

/** Returns the JavaScript for source tag parsing, tracking, and filtering. */
export function getSourceTagsScript(): string {
    return /* javascript */ `
/** Tag -> line count. Key '__other__' represents lines with no recognized tag. */
var sourceTagCounts = {};

/** Set of tag keys currently hidden (toggled off). */
var hiddenSourceTags = {};

/** Sentinel key for lines with no recognized source tag. */
var otherKey = '__other__';

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
    inlineTagPattern.lastIndex = 0;
    var bm = inlineTagPattern.exec(body);
    if (bm && bm[1]) return bm[1].toLowerCase();
    var cm = capsPrefix.exec(body);
    if (cm && cm[1] && cm[1].length >= 3) return cm[1].toLowerCase();
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

/** Escape HTML special characters for safe insertion into chip labels. */
function escapeTagHtml(text) {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Rebuild the chip HTML inside the log tags section. Sorted by count descending. */
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
    var section = document.getElementById('log-tags-section');
    if (section) { section.style.display = 'none'; }
    var container = document.getElementById('source-tag-chips');
    if (container) { container.innerHTML = ''; }
    updateTagSummary();
}

/** Solo a tag: show only lines with this tag. Click again to clear. */
function soloSourceTag(tag) {
    var keys = Object.keys(sourceTagCounts);
    var hiddenCount = Object.keys(hiddenSourceTags).length;
    var isSolo = hiddenCount === keys.length - 1 && !hiddenSourceTags[tag];
    if (isSolo) {
        hiddenSourceTags = {};
    } else {
        hiddenSourceTags = {};
        for (var i = 0; i < keys.length; i++) {
            if (keys[i] !== tag) hiddenSourceTags[keys[i]] = true;
        }
    }
    applySourceTagFilter();
    rebuildTagChips();
    if (typeof markPresetDirty === 'function') { markPresetDirty(); }
}

/** Deterministic color from 8-color palette via string hash. */
var tagPalette = ['#4ec9b0','#ce9178','#e0a370','#9cdcfe','#c586c0','#d7ba7d','#b5cea8','#569cd6'];
function tagColor(tag) {
    var h = 0;
    for (var i = 0; i < tag.length; i++) h = ((h << 5) - h + tag.charCodeAt(i)) | 0;
    return tagPalette[Math.abs(h) % tagPalette.length];
}

/** Wrap the first occurrence of the source tag in HTML with a clickable span. */
function wrapTagLink(html, sourceTag) {
    if (!sourceTag || sourceTag === otherKey) return html;
    var color = tagColor(sourceTag);
    var wrapped = false;
    return html.replace(/(<[^>]*>)|([^<]+)/g, function(m, tag, text) {
        if (tag || wrapped) return m;
        var lower = text.toLowerCase();
        var idx = lower.indexOf(sourceTag);
        if (idx < 0) return text;
        wrapped = true;
        var orig = text.substring(idx, idx + sourceTag.length);
        var safe = orig.replace(/"/g, '&quot;');
        return text.substring(0, idx)
            + '<span class="tag-link" data-tag="' + sourceTag + '" title="Click to filter: ' + safe + '" style="--tag-clr:' + color + '">' + orig + '</span>'
            + text.substring(idx + sourceTag.length);
    });
}

/* Click handler for inline tag links in rendered log lines. */
(function() {
    var vp = document.getElementById('viewport');
    if (!vp) return;
    vp.addEventListener('click', function(e) {
        var tagEl = e.target.closest('.tag-link');
        if (tagEl && tagEl.dataset.tag) {
            e.preventDefault();
            e.stopPropagation();
            soloSourceTag(tagEl.dataset.tag);
        }
    });
})();
`;
}

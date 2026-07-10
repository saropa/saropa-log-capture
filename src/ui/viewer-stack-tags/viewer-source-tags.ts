/**
 * Source Tag Filter for the log viewer webview.
 *
 * Parses source tags from Android logcat prefixes (e.g. "D/FlutterJNI( 3861):")
 * and bracket prefixes (e.g. "[log]"). Tags are grouped by name only, ignoring
 * the level prefix. Chips in the filters panel Message Tags section show tag names
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
/* First-seen display name (original case, e.g. "ActivityManager") per lowercase filter
   key. The sidebar chip label reads from here (via formatTagLabel) instead of the key
   itself, so it matches the case-preserving row-column chips instead of showing the
   all-lowercase grouping key ("activitymanager"). */
var sourceTagDisplayNames = {};
var hiddenSourceTags = {};
var otherKey = '__other__';
/** Log-tag key for Drift/database SQL lines (see parseSourceTag). */
var DATABASE_TAG_KEY = 'database';
var sourceTagShowAll = false;
var sourceTagMaxChips = 20;
var sourceTagMinChip = 2;

/** Saved hidden state before a solo action, so double-tap-again restores it. */
var savedHiddenSourceTags = null;
/** Which source tag is currently solo'd (null if none). */
var soloedSourceTag = null;

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

/** Drift SQL statement logs should map to a dedicated database source tag.
 *  Matches LogInterceptor (Drift: Sent SELECT) and DriftDebugInterceptor (Drift SELECT: SELECT). */
var driftStatementPattern = /\\bDrift(?:\\:\\s+Sent|\\s+(?:SELECT|INSERT|UPDATE|DELETE|WITH|PRAGMA|BEGIN|COMMIT|ROLLBACK)\\s*\\:)\\s+(?:SELECT|INSERT|UPDATE|DELETE|WITH|PRAGMA|BEGIN|COMMIT|ROLLBACK)\\b/i;

/** Generic logcat tags where sub-tag detection looks into the message body. */
var genericLogcatTags = { 'flutter': 1, 'android': 1, 'system.err': 1 };

/**
 * Guardrail: reject dynamic/noisy tokens so tag chips stay useful.
 * This filters timestamp-like ids (08:45:23.606), mostly numeric tokens,
 * and long hash-like identifiers that create high-cardinality noise.
 */
function isNoisySourceTag(tag) {
    if (!tag) return true;
    var t = tag.toLowerCase();
    if (t === 'other') return true;
    if (t.length < 2) return true;
    if (t.length > 64) return true;

    // Purely numeric or mostly numeric tokens are usually counters/ids.
    if (/^[0-9]+$/.test(t)) return true;
    var digits = (t.match(/[0-9]/g) || []).length;
    if (digits > 0 && (digits / t.length) >= 0.4) return true;

    // Time-like or date-time fragments.
    if (/^\\d{1,2}:\\d{2}(?::\\d{2}(?:\\.\\d{1,6})?)?$/.test(t)) return true;
    if (/^\\d{4}-\\d{2}-\\d{2}(?:[t_ ]\\d{2}:\\d{2}(?::\\d{2}(?:\\.\\d{1,6})?)?)?$/.test(t)) return true;

    // UUID / long hex-ish tokens.
    if (/^[0-9a-f]{8,}$/.test(t)) return true;
    if (/^[0-9a-f]{8}-[0-9a-f-]{8,}$/.test(t)) return true;
    return false;
}

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
        if (raw) {
            // Bracket tags support [TAG:metadata] — derived name is everything before the first
            // colon so [db:phase 2] and [db:retry] both group as 'db'; the metadata stays visible
            // inline (we only read plainText). Logcat tags (m[2]) can't contain a colon, so the
            // split applies to the bracket capture only. Mirrors source-tag-parser.ts.
            var tag = m[3] ? m[3].split(':')[0].trim().toLowerCase() : raw.toLowerCase();
            var body = plainText.slice(m[0].length);
            if (driftStatementPattern.test(body)) return 'database';
            if (m[2] && genericLogcatTags[tag]) {
                var sub = extractSubTag(body);
                if (sub && !isNoisySourceTag(sub)) return sub;
                // Bracket/caps sub-tag was only a time-like or hash token — do not fall back to generic "flutter"/"android".
                if (sub && isNoisySourceTag(sub)) return null;
                // Leading [token] not matched by extractSubTag (inline pattern requires a letter after "[") may still be noise (e.g. [08:45:23.606]).
                var leadBracket = /^\\s*\\[([^\\]]+)\\]/.exec(body);
                if (leadBracket && leadBracket[1] && isNoisySourceTag(leadBracket[1].toLowerCase())) return null;
            }
            if (!isNoisySourceTag(tag)) return tag;
            /* Leading bracket matched but was noisy (timestamp/hash/ISO-date prefix, e.g.
               [16:07:58.532] on console/SDA log lines). Previously we returned null here and
               the meaningful secondary tag ([console], [log], ...) never registered — the
               user saw WindowManager/ActivityManager chips but no 'console' chip. Fall
               through to the inline-tag scan below so the first letter-led bracket in the
               line wins instead. */
        }
    }
    inlineTagPattern.lastIndex = 0;
    var inlineMatch = inlineTagPattern.exec(plainText);
    if (inlineMatch && inlineMatch[1]) {
        var inlineTag = inlineMatch[1].toLowerCase();
        return isNoisySourceTag(inlineTag) ? null : inlineTag;
    }
    return null;
}

/** Return source-tag keys eligible for chips/summaries (excludes low-signal buckets). */
function getSourceTagChipKeys() {
    var keys = Object.keys(sourceTagCounts);
    var chipKeys = [];
    for (var ki = 0; ki < keys.length; ki++) {
        var key = keys[ki];
        if (key !== otherKey && sourceTagCounts[key] >= sourceTagMinChip) chipKeys.push(key);
    }
    return chipKeys;
}

/* The line's filter keys = its unified tag set (item.tags, built once in
   addToData), or the catch-all otherKey when it has none. ONE source shared by
   count, filter, and trim so the sidebar chips, the log chips, and the
   hidden-line math can never disagree — the mismatch that made toggling a chip
   appear to do nothing (the chip you saw had no sidebar entry). */
function lineTagKeys(item) {
    if (item && item.tags && item.tags.length) {
        var ks = [];
        for (var i = 0; i < item.tags.length; i++) { ks.push(item.tags[i].key); }
        return ks;
    }
    return [otherKey];
}

/* A line is hidden only when EVERY one of its tags is hidden; toggling any one
   of its tags back on reveals it. */
function computeSourceFiltered(item) {
    var ks = lineTagKeys(item);
    for (var i = 0; i < ks.length; i++) { if (!hiddenSourceTags[ks[i]]) { return false; } }
    return true;
}

/** Increment the count for every tag on a line item. */
function registerSourceTag(item) {
    var ks = lineTagKeys(item);
    var sawDb = false;
    for (var i = 0; i < ks.length; i++) {
        sourceTagCounts[ks[i]] = (sourceTagCounts[ks[i]] || 0) + 1;
        if (ks[i] === DATABASE_TAG_KEY) { sawDb = true; }
    }
    /* Capture the first-seen original-case name per key (item.tags carries {name, key}
       from the unified tag set — lineTagKeys only returns keys, so this needs its own pass). */
    if (item && item.tags && item.tags.length) {
        for (var ti = 0; ti < item.tags.length; ti++) {
            var t = item.tags[ti];
            if (t && t.key && !sourceTagDisplayNames[t.key]) { sourceTagDisplayNames[t.key] = t.name; }
        }
    }
    item.sourceFiltered = computeSourceFiltered(item);
    updateTagSummary();
    if (sawDb && typeof updateSqlToolbarButton === 'function') { updateSqlToolbarButton(); }
}

/** Decrement the count for every tag on a line item (used by trimData). */
function unregisterSourceTag(item) {
    var ks = lineTagKeys(item);
    for (var i = 0; i < ks.length; i++) {
        if (sourceTagCounts[ks[i]]) {
            sourceTagCounts[ks[i]]--;
            if (sourceTagCounts[ks[i]] <= 0) { delete sourceTagCounts[ks[i]]; }
        }
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
        item.sourceFiltered = computeSourceFiltered(item);
    }
    if (typeof recalcAndRender === 'function') { recalcAndRender(); }
    else { recalcHeights(); renderViewport(true); }
    if (typeof updateSqlToolbarButton === 'function') updateSqlToolbarButton();
}

/** Icon bar SQL control: count + toggle; stays in sync with Filters Log tags database chip. */
function updateSqlToolbarButton() {
    var btn = document.getElementById('ib-sql-filter');
    if (!btn) return;
    var shortEl = document.getElementById('ib-sql-filter-count-short');
    var labelEl = btn.querySelector('.ib-sql-filter-label');
    var n = (sourceTagCounts && sourceTagCounts[DATABASE_TAG_KEY]) ? sourceTagCounts[DATABASE_TAG_KEY] : 0;
    var fmt = (typeof formatLogCountShort === 'function') ? formatLogCountShort(n) : String(n);
    if (shortEl) shortEl.textContent = fmt;
    if (labelEl) labelEl.textContent = 'SQL (' + fmt + ')';
    var hidden = n > 0 && !!(hiddenSourceTags && hiddenSourceTags[DATABASE_TAG_KEY]);
    btn.classList.toggle('ib-sql-filter-hidden', hidden);
    btn.disabled = n <= 0;
    btn.setAttribute('aria-pressed', hidden ? 'true' : 'false');
    btn.title = n <= 0 ? 'No database (SQL) lines in this log yet'
        : (hidden ? 'Show database (SQL) lines (' + fmt + ' in log)' : 'Hide database (SQL) lines (' + fmt + ' in log)');
}

function toggleDatabaseSqlFromToolbar() {
    var n = (sourceTagCounts && sourceTagCounts[DATABASE_TAG_KEY]) ? sourceTagCounts[DATABASE_TAG_KEY] : 0;
    if (n <= 0) return;
    toggleSourceTag(DATABASE_TAG_KEY);
}

/** Toggle a single source tag on/off and re-apply the filter. */
function toggleSourceTag(tag) {
    /* Manual toggle breaks any active solo — discard saved state. */
    savedHiddenSourceTags = null;
    soloedSourceTag = null;
    if (hiddenSourceTags[tag]) {
        delete hiddenSourceTags[tag];
    } else {
        hiddenSourceTags[tag] = true;
    }
    hiddenSourceTags = ensureAtLeastOneTagVisible(hiddenSourceTags, sourceTagCounts);
    applySourceTagFilter();
    rebuildTagChips();
    if (typeof markPresetDirty === 'function') { markPresetDirty(); }
}

/** Show all source tags (remove all from hidden set). */
function selectAllTags() {
    savedHiddenSourceTags = null;
    soloedSourceTag = null;
    hiddenSourceTags = {};
    applySourceTagFilter();
    rebuildTagChips();
}

/** Hide all source tags (add all to hidden set). */
function deselectAllTags() {
    savedHiddenSourceTags = null;
    soloedSourceTag = null;
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
    if (el) {
        var chipKeys = getSourceTagChipKeys();
        var chipKeySet = {};
        for (var ci = 0; ci < chipKeys.length; ci++) chipKeySet[chipKeys[ci]] = true;
        var total = chipKeys.length;
        var hiddenKeys = Object.keys(hiddenSourceTags);
        var hidden = 0;
        for (var hi = 0; hi < hiddenKeys.length; hi++) {
            if (chipKeySet[hiddenKeys[hi]]) {
                hidden++;
            }
        }
        var summary = total + ' tag' + (total !== 1 ? 's' : '')
            + (hidden > 0 ? ' (' + hidden + ' hidden)' : '');
        el.textContent = summary;
        /* Accordion header shows concise count: "5 hidden" or total */
        var accordionText = hidden > 0
            ? hidden + ' of ' + total + ' hidden'
            : total + ' tag' + (total !== 1 ? 's' : '');
        if (typeof setAccordionSummary === 'function') setAccordionSummary('log-tags-section', accordionText);
        /* Show/hide the tab button based on whether tags exist */
        var tab = document.getElementById('filter-tab-log-tags');
        if (tab) { tab.style.display = total > 0 ? '' : 'none'; }
    }
}

${getSourceTagUiScript()}
`;
}

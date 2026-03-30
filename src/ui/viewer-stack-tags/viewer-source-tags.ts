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
var hiddenSourceTags = {};
var otherKey = '__other__';
/** Log-tag key for Drift/database SQL lines (see parseSourceTag). */
var DATABASE_TAG_KEY = 'database';
var sourceTagShowAll = false;
var sourceTagMaxChips = 20;
var sourceTagMinChip = 2;

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

/** Drift SQL statement logs should map to a dedicated database source tag. */
var driftStatementPattern = /\\bDrift:\\s+Sent\\s+(?:SELECT|INSERT|UPDATE|DELETE|WITH|PRAGMA|BEGIN|COMMIT|ROLLBACK)\\b/i;

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
        if (!raw) return null;
        var tag = raw.toLowerCase();
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
        return isNoisySourceTag(tag) ? null : tag;
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
    if (key === DATABASE_TAG_KEY || lk === DATABASE_TAG_KEY) {
        if (typeof updateSqlToolbarButton === 'function') updateSqlToolbarButton();
    }
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
        if (typeof setAccordionSummary === 'function') setAccordionSummary('log-tags-section', summary);
        var section = document.getElementById('log-tags-section');
        if (section) { section.style.display = total > 0 ? '' : 'none'; }
    }
}

${getSourceTagUiScript()}
`;
}

/**
 * SQL pattern chips for database (Drift) log lines in the filters panel (plans DB_02, DB_05).
 *
 * ## Developer guide (extension host ↔ webview)
 * - **Build time:** `getSqlPatternTagsScript(min, max)` embeds initial `sqlChipMinCount` / `sqlPatternMaxChips`
 *   (clamped in TypeScript before string injection so the template cannot emit invalid numbers).
 * - **Runtime:** The extension posts `{ type: 'setViewerSqlPatternChipSettings', chipMinCount, chipMaxChips }`
 *   after webview load and when workspace settings change (`activation-listeners`, `extension-activation`,
 *   `log-viewer-provider-setup`, `pop-out-panel`). Handler: `viewer-script-messages.ts`.
 * - **Safety:** `applyViewerSqlPatternChipSettings` reclamps inside the iframe (defense in depth if a message is
 *   malformed). It does **not** recurse: it calls `applySqlPatternFilter` once (no feedback loop into settings).
 *   Concurrent rapid posts are last-write-wins; acceptable for editor settings.
 *
 * ## Behavior
 * - **Chip key** = normalized SQL fingerprint when `sqlPatternRawCounts[fingerprint] >= sqlChipMinCount`
 *   (default 2, aligned with source-tag chips). Otherwise lines bucket to **`__other_sql__`** (“Other SQL”).
 * - **Never** uses `with args` payloads for labels or keys — only the fingerprint from
 *   `drift-sql-fingerprint-normalize.ts` / `parseSqlFingerprint`.
 * - Lines counted: `line`, `repeat-notification`, and `n-plus-one-insight` with `sourceTag === 'database'`.
 *
 * ## Performance
 * - **`registerSqlPattern`** (hot path during streaming): updates flags + `recalcHeights()` + `renderViewport(false)` —
 *   avoids `recalcAndRender` scroll anchoring on every appended line.
 * - **`trimData`**: `unregisterSqlPattern` is O(1) per removed row; **`finalizeSqlPatternState`** runs once after
 *   the trim batch and uses full **`applySqlPatternFilter`** (anchored) so scroll position stays stable.
 * - **`toggleSqlPattern` / select-all / deselect-all**: use anchored **`applySqlPatternFilter`**.
 * - **Settings apply:** `applyViewerSqlPatternChipSettings` is O(lines × fingerprints touched); only runs on user
 *   config change, not per log line.
 *
 * ## Logic & invariants
 * - Promote/demote when raw count crosses `sqlChipMinCount` reassigns `sqlPatternChipKey` on all matching lines.
 * - `ensureAtLeastOneTagVisible` uses **live** line counts per key so toggling cannot leave an empty “all hidden”
 *   chip set without falling back to all visible (same contract as log tags).
 * - After lowering min count, `pruneSqlPatternHiddenForCurrentKeys` drops hidden state for chip keys that no longer
 *   exist so stale object keys cannot confuse the UI.
 *
 * Integration: `viewer-data-add.ts` → `registerSqlPattern`; `viewer-data.ts` `trimData` → `unregisterSqlPattern` +
 * `finalizeSqlPatternState`; `viewer-data-helpers-core.ts` → `sqlPatternFiltered` in `calcItemHeight`; clear →
 * `resetSqlPatternTags`. Session SQL query history (DB_11) wraps `finalizeSqlPatternState` / `resetSqlPatternTags`
 * in `viewer-sql-query-history-core.ts` and records per-line via `recordSqlQueryHistoryForAppendedItem` in add/db paths.
 */

/** @param chipMinCount - Clamped 1–50; default 2. @param chipMaxChips - Clamped 1–100; default 20. */
export function getSqlPatternTagsScript(chipMinCount = 2, chipMaxChips = 20): string {
    const mc = Math.max(1, Math.min(50, Math.floor(Number.isFinite(chipMinCount) ? chipMinCount : 2)));
    const mx = Math.max(1, Math.min(100, Math.floor(Number.isFinite(chipMaxChips) ? chipMaxChips : 20)));
    return /* javascript */ `
var sqlPatternRawCounts = {};
var hiddenSqlPatterns = {};
var sqlOtherKey = '__other_sql__';
var sqlChipMinCount = ${mc};
var sqlPatternShowAll = false;
var sqlPatternMaxChips = ${mx};

function shouldTrackSqlPatternLine(item) {
    if (!item || item.type === 'marker') return false;
    if (item.sourceTag !== 'database') return false;
    return item.type === 'line' || item.type === 'repeat-notification' || item.type === 'n-plus-one-insight';
}

function promoteSqlFingerprintChip(fp) {
    var i, it;
    for (i = 0; i < allLines.length; i++) {
        it = allLines[i];
        if (!shouldTrackSqlPatternLine(it)) continue;
        if (it.dbInsight && it.dbInsight.fingerprint === fp) it.sqlPatternChipKey = fp;
    }
}

function demoteSqlFingerprintChip(fp) {
    var i, it;
    for (i = 0; i < allLines.length; i++) {
        it = allLines[i];
        if (!shouldTrackSqlPatternLine(it)) continue;
        if (it.dbInsight && it.dbInsight.fingerprint === fp) it.sqlPatternChipKey = sqlOtherKey;
    }
}

function sqlPatternRowHidden(item) {
    if (!item.sqlPatternChipKey) return false;
    if (!hiddenSqlPatterns || Object.keys(hiddenSqlPatterns).length === 0) return false;
    return !!hiddenSqlPatterns[item.sqlPatternChipKey];
}

/* Recompute sqlPatternFiltered on every line (no layout pass). */
function refreshSqlPatternFilteredFlags() {
    var i, it;
    for (i = 0; i < allLines.length; i++) {
        it = allLines[i];
        if (!shouldTrackSqlPatternLine(it)) {
            it.sqlPatternFiltered = false;
            continue;
        }
        it.sqlPatternFiltered = sqlPatternRowHidden(it);
    }
}

/**
 * User-driven or batch trim: preserve scroll via recalcAndRender when available.
 */
function applySqlPatternFilter() {
    refreshSqlPatternFilteredFlags();
    if (typeof recalcAndRender === 'function') { recalcAndRender(); }
    else { recalcHeights(); renderViewport(true); }
}

/**
 * Streaming ingest: same flag logic as applySqlPatternFilter but skip scroll anchoring (addLines is often at tail).
 */
function applySqlPatternFilterForNewLine() {
    refreshSqlPatternFilteredFlags();
    if (typeof recalcHeights === 'function') recalcHeights();
    if (typeof renderViewport === 'function') renderViewport(false);
}

function registerSqlPattern(item) {
    if (!shouldTrackSqlPatternLine(item)) return;
    var fp = item.dbInsight && item.dbInsight.fingerprint;
    if (!fp) {
        item.sqlPatternChipKey = sqlOtherKey;
    } else {
        var prev = sqlPatternRawCounts[fp] || 0;
        var c = prev + 1;
        sqlPatternRawCounts[fp] = c;
        if (c >= sqlChipMinCount) {
            if (prev < sqlChipMinCount) promoteSqlFingerprintChip(fp);
            item.sqlPatternChipKey = fp;
        } else {
            item.sqlPatternChipKey = sqlOtherKey;
        }
    }
    applySqlPatternFilterForNewLine();
    updateSqlPatternSummary();
    rebuildSqlPatternChips();
}

function unregisterSqlPattern(item) {
    if (!shouldTrackSqlPatternLine(item)) return;
    var fp = item.dbInsight && item.dbInsight.fingerprint;
    if (fp) {
        var c = (sqlPatternRawCounts[fp] || 0) - 1;
        if (c <= 0) delete sqlPatternRawCounts[fp];
        else sqlPatternRawCounts[fp] = c;
        if (c < sqlChipMinCount) demoteSqlFingerprintChip(fp);
    }
}

/** After bulk line removal (trimData): one recalc + chip refresh (avoids O(trim) full rerenders). */
function finalizeSqlPatternState() {
    applySqlPatternFilter();
    updateSqlPatternSummary();
    rebuildSqlPatternChips();
}

function countSqlPatternLinesByKey() {
    var m = {};
    var i, it, k;
    for (i = 0; i < allLines.length; i++) {
        it = allLines[i];
        if (!shouldTrackSqlPatternLine(it) || !it.sqlPatternChipKey) continue;
        k = it.sqlPatternChipKey;
        m[k] = (m[k] || 0) + 1;
    }
    return m;
}

function getSqlPatternChipKeys() {
    var lineCounts = countSqlPatternLinesByKey();
    var keys = [];
    var fp;
    for (fp in sqlPatternRawCounts) {
        if (sqlPatternRawCounts[fp] >= sqlChipMinCount && lineCounts[fp]) keys.push(fp);
    }
    if (lineCounts[sqlOtherKey]) keys.push(sqlOtherKey);
    keys.sort(function(a, b) { return (lineCounts[b] || 0) - (lineCounts[a] || 0); });
    return keys;
}

/** Drop hidden entries for chip keys that no longer exist (e.g. after raising min count). */
function pruneSqlPatternHiddenForCurrentKeys() {
    var keys = getSqlPatternChipKeys();
    var keep = {};
    var i, k;
    for (i = 0; i < keys.length; i++) {
        k = keys[i];
        if (hiddenSqlPatterns[k]) keep[k] = true;
    }
    hiddenSqlPatterns = keep;
}

/**
 * Host message: apply settings without reload; re-promotes/demotes fingerprints and refreshes layout.
 */
function applyViewerSqlPatternChipSettings(minCount, maxChips) {
    var mc = typeof minCount === 'number' ? minCount : parseInt(minCount, 10);
    var mx = typeof maxChips === 'number' ? maxChips : parseInt(maxChips, 10);
    if (!isFinite(mc)) mc = 2;
    if (!isFinite(mx)) mx = 20;
    mc = Math.max(1, Math.min(50, Math.floor(mc)));
    mx = Math.max(1, Math.min(100, Math.floor(mx)));
    sqlChipMinCount = mc;
    sqlPatternMaxChips = mx;
    var fp;
    for (fp in sqlPatternRawCounts) {
        if (!Object.prototype.hasOwnProperty.call(sqlPatternRawCounts, fp)) continue;
        var c = sqlPatternRawCounts[fp];
        if (c >= sqlChipMinCount) promoteSqlFingerprintChip(fp);
        else demoteSqlFingerprintChip(fp);
    }
    pruneSqlPatternHiddenForCurrentKeys();
    hiddenSqlPatterns = ensureAtLeastOneTagVisible(hiddenSqlPatterns, countSqlPatternLinesByKey());
    applySqlPatternFilter();
    rebuildSqlPatternChips();
    if (typeof markPresetDirty === 'function') markPresetDirty();
}

function formatSqlPatternChipLabel(key) {
    if (key === sqlOtherKey) return 'Other SQL';
    var max = 44;
    if (key.length <= max) return key;
    return key.substring(0, max - 1) + '\\u2026';
}

function toggleSqlPattern(key) {
    if (hiddenSqlPatterns[key]) delete hiddenSqlPatterns[key];
    else hiddenSqlPatterns[key] = true;
    hiddenSqlPatterns = ensureAtLeastOneTagVisible(hiddenSqlPatterns, countSqlPatternLinesByKey());
    applySqlPatternFilter();
    rebuildSqlPatternChips();
    if (typeof markPresetDirty === 'function') markPresetDirty();
}

function selectAllSqlPatterns() {
    hiddenSqlPatterns = {};
    applySqlPatternFilter();
    rebuildSqlPatternChips();
}

function deselectAllSqlPatterns() {
    var keys = getSqlPatternChipKeys();
    var i;
    for (i = 0; i < keys.length; i++) hiddenSqlPatterns[keys[i]] = true;
    applySqlPatternFilter();
    rebuildSqlPatternChips();
}

function rebuildSqlPatternChips() {
    var container = document.getElementById('sql-pattern-chips');
    if (!container) return;
    var esc = (typeof escapeTagHtml === 'function') ? escapeTagHtml : escapeHtml;
    var chipKeys = getSqlPatternChipKeys();
    var lineCounts = countSqlPatternLinesByKey();
    chipKeys.sort(function(a, b) { return (lineCounts[b] || 0) - (lineCounts[a] || 0); });
    var limit = sqlPatternShowAll ? chipKeys.length : Math.min(chipKeys.length, sqlPatternMaxChips);
    var parts = [];
    if (chipKeys.length > 0) {
        parts.push('<span class="source-tag-actions">'
            + '<button class="tag-action-btn" data-sqlaction="all">All</button>'
            + '<button class="tag-action-btn" data-sqlaction="none">None</button></span>');
    }
    var j, key, active, cls, label, cnt;
    for (j = 0; j < limit; j++) {
        key = chipKeys[j];
        label = formatSqlPatternChipLabel(key);
        active = !hiddenSqlPatterns[key];
        cls = 'source-tag-chip sql-pattern-chip' + (active ? ' active' : '');
        cnt = lineCounts[key] || 0;
        parts.push('<button type="button" class="' + cls + '" data-sqlpattern="' + esc(key) + '" title="' + esc(key) + '">'
            + '<span class="tag-label">' + esc(label) + '</span>'
            + '<span class="tag-count">' + cnt + '</span></button>');
    }
    if (chipKeys.length > sqlPatternMaxChips) {
        var showLabel = sqlPatternShowAll ? 'Show less' : 'Show all (' + chipKeys.length + ')';
        parts.push('<button type="button" class="tag-show-all-btn" data-sqlaction="toggle-all">' + showLabel + '</button>');
    }
    container.innerHTML = parts.join('');
    updateSqlPatternSummary();
}

function updateSqlPatternSummary() {
    var el = document.getElementById('sql-pattern-summary');
    if (!el) return;
    var chipKeys = getSqlPatternChipKeys();
    var total = chipKeys.length;
    var hidden = 0;
    var hi, hk;
    for (hi = 0; hi < chipKeys.length; hi++) {
        hk = chipKeys[hi];
        if (hiddenSqlPatterns[hk]) hidden++;
    }
    el.textContent = total + ' pattern' + (total !== 1 ? 's' : '')
        + (hidden > 0 ? ' (' + hidden + ' hidden)' : '');
    var section = document.getElementById('sql-patterns-section');
    if (section) section.style.display = total > 0 ? '' : 'none';
}

(function() {
    var chipsEl = document.getElementById('sql-pattern-chips');
    if (!chipsEl) return;
    chipsEl.addEventListener('click', function(e) {
        var chip = e.target.closest('[data-sqlpattern]');
        if (chip && chip.dataset.sqlpattern) { toggleSqlPattern(chip.dataset.sqlpattern); return; }
        var btn = e.target.closest('[data-sqlaction]');
        if (!btn) return;
        if (btn.dataset.sqlaction === 'all') selectAllSqlPatterns();
        else if (btn.dataset.sqlaction === 'none') deselectAllSqlPatterns();
        else if (btn.dataset.sqlaction === 'toggle-all') { sqlPatternShowAll = !sqlPatternShowAll; rebuildSqlPatternChips(); }
    });
})();

function resetSqlPatternTags() {
    sqlPatternRawCounts = {};
    hiddenSqlPatterns = {};
    sqlPatternShowAll = false;
    var section = document.getElementById('sql-patterns-section');
    if (section) section.style.display = 'none';
    var container = document.getElementById('sql-pattern-chips');
    if (container) container.innerHTML = '';
    var sum = document.getElementById('sql-pattern-summary');
    if (sum) sum.textContent = '';
}
`;
}

/**
 * SQL command-type chips for database (Drift) log lines in the filters panel (plan 043).
 *
 * Replaces the old fingerprint-based chip system (DB_02, DB_05) with simple verb-category
 * chips: SELECT, INSERT, UPDATE, DELETE, Transaction, Other SQL.
 *
 * ## Developer guide (extension host ↔ webview)
 * - **Build time:** `getSqlPatternTagsScript()` embeds the verb chip logic (no runtime settings).
 * - **No runtime settings message** — verb categories are fixed; no need for chipMinCount / chipMaxChips.
 *
 * ## Behavior
 * - **Chip key** = verb category string (e.g. `'SELECT'`, `'Transaction'`, `'Other SQL'`).
 * - `parseSqlFingerprint().verb` is mapped to a category by `sqlVerbCategory()`.
 * - Lines with `sourceTag === 'database'` but no parseable verb go to **`Other SQL`**.
 * - Lines counted: `line`, `repeat-notification`, and `n-plus-one-signal` with `sourceTag === 'database'`.
 *
 * ## Performance
 * - **`registerSqlPattern`** (hot path during streaming): O(1) per line — just increment verb count.
 *   No promote/demote scan needed (all categories always have chips).
 * - **`trimData`**: `unregisterSqlPattern` is O(1) per removed row; **`finalizeSqlPatternState`** runs
 *   once after the trim batch with full **`applySqlPatternFilter`** (anchored).
 *
 * Integration: `viewer-data-add.ts` → `registerSqlPattern`; `viewer-data.ts` `trimData` → `unregisterSqlPattern` +
 * `finalizeSqlPatternState`; `viewer-data-helpers-core.ts` → `sqlPatternFiltered` in `calcItemHeight`; clear →
 * `resetSqlPatternTags`. Session SQL query history (DB_11) wraps `finalizeSqlPatternState` / `resetSqlPatternTags`
 * in `viewer-sql-query-history-core.ts` and records per-line via `recordSqlQueryHistoryForAppendedItem` in add/db paths.
 */

export function getSqlPatternTagsScript(): string {
    return /* javascript */ `
var sqlVerbCounts = {};
var hiddenSqlVerbs = {};
var sqlVerbOrder = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'Transaction', 'Other SQL'];

/** Map raw Drift SQL verb to a chip category. */
function sqlVerbCategory(verb) {
    if (!verb) return 'Other SQL';
    var v = verb.toUpperCase();
    if (v === 'SELECT' || v === 'WITH') return 'SELECT';
    if (v === 'INSERT') return 'INSERT';
    if (v === 'UPDATE') return 'UPDATE';
    if (v === 'DELETE') return 'DELETE';
    if (v === 'BEGIN' || v === 'COMMIT' || v === 'ROLLBACK') return 'Transaction';
    return 'Other SQL';
}

function shouldTrackSqlPatternLine(item) {
    if (!item || item.type === 'marker') return false;
    if (item.sourceTag !== 'database') return false;
    return item.type === 'line' || item.type === 'repeat-notification' || item.type === 'n-plus-one-signal';
}

function sqlPatternRowHidden(item) {
    if (!item.sqlPatternChipKey) return false;
    if (!hiddenSqlVerbs || Object.keys(hiddenSqlVerbs).length === 0) return false;
    return !!hiddenSqlVerbs[item.sqlPatternChipKey];
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
    var cat = sqlVerbCategory(item.sqlVerb);
    item.sqlPatternChipKey = cat;
    sqlVerbCounts[cat] = (sqlVerbCounts[cat] || 0) + 1;
    applySqlPatternFilterForNewLine();
    updateSqlPatternSummary();
    rebuildSqlPatternChips();
}

function unregisterSqlPattern(item) {
    if (!shouldTrackSqlPatternLine(item)) return;
    var cat = item.sqlPatternChipKey;
    if (cat) {
        var c = (sqlVerbCounts[cat] || 0) - 1;
        if (c <= 0) delete sqlVerbCounts[cat];
        else sqlVerbCounts[cat] = c;
    }
}

/** After bulk line removal (trimData): one recalc + chip refresh (avoids O(trim) full rerenders). */
function finalizeSqlPatternState() {
    applySqlPatternFilter();
    updateSqlPatternSummary();
    rebuildSqlPatternChips();
}

function countSqlVerbLinesByKey() {
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

function getActiveVerbKeys() {
    var lineCounts = countSqlVerbLinesByKey();
    var keys = [];
    var i, k;
    for (i = 0; i < sqlVerbOrder.length; i++) {
        k = sqlVerbOrder[i];
        if (lineCounts[k]) keys.push(k);
    }
    return keys;
}

function toggleSqlPattern(key) {
    if (hiddenSqlVerbs[key]) delete hiddenSqlVerbs[key];
    else hiddenSqlVerbs[key] = true;
    hiddenSqlVerbs = ensureAtLeastOneTagVisible(hiddenSqlVerbs, countSqlVerbLinesByKey());
    applySqlPatternFilter();
    rebuildSqlPatternChips();
    if (typeof markPresetDirty === 'function') markPresetDirty();
}

function selectAllSqlPatterns() {
    hiddenSqlVerbs = {};
    applySqlPatternFilter();
    rebuildSqlPatternChips();
}

function deselectAllSqlPatterns() {
    var keys = getActiveVerbKeys();
    var i;
    for (i = 0; i < keys.length; i++) hiddenSqlVerbs[keys[i]] = true;
    applySqlPatternFilter();
    rebuildSqlPatternChips();
}

function rebuildSqlPatternChips() {
    var container = document.getElementById('sql-pattern-chips');
    if (!container) return;
    var esc = (typeof escapeTagHtml === 'function') ? escapeTagHtml : escapeHtml;
    var chipKeys = getActiveVerbKeys();
    var lineCounts = countSqlVerbLinesByKey();
    var parts = [];
    if (chipKeys.length > 0) {
        parts.push('<span class="source-tag-actions">'
            + '<button class="tag-action-btn" data-sqlaction="all">All</button>'
            + '<button class="tag-action-btn" data-sqlaction="none">None</button></span>');
    }
    var j, key, active, cls, cnt;
    for (j = 0; j < chipKeys.length; j++) {
        key = chipKeys[j];
        active = !hiddenSqlVerbs[key];
        cls = 'source-tag-chip sql-pattern-chip' + (active ? ' active' : '');
        cnt = lineCounts[key] || 0;
        parts.push('<button type="button" class="' + cls + '" data-sqlpattern="' + esc(key) + '" title="' + esc(key) + '">'
            + '<span class="tag-label">' + esc(key) + '</span>'
            + '<span class="tag-count">' + cnt + '</span></button>');
    }
    container.innerHTML = parts.join('');
    updateSqlPatternSummary();
}

function updateSqlPatternSummary() {
    var el = document.getElementById('sql-pattern-summary');
    if (!el) return;
    var chipKeys = getActiveVerbKeys();
    var total = chipKeys.length;
    var hidden = 0;
    var hi, hk;
    for (hi = 0; hi < chipKeys.length; hi++) {
        hk = chipKeys[hi];
        if (hiddenSqlVerbs[hk]) hidden++;
    }
    var summary = total + ' command type' + (total !== 1 ? 's' : '')
        + (hidden > 0 ? ' (' + hidden + ' hidden)' : '');
    el.textContent = summary;
    /* Accordion header shows concise count: "2 of 6 hidden" or total */
    var accordionText = hidden > 0
        ? hidden + ' of ' + total + ' hidden'
        : total + ' type' + (total !== 1 ? 's' : '');
    if (typeof setAccordionSummary === 'function') setAccordionSummary('sql-patterns-section', accordionText);
    /* Show/hide the tab button based on whether SQL patterns exist */
    var tab = document.getElementById('filter-tab-sql-patterns');
    if (tab) { tab.style.display = total > 0 ? '' : 'none'; }
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
    });
})();

function resetSqlPatternTags() {
    sqlVerbCounts = {};
    hiddenSqlVerbs = {};
    /* Hide the tab button when SQL patterns are cleared */
    var tab = document.getElementById('filter-tab-sql-patterns');
    if (tab) tab.style.display = 'none';
    var container = document.getElementById('sql-pattern-chips');
    if (container) container.innerHTML = '';
    var sum = document.getElementById('sql-pattern-summary');
    if (sum) sum.textContent = '';
}
`;
}

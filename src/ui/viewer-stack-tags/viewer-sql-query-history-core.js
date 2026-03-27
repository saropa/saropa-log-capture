"use strict";
/**
 * Session-scoped SQL fingerprint rollup for the query history panel (plan DB_11).
 *
 * Loaded after `viewer-sql-pattern-tags.ts` so we can wrap `finalizeSqlPatternState` and
 * `resetSqlPatternTags`. Ingest hooks call `recordSqlQueryHistoryForAppendedItem` from
 * `viewer-data-add.ts` / DB detectors once `allLines` has been updated.
 *
 * Caps distinct fingerprints (LRU by lastSeen). Stores preview + line refs + aggregates only.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SQL_QUERY_HISTORY_MAX_FP = void 0;
exports.getSqlQueryHistoryRuntimeScript = getSqlQueryHistoryRuntimeScript;
exports.getSqlQueryHistoryCoreScript = getSqlQueryHistoryCoreScript;
/** Max distinct fingerprints kept in the session index (LRU eviction by last-seen). */
exports.SQL_QUERY_HISTORY_MAX_FP = 500;
/**
 * Runtime only (no lifecycle wrap). Used by the webview and by VM-based unit tests.
 * @param maxFp - Override cap (tests only); production uses {@link SQL_QUERY_HISTORY_MAX_FP}.
 */
function getSqlQueryHistoryRuntimeScript(maxFp = exports.SQL_QUERY_HISTORY_MAX_FP) {
    const cap = Math.max(1, Math.floor(maxFp));
    return /* javascript */ `
var sqlQueryHistoryByFp = {};
var SQL_QUERY_HISTORY_MAX_FP = ${cap};

function truncateSqlHistoryPreviewString(s) {
    var raw = String(s || '');
    var max = 120;
    if (raw.length <= max) return raw;
    return raw.substring(0, max - 3) + '...';
}

function extractSqlHistoryFingerprint(it) {
    if (!it || it.sourceTag !== 'database') return null;
    if (it.type !== 'line' && it.type !== 'repeat-notification' && it.type !== 'n-plus-one-insight') return null;
    if (it.dbInsight && it.dbInsight.fingerprint) return it.dbInsight.fingerprint;
    if (it.sqlHistoryFp) return it.sqlHistoryFp;
    if (it.insightMeta && it.insightMeta.fingerprint) return it.insightMeta.fingerprint;
    return null;
}

function extractSqlHistoryPreview(it, fp) {
    var raw = '';
    if (it.dbInsight && it.dbInsight.sqlSnippet) raw = it.dbInsight.sqlSnippet;
    else if (it.sqlHistoryPreview) raw = it.sqlHistoryPreview;
    else raw = fp || '';
    return truncateSqlHistoryPreviewString(raw);
}

function extractSqlHistorySampleSql(it) {
    if (!it) return '';
    if (it.dbInsight && it.dbInsight.sqlSnippet) return String(it.dbInsight.sqlSnippet).trim();
    if (it.sqlRepeatDrilldown && it.sqlRepeatDrilldown.sqlSnippet) {
        return String(it.sqlRepeatDrilldown.sqlSnippet).trim();
    }
    return '';
}

function evictOneSqlQueryHistoryLru() {
    var keys = Object.keys(sqlQueryHistoryByFp);
    if (keys.length === 0) return;
    var bestK = keys[0];
    var bestTs = sqlQueryHistoryByFp[bestK].lastSeen || 0;
    var i, k, t;
    for (i = 1; i < keys.length; i++) {
        k = keys[i];
        t = sqlQueryHistoryByFp[k].lastSeen || 0;
        if (t < bestTs) { bestTs = t; bestK = k; }
    }
    delete sqlQueryHistoryByFp[bestK];
}

function evictSqlQueryHistoryToCap() {
    while (Object.keys(sqlQueryHistoryByFp).length > SQL_QUERY_HISTORY_MAX_FP) {
        evictOneSqlQueryHistoryLru();
    }
}

function recordSqlQueryHistoryObservationMerge(fp, lineIdx, ts, preview, dur, sampleSql) {
    var prev = sqlQueryHistoryByFp[fp];
    var previewT = truncateSqlHistoryPreviewString(preview);
    var sampleT = (sampleSql && String(sampleSql).trim()) || '';
    if (!prev) {
        sqlQueryHistoryByFp[fp] = {
            count: 1,
            firstIdx: lineIdx,
            lastIdx: lineIdx,
            lastSeen: ts,
            preview: previewT,
            maxDur: dur,
            sampleSql: sampleT || undefined
        };
        return;
    }
    prev.count++;
    if (lineIdx < prev.firstIdx) prev.firstIdx = lineIdx;
    if (lineIdx > prev.lastIdx) prev.lastIdx = lineIdx;
    if (ts > prev.lastSeen) prev.lastSeen = ts;
    if (!prev.preview && previewT) prev.preview = previewT;
    if (!prev.sampleSql && sampleT) prev.sampleSql = sampleT;
    if (typeof dur === 'number' && isFinite(dur) && dur >= 0) {
        if (prev.maxDur === undefined || dur > prev.maxDur) prev.maxDur = dur;
    }
}

function recordSqlQueryHistoryObservation(fp, lineIdx, ts, preview, dur, sampleSql) {
    if (!fp || typeof fp !== 'string') return;
    if (!sqlQueryHistoryByFp[fp] && Object.keys(sqlQueryHistoryByFp).length >= SQL_QUERY_HISTORY_MAX_FP) {
        evictOneSqlQueryHistoryLru();
    }
    recordSqlQueryHistoryObservationMerge(fp, lineIdx, ts, preview, dur, sampleSql);
}

function recordSqlQueryHistoryForAppendedItem(item) {
    var idx = allLines.length - 1;
    if (!item || idx < 0) return;
    var fp = extractSqlHistoryFingerprint(item);
    if (!fp) return;
    var preview = extractSqlHistoryPreview(item, fp);
    var sampleSql = extractSqlHistorySampleSql(item);
    var dur = (typeof item.elapsedMs === 'number' && isFinite(item.elapsedMs) && item.elapsedMs >= 0) ? item.elapsedMs : undefined;
    var ts = (typeof item.timestamp === 'number' && isFinite(item.timestamp)) ? item.timestamp : Date.now();
    recordSqlQueryHistoryObservation(fp, idx, ts, preview, dur, sampleSql);
}

function rebuildSqlQueryHistoryFromAllLines() {
    sqlQueryHistoryByFp = {};
    var i, it, fp, preview, dur, ts;
    for (i = 0; i < allLines.length; i++) {
        it = allLines[i];
        fp = extractSqlHistoryFingerprint(it);
        if (!fp) continue;
        preview = extractSqlHistoryPreview(it, fp);
        dur = (typeof it.elapsedMs === 'number' && isFinite(it.elapsedMs) && it.elapsedMs >= 0) ? it.elapsedMs : undefined;
        ts = (typeof it.timestamp === 'number' && isFinite(it.timestamp)) ? it.timestamp : 0;
        recordSqlQueryHistoryObservationMerge(fp, i, ts, preview, dur, extractSqlHistorySampleSql(it));
    }
    evictSqlQueryHistoryToCap();
}

function resetSqlQueryHistory() {
    sqlQueryHistoryByFp = {};
}

function sqlHistoryTargetLineLikelyHidden(idx) {
    var it = allLines[idx];
    if (!it) return true;
    return (typeof calcItemHeight === 'function') ? calcItemHeight(it) <= 0 : (it.height <= 0);
}
`;
}
function getSqlQueryHistoryLifecycleWrapScript() {
    return /* javascript */ `
(function wrapSqlPatternLifecycleForQueryHistory() {
    var prevFinalize = typeof finalizeSqlPatternState === 'function' ? finalizeSqlPatternState : null;
    finalizeSqlPatternState = function() {
        if (prevFinalize) prevFinalize();
        rebuildSqlQueryHistoryFromAllLines();
        if (typeof refreshSqlQueryHistoryPanelIfOpen === 'function') refreshSqlQueryHistoryPanelIfOpen();
    };
    var prevReset = typeof resetSqlPatternTags === 'function' ? resetSqlPatternTags : null;
    resetSqlPatternTags = function() {
        if (prevReset) prevReset();
        resetSqlQueryHistory();
        if (typeof refreshSqlQueryHistoryPanelIfOpen === 'function') refreshSqlQueryHistoryPanelIfOpen();
    };
})();
`;
}
/** Full webview chunk: runtime + lifecycle hooks into SQL pattern tags. */
function getSqlQueryHistoryCoreScript() {
    return getSqlQueryHistoryRuntimeScript() + getSqlQueryHistoryLifecycleWrapScript();
}
//# sourceMappingURL=viewer-sql-query-history-core.js.map
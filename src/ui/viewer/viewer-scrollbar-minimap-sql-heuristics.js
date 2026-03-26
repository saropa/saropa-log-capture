"use strict";
/**
 * Minimap SQL density — shared heuristics for the webview minimap overlay.
 *
 * **Single source of truth:** `viewer-scrollbar-minimap-sql.ts` embeds these `RegExp`
 * instances via `.toString()` into the injected script. If you change patterns here,
 * density detection in the live viewer updates automatically; keep the surrounding
 * `isLikelySqlLine` / `isLikelySlowSqlLine` JS in that file aligned (same field names:
 * `sourceTag`, `level`).
 *
 * **Rationale:** Heuristics are intentionally shallow (keyword + tag + performance level)
 * to stay fast inside `paintMinimap` hot paths; unit tests lock down false positives.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MINIMAP_SLOW_SQL_TEXT_RE = exports.MINIMAP_SQL_KEYWORD_RE = void 0;
exports.minimapSqlDensityBucketIndex = minimapSqlDensityBucketIndex;
exports.isMinimapSqlDensityLine = isMinimapSqlDensityLine;
exports.isMinimapSlowSqlDensityLine = isMinimapSlowSqlDensityLine;
/** SQL-ish tokens in log plain text (case-insensitive). */
exports.MINIMAP_SQL_KEYWORD_RE = /\b(SELECT|INSERT|UPDATE|DELETE|WITH|PRAGMA|BEGIN|COMMIT|ROLLBACK)\b/i;
/** Slow-SQL hint in plain text after the line is already classified as SQL. */
exports.MINIMAP_SLOW_SQL_TEXT_RE = /\bslow\b.*\b(query|sql)\b/i;
/** Map a minimap Y pixel into a density bucket (matches injected `paintMinimap` math). */
function minimapSqlDensityBucketIndex(py, mmH, densityBucketCount) {
    return Math.min(densityBucketCount - 1, Math.max(0, Math.floor((py / Math.max(1, mmH)) * densityBucketCount)));
}
/** True when this line should contribute to SQL density buckets. */
function isMinimapSqlDensityLine(sourceTag, plain) {
    if (sourceTag === 'database') {
        return true;
    }
    return exports.MINIMAP_SQL_KEYWORD_RE.test(plain || '');
}
/**
 * True when this line should contribute to the slow-SQL density channel.
 * Requires SQL classification first; then performance level or slow+query/sql text.
 */
function isMinimapSlowSqlDensityLine(level, plain, sourceTag) {
    if (!isMinimapSqlDensityLine(sourceTag, plain)) {
        return false;
    }
    if (level === 'performance') {
        return true;
    }
    return exports.MINIMAP_SLOW_SQL_TEXT_RE.test(plain || '');
}
//# sourceMappingURL=viewer-scrollbar-minimap-sql-heuristics.js.map
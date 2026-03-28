"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getScrollbarMinimapSqlScript = getScrollbarMinimapSqlScript;
/**
 * SQL density helpers for scrollbar minimap overlays (injected webview script).
 *
 * Embeds `RegExp` literals from `viewer-scrollbar-minimap-sql-heuristics.ts` so runtime
 * behavior and Node unit tests cannot drift.
 *
 * **Rendering model (log viewer webview only — not the VS Code editor minimap):**
 * SQL/slow-SQL activity is painted as **full-width** vertical bands in scroll space, then severity and
 * search ticks draw on top. Older builds used a right-rail-only strip, which read as “half missing.”
 */
const viewer_scrollbar_minimap_sql_heuristics_1 = require("./viewer-scrollbar-minimap-sql-heuristics");
function getScrollbarMinimapSqlScript() {
    return /* javascript */ `
var mmSqlKeywordPattern = ${viewer_scrollbar_minimap_sql_heuristics_1.MINIMAP_SQL_KEYWORD_RE.toString()};
var mmSlowSqlTextPattern = ${viewer_scrollbar_minimap_sql_heuristics_1.MINIMAP_SLOW_SQL_TEXT_RE.toString()};
function isLikelySqlLine(it, plain) {
    if (!it) return false;
    if (it.sourceTag === 'database') return true;
    return mmSqlKeywordPattern.test(plain || '');
}

function isLikelySlowSqlLine(it, plain) {
    if (!isLikelySqlLine(it, plain)) return false;
    if (it.level === 'performance') return true;
    return mmSlowSqlTextPattern.test(plain || '');
}

/** Full-width vertical bands: SQL activity (blue) and slow SQL (orange). Severity/search draw on top. */
function paintSqlDensityBuckets(sqlBuckets, slowSqlBuckets, mmW, mmH) {
    var i;
    var maxSql = 0;
    var maxSlow = 0;
    for (i = 0; i < sqlBuckets.length; i++) {
        if (sqlBuckets[i] > maxSql) maxSql = sqlBuckets[i];
        if (slowSqlBuckets[i] > maxSlow) maxSlow = slowSqlBuckets[i];
    }
    if (maxSql <= 0 && maxSlow <= 0) return;
    var bucketH = Math.max(1, Math.ceil(mmH / sqlBuckets.length));
    for (i = 0; i < sqlBuckets.length; i++) {
        var y = Math.floor((i / sqlBuckets.length) * mmH);
        var sqlAlpha = maxSql > 0 ? (sqlBuckets[i] / maxSql) : 0;
        if (sqlAlpha > 0) {
            mmCtx.fillStyle = mmColors.sqlDensity;
            /* Slightly softer than the old right-rail-only strip — same strip is now full width. */
            mmCtx.globalAlpha = 0.05 + (0.12 * sqlAlpha);
            mmCtx.fillRect(0, y, mmW, bucketH);
        }
        var slowAlpha = maxSlow > 0 ? (slowSqlBuckets[i] / maxSlow) : 0;
        if (slowAlpha > 0) {
            mmCtx.fillStyle = mmColors.sqlSlowDensity;
            mmCtx.globalAlpha = 0.06 + (0.18 * slowAlpha);
            mmCtx.fillRect(0, y, mmW, bucketH);
        }
    }
    mmCtx.globalAlpha = 1;
}
`;
}
//# sourceMappingURL=viewer-scrollbar-minimap-sql.js.map
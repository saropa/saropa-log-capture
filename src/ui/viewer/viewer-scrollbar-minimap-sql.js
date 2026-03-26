"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getScrollbarMinimapSqlScript = getScrollbarMinimapSqlScript;
/**
 * SQL density helpers for scrollbar minimap overlays (injected webview script).
 *
 * Embeds `RegExp` literals from `viewer-scrollbar-minimap-sql-heuristics.ts` so runtime
 * behavior and Node unit tests cannot drift.
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

/** Render subtle right-side SQL density bands by vertical bucket. */
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
    var x = Math.max(0, mmW - Math.max(6, Math.floor(mmW * 0.42)));
    var w = mmW - x;
    for (i = 0; i < sqlBuckets.length; i++) {
        var y = Math.floor((i / sqlBuckets.length) * mmH);
        var sqlAlpha = maxSql > 0 ? (sqlBuckets[i] / maxSql) : 0;
        if (sqlAlpha > 0) {
            mmCtx.fillStyle = mmColors.sqlDensity;
            mmCtx.globalAlpha = 0.07 + (0.18 * sqlAlpha);
            mmCtx.fillRect(x, y, w, bucketH);
        }
        var slowAlpha = maxSlow > 0 ? (slowSqlBuckets[i] / maxSlow) : 0;
        if (slowAlpha > 0) {
            mmCtx.fillStyle = mmColors.sqlSlowDensity;
            mmCtx.globalAlpha = 0.08 + (0.26 * slowAlpha);
            mmCtx.fillRect(x, y, w, bucketH);
        }
    }
    mmCtx.globalAlpha = 1;
}
`;
}
//# sourceMappingURL=viewer-scrollbar-minimap-sql.js.map
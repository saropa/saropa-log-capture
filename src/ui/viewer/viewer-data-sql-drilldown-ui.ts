/**
 * SQL repeat drilldown UI helpers for the viewer webview (DB_06).
 *
 * Contains constants, accumulator helpers, snapshot creation,
 * HTML rendering, and toggle logic for the collapsible SQL repeat
 * drilldown panel. Extracted from viewer-data-helpers-core.ts.
 *
 * All functions here are `function` declarations (hoisted) and
 * reference globals from the same `<script>` tag: `repeatTracker`,
 * `escapeHtml`, `allLines`, `recalcHeights`, `renderViewport`,
 * `formatRunTime`, `staticSqlFromFingerprintEnabled`, `ROW_HEIGHT`.
 */
export function getSqlDrilldownUiScript(): string {
    return /* javascript */ `
var SQL_REPEAT_DRILLDOWN_MAX_SAMPLES = 10;
var SQL_REPEAT_SNIPPET_STORE_CAP = 500;
var SQL_REPEAT_ARG_KEY_CAP = 220;
function resetSqlStreakVariantAccumulators() {
    repeatTracker.sqlStreakVariantOrder = [];
    repeatTracker.sqlStreakVariantCounts = Object.create(null);
}
function bumpSqlStreakVariant(argsKey) {
    if (!repeatTracker.sqlStreakVariantCounts) repeatTracker.sqlStreakVariantCounts = Object.create(null);
    var ak = argsKey != null && argsKey !== '' ? String(argsKey) : '[]';
    if (!repeatTracker.sqlStreakVariantCounts[ak]) {
        repeatTracker.sqlStreakVariantCounts[ak] = 0;
        repeatTracker.sqlStreakVariantOrder.push(ak);
    }
    repeatTracker.sqlStreakVariantCounts[ak]++;
}
function capSqlSnippetForDrilldown(s) {
    var t = s != null ? String(s) : '';
    if (t.length <= SQL_REPEAT_SNIPPET_STORE_CAP) return t;
    return t.substring(0, SQL_REPEAT_SNIPPET_STORE_CAP - 3) + '...';
}
function capArgKeyForDrilldown(s) {
    var t = s != null ? String(s) : '[]';
    if (t.length <= SQL_REPEAT_ARG_KEY_CAP) return t;
    return t.substring(0, SQL_REPEAT_ARG_KEY_CAP - 3) + '...';
}
/** Immutable snapshot for one emitted SQL repeat-notification row (DB_06). */
function snapshotSqlRepeatDrilldown(ts) {
    var order = repeatTracker.sqlStreakVariantOrder || [];
    var counts = repeatTracker.sqlStreakVariantCounts || {};
    var variants = [];
    var i;
    for (i = 0; i < order.length && variants.length < SQL_REPEAT_DRILLDOWN_MAX_SAMPLES; i++) {
        var rawAk = order[i];
        variants.push({ argsKey: capArgKeyForDrilldown(rawAk), count: counts[rawAk] || 0 });
    }
    var moreVariantCount = order.length > SQL_REPEAT_DRILLDOWN_MAX_SAMPLES ? order.length - SQL_REPEAT_DRILLDOWN_MAX_SAMPLES : 0;
    return {
        fingerprint: repeatTracker.sqlStreakFingerprint || '',
        sqlSnippet: capSqlSnippetForDrilldown(repeatTracker.sqlStreakSqlSnippet || ''),
        firstTs: repeatTracker.sqlStreakFirstTs,
        lastTs: ts || repeatTracker.sqlStreakLastTs || repeatTracker.sqlStreakFirstTs,
        variants: variants,
        moreVariantCount: moreVariantCount,
        repeatCount: repeatTracker.count
    };
}
function formatSqlRepeatDrilldownTs(ms) {
    if (ms == null || !isFinite(ms)) return '\\u2014';
    if (typeof formatRunTime === 'function') return formatRunTime(ms);
    return String(ms);
}
function estimateSqlRepeatDrilldownExtraHeight(d) {
    if (!d) return 0;
    var sqlChars = (d.sqlSnippet && d.sqlSnippet.length) || 0;
    var sqlLines = Math.ceil(Math.min(sqlChars, SQL_REPEAT_SNIPPET_STORE_CAP) / 68);
    sqlLines = Math.max(1, Math.min(sqlLines, 6));
    var v = d.variants ? d.variants.length : 0;
    var more = d.moreVariantCount > 0 ? 1 : 0;
    var staticRow = (typeof staticSqlFromFingerprintEnabled !== 'undefined' && staticSqlFromFingerprintEnabled && d.fingerprint) ? 28 : 0;
    return 44 + sqlLines * 16 + v * 18 + more * 16 + staticRow;
}
/** Build repeat-notification inner HTML for SQL fingerprint rows (collapsed or expanded). */
function buildSqlRepeatNotificationRowHtml(item) {
    var d = item.sqlRepeatDrilldown;
    var expanded = !!item.sqlRepeatDrilldownOpen;
    var preview = escapeHtml(item.repeatPreviewText || '\\u2026');
    var cnt = d ? d.repeatCount : 0;
    var label = cnt + ' × SQL repeated:';
    var seq = item.seq;
    var ariaExp = expanded ? 'true' : 'false';
    var head = '<span class="repeat-notification repeat-sql-fp">' +
        '<button type="button" class="sql-repeat-drilldown-toggle" data-seq="' + seq + '" aria-expanded="' + ariaExp + '" aria-label="SQL repeat details: ' + escapeHtml(label) + '">' +
        escapeHtml(label) + '</button>' +
        ' <span class="repeat-preview">' + preview + '</span>';
    if (!expanded || !d) {
        return head + '</span>';
    }
    var fpDisp = escapeHtml(d.fingerprint || '');
    var t0 = formatSqlRepeatDrilldownTs(d.firstTs);
    var t1 = formatSqlRepeatDrilldownTs(d.lastTs);
    var sqlEsc = escapeHtml(d.sqlSnippet || '');
    var detail = '<div class="sql-repeat-drilldown-detail" role="region" aria-label="SQL repeat samples" tabindex="-1">' +
        '<div class="sql-repeat-drilldown-meta"><span class="sql-repeat-drilldown-meta-label">Fingerprint</span> <code class="sql-repeat-drilldown-fp">' + fpDisp + '</code></div>' +
        '<div class="sql-repeat-drilldown-meta">' + escapeHtml('Time') + ': ' + escapeHtml(t0) + ' \\u2013 ' + escapeHtml(t1) + '</div>' +
        '<pre class="sql-repeat-drilldown-snippet">' + sqlEsc + '</pre>' +
        '<div class="sql-repeat-drilldown-variant-title">' + escapeHtml('Argument variants (first-seen order, capped)') + '</div>';
    var vi;
    for (vi = 0; vi < (d.variants || []).length; vi++) {
        var vr = d.variants[vi];
        detail += '<div class="sql-repeat-drilldown-variant"><span class="sql-repeat-drilldown-variant-count">×' + (vr.count | 0) + '</span> <code>' + escapeHtml(vr.argsKey || '') + '</code></div>';
    }
    if (d.moreVariantCount > 0) {
        detail += '<div class="sql-repeat-drilldown-more">' + escapeHtml('+' + d.moreVariantCount + ' more distinct arg variant(s)') + '</div>';
    }
    if (typeof staticSqlFromFingerprintEnabled !== 'undefined' && staticSqlFromFingerprintEnabled && d.fingerprint) {
        detail += '<div class="sql-repeat-drilldown-actions"><button type="button" class="sql-repeat-static-sources" data-fingerprint="' + escapeHtml(d.fingerprint) + '">Possible Dart sources (static index, not stack)</button></div>';
    }
    detail += '</div>';
    return '<span class="repeat-notification repeat-sql-fp repeat-sql-fp-expanded">' +
        '<button type="button" class="sql-repeat-drilldown-toggle" data-seq="' + seq + '" aria-expanded="true" aria-label="SQL repeat details: ' + escapeHtml(label) + '">' +
        escapeHtml(label) + '</button>' +
        ' <span class="repeat-preview">' + preview + '</span></span>' + detail;
}
function toggleSqlRepeatDrilldown(seq) {
    var idx;
    for (idx = 0; idx < allLines.length; idx++) {
        var it = allLines[idx];
        if (it && it.type === 'repeat-notification' && it.seq === seq && it.sqlRepeatDrilldown) {
            it.sqlRepeatDrilldownOpen = !it.sqlRepeatDrilldownOpen;
            it.html = buildSqlRepeatNotificationRowHtml(it);
            if (typeof recalcHeights === 'function') recalcHeights();
            if (typeof renderViewport === 'function') renderViewport(true);
            return;
        }
    }
}
`;
}

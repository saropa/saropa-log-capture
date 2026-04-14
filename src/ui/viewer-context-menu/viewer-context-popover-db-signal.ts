/**
 * Database insight popover section builder.
 *
 * Renders fingerprint, seen-count, duration stats, SQL snippet,
 * and optional "Find sources" / "Open in Drift Advisor" buttons.
 */

/** Returns the JavaScript for `buildDatabaseInsightPopoverSection()`. */
export function getContextPopoverDbInsightScript(): string {
    return /* javascript */ `
function buildDatabaseInsightPopoverSection(lineIdx) {
    var row = (typeof allLines !== 'undefined' && lineIdx >= 0 && lineIdx < allLines.length) ? allLines[lineIdx] : null;
    var ins = row && row.dbInsight;
    if (!ins) return '';
    var seenCountSafe = (typeof ins.seenCount === 'number' && isFinite(ins.seenCount) && ins.seenCount >= 1)
        ? Math.floor(ins.seenCount) : 1;
    var driftAvail = (typeof window !== 'undefined' && window.driftAdvisorAvailable);
    var html = '<div class="popover-section popover-section-db-insight">';
    html += '<div class="popover-section-header"><span class="codicon codicon-database popover-icon" aria-hidden="true"></span> Database insight</div>';
    html += '<div class="popover-section-content">';
    if (ins.fingerprint) {
        var fpFull = ins.fingerprint;
        var fpDisp = fpFull.length > 72 ? fpFull.substring(0, 69) + '...' : fpFull;
        html += '<div class="popover-item"><span class="popover-meta-label">Fingerprint</span> <code class="popover-fingerprint" title="' + popoverEscapeAttr(fpFull) + '">' + escapeHtmlBasic(fpDisp) + '</code></div>';
    }
    html += '<div class="popover-item">Seen in session: \\u00d7' + seenCountSafe + '</div>';
    if (typeof ins.avgDurationMs === 'number' && isFinite(ins.avgDurationMs)) {
        html += '<div class="popover-item">Avg duration: ' + ins.avgDurationMs.toFixed(1) + ' ms</div>';
    }
    if (typeof ins.maxDurationMs === 'number' && isFinite(ins.maxDurationMs)) {
        html += '<div class="popover-item">Max duration: ' + ins.maxDurationMs.toFixed(0) + ' ms</div>';
    }
    if (ins.sqlSnippet) {
        var fullSql = ins.sqlSnippet;
        var shortSql = fullSql.length > 120 ? fullSql.substring(0, 117) + '...' : fullSql;
        html += '<div class="popover-item popover-sql-wrap"><span class="popover-meta-label">SQL</span> ';
        html += '<span class="popover-sql-snippet" title="' + popoverEscapeAttr(fullSql) + '">' + escapeHtmlBasic(shortSql) + '</span></div>';
    }
    var staticSqlPop = (typeof staticSqlFromFingerprintEnabled !== 'undefined' && staticSqlFromFingerprintEnabled);
    if (staticSqlPop && ins.fingerprint) {
        html += '<div class="popover-item popover-db-static-note">Possible sources use the project index (static), not your stack trace.</div>';
        html += '<button class="popover-btn popover-static-sql-open" type="button" data-fingerprint="' + popoverEscapeAttr(ins.fingerprint) + '">Find possible Dart sources…</button>';
    }
    if (driftAvail) {
        html += '<button class="popover-btn popover-drift-open" type="button">Open in Drift Advisor</button>';
    }
    html += '</div></div>';
    return html;
}
`;
}

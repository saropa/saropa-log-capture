/**
 * Database signal popover section builder.
 *
 * Renders fingerprint, seen-count, duration stats, SQL snippet,
 * and optional "Find sources" / "Open in Drift Advisor" buttons.
 */

/** Returns the JavaScript for `buildDatabaseSignalPopoverSection()`. */
export function getContextPopoverDbSignalScript(): string {
    return /* javascript */ `
function buildDatabaseSignalPopoverSection(lineIdx) {
    var row = (typeof allLines !== 'undefined' && lineIdx >= 0 && lineIdx < allLines.length) ? allLines[lineIdx] : null;
    var ins = row && row.dbSignal;
    if (!ins) return '';
    var seenCountSafe = (typeof ins.seenCount === 'number' && isFinite(ins.seenCount) && ins.seenCount >= 1)
        ? Math.floor(ins.seenCount) : 1;
    var driftAvail = (typeof window !== 'undefined' && window.driftAdvisorAvailable);
    var html = '<div class="popover-section popover-section-db-signal">';
    html += '<div class="popover-section-header"><span class="codicon codicon-database popover-icon" aria-hidden="true"></span> ' + vt('viewer.dbSignal.header') + '</div>';
    html += '<div class="popover-section-content">';
    if (ins.fingerprint) {
        var fpFull = ins.fingerprint;
        var fpDisp = fpFull.length > 72 ? fpFull.substring(0, 69) + '...' : fpFull;
        html += '<div class="popover-item"><span class="popover-meta-label">' + vt('viewer.dbSignal.fingerprint') + '</span> <code class="popover-fingerprint" title="' + popoverEscapeAttr(fpFull) + '">' + escapeHtmlBasic(fpDisp) + '</code></div>';
    }
    html += '<div class="popover-item">' + vt('viewer.dbSignal.seenInSession', seenCountSafe) + '</div>';
    if (typeof ins.avgDurationMs === 'number' && isFinite(ins.avgDurationMs)) {
        html += '<div class="popover-item">' + vt('viewer.dbSignal.avgDuration', ins.avgDurationMs.toFixed(1)) + '</div>';
    }
    if (typeof ins.maxDurationMs === 'number' && isFinite(ins.maxDurationMs)) {
        html += '<div class="popover-item">' + vt('viewer.dbSignal.maxDuration', ins.maxDurationMs.toFixed(0)) + '</div>';
    }
    if (ins.sqlSnippet) {
        var fullSql = ins.sqlSnippet;
        var shortSql = fullSql.length > 120 ? fullSql.substring(0, 117) + '...' : fullSql;
        html += '<div class="popover-item popover-sql-wrap"><span class="popover-meta-label">SQL</span> ';
        html += '<span class="popover-sql-snippet" title="' + popoverEscapeAttr(fullSql) + '">' + escapeHtmlBasic(shortSql) + '</span></div>';
    }
    var staticSqlPop = (typeof staticSqlFromFingerprintEnabled !== 'undefined' && staticSqlFromFingerprintEnabled);
    if (staticSqlPop && ins.fingerprint) {
        html += '<div class="popover-item popover-db-static-note">' + vt('viewer.dbSignal.staticNote') + '</div>';
        html += '<button class="popover-btn popover-static-sql-open" type="button" data-fingerprint="' + popoverEscapeAttr(ins.fingerprint) + '">' + vt('viewer.dbSignal.findSources') + '</button>';
    }
    if (driftAvail) {
        html += '<button class="popover-btn popover-drift-open" type="button">' + vt('viewer.drift.openIn') + '</button>';
    }
    html += '</div></div>';
    return html;
}
`;
}

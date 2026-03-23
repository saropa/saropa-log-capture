/**
 * Embedded helpers for DB_15 detector pipeline output (synthetic insight rows + burst markers).
 * Split from `viewer-data-add.ts` to stay under the file line budget.
 */

export function getViewerDataAddDbDetectorsScript(): string {
    return /* javascript */ `
/**
 * Apply merged DB detector results (currently n-plus-one synthetic lines).
 * Kept separate so future kinds stay in one adapter.
 */
function applyDbSyntheticLineResults(results, scopeFilt, ts, sp, lineSource) {
    if (!results || !results.length) return;
    var i, r, pl, insight, sqlMeta, windowSec, confLabel, previewFingerprint, n1Html, n1Item;
    for (i = 0; i < results.length; i++) {
        r = results[i];
        if (!r || r.kind !== 'synthetic-line' || !r.payload) continue;
        pl = r.payload;
        if (pl.syntheticType !== 'n-plus-one-insight' || !pl.insight || !pl.sqlMeta) continue;
        try {
            insight = pl.insight;
            sqlMeta = pl.sqlMeta;
            windowSec = (insight.windowSpanMs / 1000).toFixed(2);
            confLabel = insight.confidence.toUpperCase();
            previewFingerprint = sqlMeta.fingerprint.length > 96
                ? sqlMeta.fingerprint.substring(0, 96) + '...'
                : sqlMeta.fingerprint;
            n1Html = '<span class="repeat-notification n1-insight">'
                + '\\u26a0 Potential N+1 query '
                + '<span class="n1-conf n1-conf-' + insight.confidence + '">[' + confLabel + ']</span> '
                + ' - ' + insight.repeats + ' repeats / ' + insight.distinctArgs + ' arg variants in ' + windowSec + 's'
                + ' <span class="n1-fp">(' + escapeHtml(previewFingerprint) + ')</span>'
                + ' <span class="n1-actions">'
                + '<span class="n1-action" data-action="focus-db" title="Show only database-tagged lines">Focus DB</span>'
                + ' · '
                + '<span class="n1-action" data-action="focus-fingerprint" data-fingerprint="' + escapeHtml(sqlMeta.fingerprint) + '" title="Search this SQL fingerprint">Find fingerprint</span>'
                + '</span>'
                + '</span>';
            n1Item = {
                html: n1Html,
                type: 'n-plus-one-insight',
                height: ROW_HEIGHT,
                category: 'db-insight',
                groupId: -1,
                timestamp: ts,
                level: 'performance',
                seq: nextSeq++,
                sourceTag: 'database',
                logcatTag: null,
                sourceFiltered: false,
                sqlPatternFiltered: false,
                classFiltered: false,
                classTags: [],
                isSeparator: false,
                sourcePath: sp || null,
                scopeFiltered: scopeFilt,
                autoHidden: false,
                source: lineSource,
                insightMeta: {
                    fingerprint: sqlMeta.fingerprint,
                    repeats: insight.repeats,
                    distinctArgs: insight.distinctArgs,
                    windowSpanMs: insight.windowSpanMs,
                    confidence: insight.confidence
                }
            };
            allLines.push(n1Item);
            if (typeof registerSourceTag === 'function') { registerSourceTag(n1Item); }
            if (typeof registerSqlPattern === 'function') { registerSqlPattern(n1Item); }
            totalHeight += ROW_HEIGHT;
            resetCompressDupStreak();
        } catch (_n1EmitErr) { /* swallow — never block ingest on heuristic */ }
    }
}
/** DB_08 slow-query burst markers (click target uses data-anchor-seq for scroll). */
function applyDbMarkerResults(results, ts, sp, lineSource) {
    if (!results || !results.length) return;
    var i, r, pl, cat, lbl, anc, anchorAttr, html;
    for (i = 0; i < results.length; i++) {
        r = results[i];
        if (!r || r.kind !== 'marker' || !r.payload) continue;
        pl = r.payload;
        cat = pl.category || 'db-insight';
        lbl = pl.label || 'Slow query burst';
        anc = pl.anchorSeq;
        anchorAttr = (typeof anc === 'number' && isFinite(anc)) ? ' data-anchor-seq="' + anc + '"' : '';
        html = '<span class="slow-query-burst-marker"' + anchorAttr
            + ' role="button" tabindex="0" title="Jump to completing slow query">' + escapeHtml(lbl) + '</span>';
        try {
            resetCompressDupStreak();
            if (activeGroupHeader) {
                if (typeof finalizeStackGroup === 'function') finalizeStackGroup(activeGroupHeader);
                if (typeof registerClassTags === 'function') registerClassTags(activeGroupHeader);
                activeGroupHeader = null;
            }
            cleanupTrailingRepeats();
            var markerItem = { html: html, type: 'marker', height: MARKER_HEIGHT, category: cat, groupId: -1, timestamp: ts, sourcePath: sp || null, source: lineSource };
            allLines.push(markerItem);
            totalHeight += MARKER_HEIGHT;
        } catch (_mkErr) { /* swallow — never block ingest */ }
    }
}
/**
 * Drift SQL database lines: run registered DB detectors (slow burst, N+1, future diff hooks).
 * Runs when sourceTag is 'database' and the line has parsed SQL and/or a replay duration.
 */
function emitDbLineDetectors(nowTs, sqlMeta, sourceTag, scopeFilt, ts, sp, lineSource, lvl, elapsedMs, plain, anchorSeq) {
    if (typeof runDbDetectors !== 'function') return;
    if (sourceTag !== 'database') return;
    var hasSql = !!sqlMeta;
    var hasDur = typeof elapsedMs === 'number' && elapsedMs >= 0 && isFinite(elapsedMs);
    if (!hasSql && !hasDur) return;
    try {
        var ctx = {
            timestampMs: nowTs,
            sessionId: null,
            sourceTag: 'database',
            level: lvl || 'info',
            plainText: plain || '',
            durationMs: hasDur ? elapsedMs : undefined,
            sql: sqlMeta || null,
            baselineFingerprintSummary: null,
            anchorSeq: (typeof anchorSeq === 'number' && isFinite(anchorSeq)) ? anchorSeq : undefined
        };
        var merged = runDbDetectors(ctx);
        applyDbSyntheticLineResults(merged, scopeFilt, ts, sp, lineSource);
        applyDbMarkerResults(merged, ts, sp, lineSource);
    } catch (_dbDetErr) { /* swallow — framework must not break ingest */ }
}
`;
}

/**
 * Embedded helpers for DB_15 detector pipeline output (rollup patches, annotate-line, synthetic rows, markers).
 * Split from `viewer-data-add.ts` to stay under the file line budget.
 *
 * **Primary SQL rollup:** Ingest applies one `session-rollup-patch` (`db.ingest-rollup`) per parsed Drift fingerprint
 * before `runDbDetectors`, so `dbInsightSessionRollup` matches what baseline-volume and other detectors read. Normal
 * `lineItem.dbInsight` is attached afterward via `peekDbInsightRollup` (and a fallback object when the line is
 * `database`-tagged but not parsed as Drift SQL).
 *
 * **Result ordering:** After `mergeDbDetectorResultsByStableKey`, `applyDbDetectorResultsInPriorityOrder` runs
 * phases in this order — rollup patches → `annotate-line` → `synthetic-line` → `marker` — with ascending `priority`
 * within each phase. That preserves the prior UX where N+1 synthetic rows precede burst markers when priorities
 * differ. `annotate-line` with an unknown `targetSeq` is a silent no-op (never throws).
 *
 * Baseline-aware detectors use `dbBaselineFingerprintSummaryMap` from `viewer-db-detector-framework-script.ts`
 * (built once when the host posts `setDbBaselineFingerprintSummary`, not per ingest line).
 */

export function getViewerDataAddDbDetectorsScript(): string {
    return /* javascript */ `
/** Apply only synthetic-line / n-plus-one insight payloads (batch; caller splits merged detector output). */
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
                + ' · '
                + '<span class="n1-action" data-action="find-static-sources" data-fingerprint="' + escapeHtml(sqlMeta.fingerprint) + '" title="Search workspace for code that might contain this SQL">Static sources</span>'
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
/** Merge \`annotate-line\` payload onto an existing row (by \`seq\`); adjusts \`totalHeight\` if \`height\` changes. */
function applyDbAnnotateLineResult(r) {
    if (!r || r.kind !== 'annotate-line' || !r.payload) return;
    var pl = r.payload;
    var seq = pl.targetSeq;
    var patch = pl.patch;
    if (typeof seq !== 'number' || !isFinite(seq) || !patch || typeof patch !== 'object') return;
    var i, it, k, oldH;
    for (i = 0; i < allLines.length; i++) {
        it = allLines[i];
        if (it && it.seq === seq) {
            oldH = typeof it.height === 'number' ? it.height : 0;
            for (k in patch) {
                if (Object.prototype.hasOwnProperty.call(patch, k)) {
                    it[k] = patch[k];
                }
            }
            if (typeof patch.height === 'number' && isFinite(patch.height) && patch.height !== oldH) {
                totalHeight += patch.height - oldH;
            }
            return;
        }
    }
}
/**
 * Apply merged detector results in fixed phases (rollup → annotate → synthetic → marker) so N+1 rows stay before
 * burst markers; within each phase sort by ascending \`priority\`.
 */
function applyDbDetectorResultsInPriorityOrder(merged, scopeFilt, ts, sp, lineSource) {
    if (!merged || !merged.length) return;
    var roll = [];
    var ann = [];
    var syn = [];
    var mk = [];
    var i, r;
    for (i = 0; i < merged.length; i++) {
        r = merged[i];
        if (!r || !r.kind) continue;
        if (r.kind === 'session-rollup-patch') roll.push(r);
        else if (r.kind === 'annotate-line') ann.push(r);
        else if (r.kind === 'synthetic-line') syn.push(r);
        else if (r.kind === 'marker') mk.push(r);
    }
    var byPri = function(a, b) { return (a.priority || 0) - (b.priority || 0); };
    roll.sort(byPri);
    ann.sort(byPri);
    syn.sort(byPri);
    mk.sort(byPri);
    if (roll.length && typeof applyDbSessionRollupPatches === 'function') {
        applyDbSessionRollupPatches(roll);
    }
    for (i = 0; i < ann.length; i++) {
        applyDbAnnotateLineResult(ann[i]);
    }
    if (syn.length) {
        applyDbSyntheticLineResults(syn, scopeFilt, ts, sp, lineSource);
    }
    if (mk.length) {
        applyDbMarkerResults(mk, ts, sp, lineSource);
    }
}
/**
 * Drift SQL database lines: primary rollup patch, then registered DB detectors (slow burst, N+1, etc.).
 * Runs when sourceTag is 'database' and the line has parsed SQL and/or a replay duration.
 * @param lineItemForDbInsight - When set, attaches \`dbInsight\` after primary rollup (normal line row only).
 */
function emitDbLineDetectors(nowTs, sqlMeta, sourceTag, scopeFilt, ts, sp, lineSource, lvl, elapsedMs, plain, anchorSeq, lineItemForDbInsight) {
    if (typeof runDbDetectors !== 'function') return;
    if (sourceTag !== 'database') return;
    var hasSql = !!sqlMeta;
    var hasDur = typeof elapsedMs === 'number' && elapsedMs >= 0 && isFinite(elapsedMs);
    if (!hasSql && !hasDur) return;
    try {
        if (typeof viewerDbInsightsEnabled !== 'undefined' && viewerDbInsightsEnabled && sqlMeta && sqlMeta.fingerprint
            && typeof applyDbSessionRollupPatches === 'function') {
            applyDbSessionRollupPatches([{
                kind: 'session-rollup-patch',
                detectorId: 'db.ingest-rollup',
                stableKey: 'db.ingest-rollup',
                priority: -1000,
                payload: { fingerprint: sqlMeta.fingerprint, elapsedMs: hasDur ? elapsedMs : undefined }
            }]);
        }
        if (lineItemForDbInsight && typeof viewerDbInsightsEnabled !== 'undefined' && viewerDbInsightsEnabled && sourceTag === 'database') {
            var pln0 = plain || '';
            var di0 = pln0.indexOf('Drift:');
            var rawSnip0 = di0 >= 0 ? pln0.substring(di0).trim() : pln0.trim();
            var snipDb0 = rawSnip0.length > 500 ? rawSnip0.substring(0, 497) + '...' : rawSnip0;
            if (sqlMeta && sqlMeta.fingerprint) {
                var rollupDb = (typeof peekDbInsightRollup === 'function') ? peekDbInsightRollup(sqlMeta.fingerprint) : null;
                var snipDb = sqlMeta.sqlSnippet ? sqlMeta.sqlSnippet : snipDb0;
                lineItemForDbInsight.dbInsight = {
                    fingerprint: sqlMeta.fingerprint,
                    sqlSnippet: snipDb,
                    seenCount: rollupDb ? rollupDb.seenCount : 1,
                    avgDurationMs: rollupDb ? rollupDb.avgDurationMs : undefined,
                    maxDurationMs: rollupDb ? rollupDb.maxDurationMs : undefined
                };
            } else {
                lineItemForDbInsight.dbInsight = {
                    fingerprint: null,
                    sqlSnippet: snipDb0,
                    seenCount: 1,
                    avgDurationMs: undefined,
                    maxDurationMs: undefined
                };
            }
        }
        var baselineForCtx = (typeof dbBaselineFingerprintSummaryMap !== 'undefined' && dbBaselineFingerprintSummaryMap)
            ? dbBaselineFingerprintSummaryMap
            : null;
        var ctx = {
            timestampMs: nowTs,
            sessionId: null,
            sourceTag: 'database',
            level: lvl || 'info',
            plainText: plain || '',
            durationMs: hasDur ? elapsedMs : undefined,
            sql: sqlMeta || null,
            baselineFingerprintSummary: baselineForCtx,
            anchorSeq: (typeof anchorSeq === 'number' && isFinite(anchorSeq)) ? anchorSeq : undefined
        };
        var merged = runDbDetectors(ctx);
        applyDbDetectorResultsInPriorityOrder(merged, scopeFilt, ts, sp, lineSource);
    } catch (_dbDetErr) { /* swallow — framework must not break ingest */ }
}
`;
}

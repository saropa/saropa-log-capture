"use strict";
/**
 * Embedded helpers for DB_15 detector pipeline output (rollup patches, annotate-line, synthetic rows, markers).
 * Split from `viewer-data-add.ts` to stay under the file line budget.
 *
 * **Primary SQL rollup:** Ingest applies one `session-rollup-patch` (`db.ingest-rollup`) per parsed Drift fingerprint
 * before `runDbDetectors`, so `dbSignalSessionRollup` matches what baseline-volume and other detectors read. Normal
 * `lineItem.dbSignal` is attached afterward via `peekDbSignalRollup` (and a fallback object when the line is
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.getViewerDataAddDbDetectorsScript = getViewerDataAddDbDetectorsScript;
function getViewerDataAddDbDetectorsScript(staticSqlFromFingerprintEnabled = true) {
    const staticSqlJs = staticSqlFromFingerprintEnabled ? "true" : "false";
    return /* javascript */ `
var staticSqlFromFingerprintEnabled = ${staticSqlJs};
/** Apply only synthetic-line / n-plus-one signal payloads (batch; caller splits merged detector output). */
function applyDbSyntheticLineResults(results, scopeFilt, ts, sp, lineSource) {
    if (!results || !results.length) return;
    var i, r, pl, signal, sqlMeta, windowSec, confLabel, previewFingerprint, n1Html, n1Item;
    for (i = 0; i < results.length; i++) {
        r = results[i];
        if (!r || r.kind !== 'synthetic-line' || !r.payload) continue;
        pl = r.payload;
        if (pl.syntheticType !== 'n-plus-one-signal' || !pl.signal || !pl.sqlMeta) continue;
        try {
            signal = pl.signal;
            sqlMeta = pl.sqlMeta;
            windowSec = (signal.windowSpanMs / 1000).toFixed(2);
            confLabel = signal.confidence.toUpperCase();
            previewFingerprint = sqlMeta.fingerprint.length > 96
                ? sqlMeta.fingerprint.substring(0, 96) + '...'
                : sqlMeta.fingerprint;
            n1Html = '<span class="repeat-notification n1-signal">'
                + '\\u26a0 Potential N+1 query '
                + '<span class="n1-conf n1-conf-' + signal.confidence + '">[' + confLabel + ']</span> '
                + ' - ' + signal.repeats + ' repeats / ' + signal.distinctArgs + ' arg variants in ' + windowSec + 's'
                + ' <span class="n1-fp">(' + escapeHtml(previewFingerprint) + ')</span>'
                + ' <span class="n1-actions">'
                + '<span class="n1-action" data-action="focus-db" title="Show only database-tagged lines">Focus DB</span>'
                + ' · '
                + '<span class="n1-action" data-action="focus-fingerprint" data-fingerprint="' + escapeHtml(sqlMeta.fingerprint) + '" title="Search this SQL fingerprint">Find fingerprint</span>'
                + ((typeof staticSqlFromFingerprintEnabled !== 'undefined' && staticSqlFromFingerprintEnabled)
                    ? (' · <span class="n1-action" data-action="find-static-sources" data-fingerprint="' + escapeHtml(sqlMeta.fingerprint) + '" title="Possible Dart sources (project index; not stack trace)">Static sources</span>')
                    : '')
                + '</span>'
                + '</span>';
            n1Item = {
                html: n1Html,
                type: 'n-plus-one-signal',
                height: ROW_HEIGHT,
                category: 'db-signal',
                groupId: -1,
                timestamp: ts,
                level: 'performance',
                seq: nextSeq++,
                sourceTag: 'database',
                logcatTag: null,
                sqlVerb: sqlMeta ? sqlMeta.verb : null,
                sourceFiltered: false,
                sqlPatternFiltered: false,
                classFiltered: false,
                classTags: [],
                isSeparator: false,
                sourcePath: sp || null,
                scopeFiltered: scopeFilt,
                autoHidden: false,
                source: lineSource,
                timeRangeFiltered: false,
                signalMeta: {
                    fingerprint: sqlMeta.fingerprint,
                    repeats: signal.repeats,
                    distinctArgs: signal.distinctArgs,
                    windowSpanMs: signal.windowSpanMs,
                    confidence: signal.confidence
                }
            };
            /* DB_11: same fingerprint source as chips / signal row for session query history. */
            n1Item.sqlHistoryFp = sqlMeta.fingerprint;
            var n1Snip = (sqlMeta.sqlSnippet || sqlMeta.fingerprint || '').trim();
            n1Item.sqlHistoryPreview = n1Snip.length > 120 ? n1Snip.substring(0, 117) + '...' : n1Snip;
            allLines.push(n1Item);
            if (typeof registerSourceTag === 'function') { registerSourceTag(n1Item); }
            if (typeof registerSqlPattern === 'function') { registerSqlPattern(n1Item); }
            if (typeof recordSqlQueryHistoryForAppendedItem === 'function') { recordSqlQueryHistoryForAppendedItem(n1Item); }
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
        cat = pl.category || 'db-signal';
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
            /* Persist anchorSeq on the item so the marker-visibility pass can locate the jump target
               (applyDbSignalMarkerVisibility() hides orphaned markers whose anchor is filtered). */
            /* Orphan check at birth: applyDbSignalMarkerVisibility runs only inside recalcHeights
               (on user interaction), so streaming markers rendered visible until the next pass —
               even when their anchor SELECT was already hidden by a level/source filter. Compute
               hidden state now by locating the anchor and reusing the shared helper, and stamp
               markerHidden + a zero initial height so the first render matches the filter state. */
            var _mHidden = false;
            if (typeof dbSignalMarkersVisible !== 'undefined' && !dbSignalMarkersVisible) {
                _mHidden = true;
            } else if (typeof isDbSignalLevelDisabled === 'function' && isDbSignalLevelDisabled()) {
                /* Mirror applyDbSignalMarkerVisibility's database-level gate so streaming
                   markers don't briefly flash visible under "Errors Only" before the next
                   recalcHeights pass. Same reasoning as the recalc path: db-signal markers
                   belong with database lines. */
                _mHidden = true;
            } else if (typeof anc === 'number' && isFinite(anc) && typeof isNonMarkerItemEffectivelyHidden === 'function') {
                /* Anchor was pushed immediately before the marker in the same batch — a short
                   reverse scan beats building a global seq→index map per marker. Bound the scan
                   so pathological inputs can't turn this into O(n²). */
                for (var _lk = allLines.length - 1, _lkMin = Math.max(0, _lk - 32); _lk >= _lkMin; _lk--) {
                    var _cand = allLines[_lk];
                    if (_cand && _cand.type !== 'marker' && _cand.seq === anc) {
                        _mHidden = isNonMarkerItemEffectivelyHidden(_cand);
                        break;
                    }
                }
            }
            var _mH = _mHidden ? 0 : MARKER_HEIGHT;
            var markerItem = { html: html, type: 'marker', height: _mH, category: cat, groupId: -1, timestamp: ts, sourcePath: sp || null, source: lineSource, anchorSeq: (typeof anc === 'number' && isFinite(anc)) ? anc : undefined, markerHidden: _mHidden };
            allLines.push(markerItem);
            totalHeight += _mH;
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
 * @param lineItemForDbSignal - When set, attaches \`dbSignal\` after primary rollup (normal line row only).
 */
function emitDbLineDetectors(nowTs, sqlMeta, sourceTag, scopeFilt, ts, sp, lineSource, lvl, elapsedMs, plain, anchorSeq, lineItemForDbSignal) {
    if (typeof runDbDetectors !== 'function') return;
    if (sourceTag !== 'database') return;
    var hasSql = !!sqlMeta;
    var hasDur = typeof elapsedMs === 'number' && elapsedMs >= 0 && isFinite(elapsedMs);
    if (!hasSql && !hasDur) return;
    try {
        if (typeof viewerDbSignalsEnabled !== 'undefined' && viewerDbSignalsEnabled && sqlMeta && sqlMeta.fingerprint
            && typeof applyDbSessionRollupPatches === 'function') {
            applyDbSessionRollupPatches([{
                kind: 'session-rollup-patch',
                detectorId: 'db.ingest-rollup',
                stableKey: 'db.ingest-rollup',
                priority: -1000,
                payload: { fingerprint: sqlMeta.fingerprint, elapsedMs: hasDur ? elapsedMs : undefined }
            }]);
        }
        if (lineItemForDbSignal && typeof viewerDbSignalsEnabled !== 'undefined' && viewerDbSignalsEnabled && sourceTag === 'database') {
            var plainForSnip = plain || '';
            var snipFallback = (typeof driftSqlSnippetFromPlain === 'function')
                ? driftSqlSnippetFromPlain(plainForSnip)
                : plainForSnip;
            if (sqlMeta && sqlMeta.fingerprint) {
                var rollupDb = (typeof peekDbSignalRollup === 'function') ? peekDbSignalRollup(sqlMeta.fingerprint) : null;
                var snipDb = sqlMeta.sqlSnippet ? sqlMeta.sqlSnippet : snipFallback;
                lineItemForDbSignal.dbSignal = {
                    fingerprint: sqlMeta.fingerprint,
                    sqlSnippet: snipDb,
                    seenCount: rollupDb ? rollupDb.seenCount : 1,
                    avgDurationMs: rollupDb ? rollupDb.avgDurationMs : undefined,
                    maxDurationMs: rollupDb ? rollupDb.maxDurationMs : undefined
                };
            } else {
                lineItemForDbSignal.dbSignal = {
                    fingerprint: null,
                    sqlSnippet: snipFallback,
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
//# sourceMappingURL=viewer-data-add-db-detectors.js.map
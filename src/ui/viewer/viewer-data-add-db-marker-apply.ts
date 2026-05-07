/**
 * Webview embed: apply DB detector `marker` results to `allLines` (slow burst + DB_16 boxed timestamp burst).
 * Split from `viewer-data-add-db-detectors.ts` for eslint max-lines.
 */
export function getViewerDataApplyDbMarkerResultsScript(): string {
  return /* javascript */ `
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
        var _burstTitle = (r.detectorId === 'db.timestamp-burst')
            ? 'Jump to last query in this burst'
            : 'Jump to completing slow query';
        html = '<span class="slow-query-burst-marker"' + anchorAttr
            + ' role="button" tabindex="0" title="' + _burstTitle + '">' + escapeHtml(lbl) + '</span>';
        try {
            resetCompressDupStreak();
            if (activeGroupHeader) {
                if (typeof finalizeStackGroup === 'function') finalizeStackGroup(activeGroupHeader);
                if (typeof registerClassTags === 'function') registerClassTags(activeGroupHeader);
                activeGroupHeader = null;
            }
            cleanupTrailingRepeats();
            var _mHidden = false;
            if (typeof dbSignalMarkersVisible !== 'undefined' && !dbSignalMarkersVisible) {
                _mHidden = true;
            } else if (typeof isDbSignalLevelDisabled === 'function' && isDbSignalLevelDisabled()) {
                _mHidden = true;
            } else if (typeof anc === 'number' && isFinite(anc) && typeof isNonMarkerItemEffectivelyHidden === 'function') {
                for (var _lk = allLines.length - 1, _lkMin = Math.max(0, _lk - 256); _lk >= _lkMin; _lk--) {
                    var _cand = allLines[_lk];
                    if (_cand && _cand.type === 'line' && _cand.seq === anc) {
                        _mHidden = isNonMarkerItemEffectivelyHidden(_cand);
                        break;
                    }
                }
            }
            var _mH = _mHidden ? 0 : MARKER_HEIGHT;
            var markerBase = { html: html, type: 'marker', height: _mH, category: cat, groupId: -1, timestamp: ts, sourcePath: sp || null, source: lineSource, anchorSeq: (typeof anc === 'number' && isFinite(anc)) ? anc : undefined, markerHidden: _mHidden };
            var _bs = pl.burstStartSeq;
            var _be = pl.burstEndSeq;
            var _tsBox = (r.detectorId === 'db.timestamp-burst' && typeof _bs === 'number' && isFinite(_bs)
                && typeof _be === 'number' && isFinite(_be) && _bs <= _be);
            if (_tsBox) {
                var _findIdx = function (seq) {
                    for (var q = 0; q < allLines.length; q++) {
                        var row = allLines[q];
                        if (row && row.type === 'line' && row.seq === seq) return q;
                    }
                    return -1;
                };
                var _idxTop = _findIdx(_bs);
                if (_idxTop < 0) {
                    allLines.push(markerBase);
                    totalHeight += _mH;
                } else {
                    var topItem = Object.assign({}, markerBase, { markerBurstEdge: 'top' });
                    allLines.splice(_idxTop, 0, topItem);
                    totalHeight += _mH;
                    var _burstIdxs = [];
                    var _q2, _row2;
                    for (_q2 = 0; _q2 < allLines.length; _q2++) {
                        _row2 = allLines[_q2];
                        if (_row2 && _row2.type === 'line' && typeof _row2.seq === 'number'
                            && _row2.seq >= _bs && _row2.seq <= _be) {
                            _burstIdxs.push(_q2);
                        }
                    }
                    if (_burstIdxs.length === 0) {
                        allLines.splice(_idxTop, 1);
                        totalHeight -= _mH;
                        allLines.push(markerBase);
                        totalHeight += _mH;
                    } else {
                        var _seg, _r3;
                        for (_seg = 0; _seg < _burstIdxs.length; _seg++) {
                            _r3 = allLines[_burstIdxs[_seg]];
                            if (_seg === 0) _r3.dbTsBurstSegment = 'first';
                            else if (_seg === _burstIdxs.length - 1) _r3.dbTsBurstSegment = 'last';
                            else _r3.dbTsBurstSegment = 'mid';
                        }
                        var bottomItem = Object.assign({}, markerBase, { markerBurstEdge: 'bottom' });
                        var _afterLast = _burstIdxs[_burstIdxs.length - 1];
                        allLines.splice(_afterLast + 1, 0, bottomItem);
                        totalHeight += _mH;
                    }
                }
            } else {
                allLines.push(markerBase);
                totalHeight += _mH;
            }
        } catch (_mkErr) { /* swallow — never block ingest */ }
    }
}
`;
}

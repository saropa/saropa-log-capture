/**
 * Signal panel script part B2: "This log" signal list renderer and its helpers.
 * Extracted from part-b to keep files under the 300-line limit.
 * Concatenated by viewer-signal-panel-script.ts inside the same IIFE scope.
 */

/** Returns the "This log" renderer fragment (timestamps, evidence preview, renderSignalsInThisLog). */
export function getSignalScriptPartB2(): string {
    return /* js */ `
    /** Fu7: latest non-zero timestamp in the current allLines buffer, used as the session reference.
     *  Walks from the end so it's typically a few iterations, not full O(n). Returns 0 if no timestamps. */
    function sessionLatestTs() {
        if (typeof allLines === 'undefined' || !allLines || !allLines.length) return 0;
        for (var k = allLines.length - 1; k >= 0; k--) {
            var li = allLines[k];
            var t = li && li.timestamp;
            if (typeof t === 'number' && t > 0) return t;
        }
        return 0;
    }

    /** Fu7: representative timestamp for a signal — its first lineIndex's timestamp, or 0 if unknown. */
    function signalRepTs(s) {
        if (typeof allLines === 'undefined' || !s.lineIndices || s.lineIndices.length === 0) return 0;
        var li = allLines[s.lineIndices[0]];
        var t = li && li.timestamp;
        return (typeof t === 'number' && t > 0) ? t : 0;
    }

    /** Fu3 evidence preview: render up to 3 supporting lines for a signal as a sub-block.
     *  Each line is stripped of HTML and truncated at 90 chars to keep the panel column compact.
     *  Empty when no lineIndices or when allLines lookups fail. */
    function buildEvidencePreviewHtml(s) {
        if (typeof allLines === 'undefined' || !s.lineIndices || s.lineIndices.length === 0) return '';
        var snippets = [];
        var seen = {};
        for (var e = 0; e < s.lineIndices.length && snippets.length < 3; e++) {
            var idx = s.lineIndices[e];
            if (seen[idx]) continue;
            seen[idx] = 1;
            var li = allLines[idx];
            if (!li || !li.html) continue;
            /* Reuse stripTags from the shared webview scope (defined in collect-general). */
            var plain = (typeof stripTags === 'function' ? stripTags(li.html) : li.html).replace(/\\s+/g, ' ').trim();
            if (!plain) continue;
            var compact = plain.length > 90 ? plain.slice(0, 87) + '\\u2026' : plain;
            snippets.push('<div class="signal-evidence-line" title="' + fillSignalString(SIGNAL_STRINGS.evidenceLineTitle, idx + 1, esc(plain)) + '">' + esc(compact) + '</div>');
        }
        if (snippets.length === 0) return '';
        return '<div class="signal-evidence-preview" aria-label="' + esc(SIGNAL_STRINGS.supportingLogLines) + '">' + snippets.join('') + '</div>';
    }

    /** Render signals detected in the current log session (all kinds). Also manages the "This log" empty state. */
    function renderSignalsInThisLog() {
        var listEl = document.getElementById('signals-in-log-list'), summaryEl = document.getElementById('signals-in-log-summary');
        var emptyBlock = document.getElementById('signal-this-log-empty');
        var signalsAll = resolveSignalsInThisLog();
        /* Fu7: time-window filter. Signals lacking a timestamp are hidden under any active window
           (you can't time-locate them, so they aren't in "the last X"). No-op when window is null. */
        var signals;
        if (signalsInLogWindowMs == null) {
            signals = signalsAll;
        } else {
            var refTs = sessionLatestTs();
            if (refTs === 0) {
                signals = signalsAll;
            } else {
                var cutoff = refTs - signalsInLogWindowMs;
                signals = signalsAll.filter(function(s) {
                    var st = signalRepTs(s);
                    return st > 0 && st >= cutoff;
                });
            }
        }
        /* Fu5: chronological sort is opt-in. 'severity' keeps the producer's order (already
           severity-ranked) so the default is unchanged; 'time' sorts a copy ascending by the
           signal's representative timestamp (signals with no timestamp sink to the end). */
        if (signalsInLogSortMode === 'time') {
            signals = signals.slice().sort(function(a, b) {
                var ta = signalRepTs(a), tb = signalRepTs(b);
                if (ta <= 0) { return tb <= 0 ? 0 : 1; }
                if (tb <= 0) { return -1; }
                return ta - tb;
            });
        }
        var hasWindow = (signalsInLogWindowMs != null && signals.length !== signalsAll.length);
        if (summaryEl) summaryEl.textContent = signalsAll.length === 0
            ? SIGNAL_STRINGS.inLogSummaryEmpty
            : (hasWindow
                ? fillSignalString(SIGNAL_STRINGS.inLogSummaryWindow, signals.length, signalsAll.length)
                : fillSignalString(SIGNAL_STRINGS.inLogSummary, signals.length));
        if (emptyBlock) emptyBlock.style.display = signalsAll.length === 0 ? '' : 'none';
        if (!listEl) { return; }
        if (signals.length === 0) { listEl.innerHTML = ''; return; }
        listEl.innerHTML = signals.slice(0, 20).map(function(s) {
            /* Full label; the row's first span ellipsis-truncates at the real column width (CSS). */
            var icon = kindLabels[s.kind] || '\\u2139\\uFE0F', text = s.label;
            var meta = s.totalOccurrences + 'x' + (s.avgDurationMs ? ', avg ' + fmtMs(s.avgDurationMs) : '');
            var lineAttr = s.lineIndices && s.lineIndices.length > 0 ? ' data-line="' + s.lineIndices[0] + '"' : '';
            /* A row is jumpable when it points at a log line. Otherwise, if it carries a detail
               (e.g. the "Drift Advisor issues" classified signal, which summarizes DA diagnostics
               and has no single source line), it becomes a detail-toggle row so the user can still
               click to read the detail inline. Rows with neither stay inert. */
            var jumpable = !!lineAttr;
            var hasDetail = !!(s.detail && String(s.detail).trim());
            var clickCls = jumpable ? ' signal-jumpable' : (hasDetail ? ' signal-detail-toggle' : '');
            var titleSuffix = jumpable ? ' — click to jump' : (hasDetail ? ' — click to see detail' : '');
            var preview = buildEvidencePreviewHtml(s);
            /* fingerprint + label travel on the row so the part-D copy handler can re-find this
               exact signal object (which carries lineIndices) to build the detail block. */
            var copyBtn = ' <span class="re-action signal-copy-btn" role="button" title="' + esc(SIGNAL_STRINGS.copySignalTitle) + '" data-fingerprint="' + esc(s.fingerprint || '') + '" data-label="' + esc(s.label) + '">\\uD83D\\uDCCB ' + esc(SIGNAL_STRINGS.copyLabel) + '</span>';
            /* Inline detail body, hidden until the row is clicked. Only emitted for non-jumpable
               rows that have a detail — jumpable rows reveal context by scrolling to the line. */
            var detailBlock = (!jumpable && hasDetail)
                ? '<div class="signal-detail-body" hidden>' + esc(String(s.detail).trim()) + '</div>'
                : '';
            return '<div class="signal-env-row signal-in-log-row' + clickCls + '"' + lineAttr + ' data-fingerprint="' + esc(s.fingerprint || '') + '" data-label="' + esc(s.label) + '" title="' + esc(s.label) + titleSuffix + '">'
                + '<span>' + icon + ' ' + kindBadge(s.kind) + esc(text) + '</span>'
                + '<span class="signal-hotfile-meta">' + meta + '</span>'
                + '<span class="signal-row-actions">' + copyBtn + '</span>'
                + preview
                + detailBlock
                + '</div>';
        }).join('');
    }
`;
}

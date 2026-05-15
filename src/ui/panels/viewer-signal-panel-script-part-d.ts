/**
 * Signal panel script part D: signal trend click handler.
 * Clicking a signal trend row opens the most recent session with that signal type.
 * Split from part C because that file is at the 300-line limit.
 */

/** Returns JS that attaches click handlers to signal trend rows. */
export function getSignalScriptPartD(): string {
    return /* js */ `
    /* Signal trend rows — click to open the most recent session with this signal type */
    var signalTrendsEl = document.getElementById('signal-trends-list');
    if (signalTrendsEl) {
        signalTrendsEl.addEventListener('click', function(e) {
            /* Lint rule link — opens VS Code settings search for the saropa_lints rule */
            var lintLink = e.target.closest('.signal-lint-link');
            if (lintLink && lintLink.dataset.rule) {
                e.stopPropagation();
                vscodeApi.postMessage({ type: 'openLintRule', rule: lintLink.dataset.rule, source: lintLink.dataset.source || 'saropa_lints' });
                return;
            }
            /* Drift Advisor link — opens the DA panel for SQL signal context */
            var daLink = e.target.closest('.signal-da-link');
            if (daLink) {
                e.stopPropagation();
                vscodeApi.postMessage({ type: 'openDriftAdvisor' });
                return;
            }
            /* Triage action (Close/Mute/Re-open) on error/warning signal rows */
            var triageBtn = e.target.closest('.re-action[data-hash]');
            if (triageBtn && triageBtn.dataset.hash && triageBtn.dataset.status) {
                e.stopPropagation();
                /* Fu4 (plan 052): Mute routes through a separate path that prompts for a reason
                   on the extension side and feeds the noise-learning system. Close / Re-open keep
                   the original anonymous status-flip path because the user has no narrative to
                   add (Close is "fixed", Re-open is "wasn't fixed" — pure status). */
                if (triageBtn.dataset.status === 'muted') {
                    var parentRow = triageBtn.closest('.signal-trend-row');
                    var lbl = (parentRow && parentRow.getAttribute('title')) || '';
                    vscodeApi.postMessage({ type: 'muteSignalWithReason', hash: triageBtn.dataset.hash, label: lbl });
                    return;
                }
                vscodeApi.postMessage({ type: 'setRecurringErrorStatus', hash: triageBtn.dataset.hash, status: triageBtn.dataset.status });
                return;
            }
            /* Row click — open the session containing this signal and scroll to it.
               fingerprint pins it to the specific signal (host resolves which session); label is the
               text the post-load webview handler searches for to scroll to the right line. Without
               those, the host falls back to "most recent session of this kind" which is too coarse. */
            var row = e.target.closest('.signal-trend-row');
            if (!row || !row.dataset.signalType) { return; }
            e.stopPropagation();
            vscodeApi.postMessage({
                type: 'openSessionForSignalType',
                signalType: row.dataset.signalType,
                fingerprint: row.dataset.fingerprint || '',
                label: row.dataset.label || '',
                detail: row.dataset.detail || ''
            });
        });
    }

    /* Fu2 scroll-lock pulse: add a temporary .line-pulse class to lines within +/-10 of the
       target so the eye lands on the right place after the jump. Keep the radius small enough
       that the visual cue is clearly localized — too wide and it becomes noise. The CSS keyframe
       removes itself by class-remove on animationend so we don't leak DOM state. */
    function pulseLinesAround(targetIdx) {
        var radius = 10;
        var lo = Math.max(0, targetIdx - radius);
        var hi = targetIdx + radius;
        /* requestAnimationFrame ensures we run AFTER renderViewport(false) repaints, so the
           queried .line elements are the post-jump rendered set, not the pre-jump viewport. */
        window.requestAnimationFrame(function() {
            window.requestAnimationFrame(function() {
                var nodes = document.querySelectorAll('.line[data-idx]');
                for (var pi = 0; pi < nodes.length; pi++) {
                    var n = nodes[pi];
                    var di = parseInt(n.getAttribute('data-idx') || '', 10);
                    if (isNaN(di) || di < lo || di > hi) continue;
                    /* Trigger reflow before adding the class so the animation restarts cleanly
                       if the same line is targeted twice in a row. */
                    n.classList.remove('line-pulse');
                    void n.offsetWidth;
                    n.classList.add('line-pulse');
                }
            });
        });
    }

    /* Expose a label-based scroll-and-pulse helper so the main viewer message bus can use it
       after the host opens a session for a clicked signal. Strategy: try detail (raw example
       text — usually substring-matches), fall back to label tokens (skipping <N>/<TS>/<UUID>/<HEX>
       placeholders since they're regex-only and won't substring-match real lines). */
    window.signalScrollToLabel = function(label, detail) {
        if (typeof allLines === 'undefined' || !allLines || allLines.length === 0) return;
        var needles = [];
        if (typeof detail === 'string' && detail.length >= 4) { needles.push(detail.toLowerCase()); }
        if (typeof label === 'string' && label.length >= 4) {
            /* Pick the longest segment between placeholder tokens (<N>, <TS>, <UUID>, <HEX>) — that
               is the strongest contiguous substring anchor available in the original log line. */
            var run = '';
            var segments = label.split(/<\\w+>/);
            for (var ti = 0; ti < segments.length; ti++) {
                var seg = segments[ti].trim();
                if (seg.length > run.length) { run = seg; }
            }
            if (run.length >= 4) { needles.push(run.toLowerCase()); }
        }
        if (needles.length === 0) return;
        var foundIdx = -1;
        for (var li = 0; li < allLines.length; li++) {
            var item = allLines[li];
            if (!item || item.type !== 'line') continue;
            var hay = (item.rawText || item.html || '').toLowerCase();
            for (var ni = 0; ni < needles.length; ni++) {
                if (hay.indexOf(needles[ni]) !== -1) { foundIdx = li; break; }
            }
            if (foundIdx !== -1) break;
        }
        if (foundIdx === -1) return;
        if (typeof scrollToLineNumber === 'function') { scrollToLineNumber(foundIdx + 1); }
        pulseLinesAround(foundIdx);
    };

    /* "Signals in this log" rows — click to jump to the line where the signal was detected */
    var signalsInLogEl = document.getElementById('signals-in-log-list');
    if (signalsInLogEl) {
        signalsInLogEl.addEventListener('click', function(e) {
            var row = e.target.closest('.signal-jumpable');
            if (!row || !row.dataset.line) return;
            e.stopPropagation();
            var lineIdx = parseInt(row.dataset.line, 10);
            if (isNaN(lineIdx)) return;
            /* scrollToLineNumber is defined in viewer-goto-line.ts — scrolls to the given 1-based line number */
            if (typeof scrollToLineNumber === 'function') { scrollToLineNumber(lineIdx + 1); }
            pulseLinesAround(lineIdx);
        });
    }

    /* Plan 053-A: filter-suggestion Accept/Reject delegation. Both actions post a message to the
       extension which updates persisted suggestion state + (for accept) the workspace
       exclusions array, then re-sends signalData so the section re-renders. */
    var suggestionsListEl = document.getElementById('signal-suggestions-list');
    if (suggestionsListEl) {
        suggestionsListEl.addEventListener('click', function(e) {
            var accept = e.target.closest('.signal-suggestion-accept');
            if (accept && accept.dataset.sid && accept.dataset.pattern) {
                e.stopPropagation();
                vscodeApi.postMessage({ type: 'acceptFilterSuggestion', id: accept.dataset.sid, pattern: accept.dataset.pattern });
                return;
            }
            var reject = e.target.closest('.signal-suggestion-reject');
            if (reject && reject.dataset.sid) {
                e.stopPropagation();
                vscodeApi.postMessage({ type: 'rejectFilterSuggestion', id: reject.dataset.sid });
                return;
            }
        });
    }

    /* Fu7 time-window filter chips — clicking a chip sets the active window and re-renders.
       The chip set is small (4 buttons) so we wire each rather than using event delegation. */
    var twChips = document.querySelectorAll('.signal-tw-chip');
    for (var ti = 0; ti < twChips.length; ti++) {
        (function(chip) {
            chip.addEventListener('click', function() {
                var v = chip.getAttribute('data-tw');
                signalsInLogWindowMs = (v === 'all') ? null : parseInt(v, 10);
                /* Update visual pressed state on all chips, not just the clicked one,
                   so the previous active chip drops its active class in the same frame. */
                for (var ci = 0; ci < twChips.length; ci++) {
                    var other = twChips[ci];
                    var isActive = (other === chip);
                    other.classList.toggle('signal-tw-chip-active', isActive);
                    other.setAttribute('aria-pressed', isActive ? 'true' : 'false');
                }
                if (typeof renderSignalsInThisLog === 'function') renderSignalsInThisLog();
            });
        })(twChips[ti]);
    }

    /** Render co-occurring signal pairs in the "Related signals" block. */
    function renderCoOccurrences() {
        var blockEl = document.getElementById('signal-cooccurrence-block');
        var listEl = document.getElementById('signal-cooccurrence-list');
        var summaryEl = document.getElementById('signal-cooccurrence-summary');
        var pairs = signalDataCache.coOccurrences || [];
        if (!blockEl || !listEl) return;
        if (pairs.length === 0) { blockEl.style.display = 'none'; return; }
        blockEl.style.display = '';
        if (summaryEl) summaryEl.textContent = 'Related signals (' + pairs.length + ' pair' + (pairs.length === 1 ? '' : 's') + ')';
        listEl.innerHTML = pairs.map(function(p) {
            var pct = Math.round(p.jaccard * 100);
            var lA = p.labelA.length > 40 ? p.labelA.slice(0, 37) + '...' : p.labelA;
            var lB = p.labelB.length > 40 ? p.labelB.slice(0, 37) + '...' : p.labelB;
            return '<div class="signal-env-row signal-cooccurrence-row" title="' + esc(p.labelA) + ' and ' + esc(p.labelB) + ' co-occur in ' + p.sharedSessions + ' sessions">'
                + '<span>\\uD83D\\uDD17 ' + esc(lA) + ' \\u2194 ' + esc(lB) + '</span>'
                + '<span class="signal-hotfile-meta">' + p.sharedSessions + ' shared, ' + pct + '% overlap</span></div>';
        }).join('');
    }
`;
}

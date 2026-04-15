/**
 * Signal panel script part D: signal trend click handler.
 * Clicking a signal trend row opens the most recent session with that signal type.
 * Split from part C because that file is at the 300-line limit.
 */

/** Returns JS that attaches click handlers to signal trend rows and add-to-case buttons. */
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
            /* Add-to-case "+" button on signal rows — sends signal payload to case system */
            var addBtn = e.target.closest('.re-add-to-case-signal');
            if (addBtn && addBtn.dataset.kind) {
                e.stopPropagation();
                vscodeApi.postMessage({
                    type: 'addSignalItemToCase',
                    payload: { type: 'signal', kind: addBtn.dataset.kind, label: addBtn.dataset.label || '', detail: addBtn.dataset.detail || '', fingerprint: addBtn.dataset.fp || '' }
                });
                return;
            }
            /* Triage action (Close/Mute/Re-open) on error/warning signal rows */
            var triageBtn = e.target.closest('.re-action[data-hash]');
            if (triageBtn && triageBtn.dataset.hash && triageBtn.dataset.status) {
                e.stopPropagation();
                vscodeApi.postMessage({ type: 'setRecurringErrorStatus', hash: triageBtn.dataset.hash, status: triageBtn.dataset.status });
                return;
            }
            /* Row click — open the most recent session with this signal type */
            var row = e.target.closest('.signal-trend-row');
            if (!row || !row.dataset.signalType) { return; }
            e.stopPropagation();
            vscodeApi.postMessage({ type: 'openSessionForSignalType', signalType: row.dataset.signalType });
        });
    }

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
        });
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

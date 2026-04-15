/**
 * Insight panel script part D: signal trend click handler.
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
            /* Row click — open the most recent session with this signal type */
            var row = e.target.closest('.insight-signal-trend-row');
            if (!row || !row.dataset.signalType) { return; }
            e.stopPropagation();
            vscodeApi.postMessage({ type: 'openSessionForSignalType', signalType: row.dataset.signalType });
        });
    }
`;
}

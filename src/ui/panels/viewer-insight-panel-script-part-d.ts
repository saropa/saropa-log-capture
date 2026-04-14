/**
 * Insight panel script part D: signal trend click handler.
 * Clicking a signal trend row opens the most recent session with that signal type.
 * Split from part C because that file is at the 300-line limit.
 */

/** Returns JS that attaches a click handler to signal trend rows. */
export function getInsightScriptPartD(): string {
    return /* js */ `
    /* Signal trend rows — click to open the most recent session with this signal type */
    var signalTrendsEl = document.getElementById('insight-signal-trends-list');
    if (signalTrendsEl) {
        signalTrendsEl.addEventListener('click', function(e) {
            var row = e.target.closest('.insight-signal-trend-row');
            if (!row || !row.dataset.signalType) { return; }
            e.stopPropagation();
            vscodeApi.postMessage({ type: 'openSessionForSignalType', signalType: row.dataset.signalType });
        });
    }
`;
}

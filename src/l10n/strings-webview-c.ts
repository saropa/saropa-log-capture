/**
 * Client-side (webview) strings, part C — additional `vt()` keys for the in-viewer panels
 * (error-rate tab, signal panel scripts, performance tabs). Merged into the host `strings` map AND
 * the `__VT` client map in ../l10n.ts. Placeholders `{0}` are substituted client-side by vt().
 *
 * Pluralization uses the crude `(s)` style on purpose: vt() does positional substitution only (no
 * ICU), and these are compact count fragments where a single whole-string catalog value is preferred
 * over branching keys.
 */
export const stringsWebviewC: Record<string, string> = {
    // Error-rate tab summary + tooltip
    'viewer.errorRate.errors': '{0} error(s)',
    'viewer.errorRate.warnings': '{0} warning(s)',
    'viewer.errorRate.spikes': '{0} spike(s)',
    'viewer.errorRate.tooltipAt': '{0} at {1}',

    // Signal panel — suggestion / in-log / recurring metadata
    'viewer.signalPanel.suggestionImpact': '~{0} lines ({1}%)',
    'viewer.signalPanel.sessionMeta': '{0} session(s), {1} total',
    'viewer.signalPanel.recurringTitle': 'Recurring in {0} sessions',
    'viewer.signalPanel.heroErrors': 'Errors: {0}',
    'viewer.signalPanel.heroWarnings': 'Warnings: {0}',
    'viewer.signalPanel.avg': ', avg {0}',
    'viewer.signalPanel.max': ', max {0}',

    // Analysis panel progress (the analysis panel now has the __VT map injected)
    'viewer.analysis.progress': 'Analyzing... {0}/{1} complete',

    // Signal panel — co-occurrence rows
    'viewer.signal.cooccurTitle': '{0} and {1} co-occur in {2} sessions',
    'viewer.signal.cooccurMeta': '{0} shared, {1}% overlap',

    // Performance tabs
    'viewer.perf.framesStats': 'Worst: {0} frames · Total: {1} frames',
    'viewer.perf.memStats': 'Avg: {0}ms · Freed: {1}',
    'viewer.perf.system': '{0} CPUs, {1} MB RAM ({2} MB free)',
    'viewer.perf.notRecorded': 'Not recorded for this log.',
    'viewer.perf.none': 'None.',
    'viewer.perf.process': '; process: {0} MB',
    'viewer.perf.samples': '{0} samples in {1}. Use "Open log folder" to view.',
};

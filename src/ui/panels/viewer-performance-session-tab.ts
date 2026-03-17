/**
 * Session tab script for the performance panel (setSessionTabLoading, renderSessionData).
 * Inlined into the same IIFE as viewer-performance-panel so ppSnapshot, ppSessionView, etc. are in scope.
 */
export function getPerformanceSessionTabScript(): string {
  return `
    function setSessionTabLoading(loading) {
        var ppSnapshot = document.getElementById('pp-snapshot');
        var ppSamples = document.getElementById('pp-samples');
        var ppProfiler = document.getElementById('pp-profiler');
        var msg = loading ? 'Loading\\u2026' : '';
        if (ppSnapshot && loading) ppSnapshot.textContent = msg;
        if (ppSamples && loading) ppSamples.textContent = msg;
        if (ppProfiler && loading) ppProfiler.textContent = msg;
    }

    function renderSessionData(sessionData) {
        var ppIntro = document.getElementById('pp-session-intro');
        var ppSnapshot = document.getElementById('pp-snapshot');
        var ppSamples = document.getElementById('pp-samples');
        var ppProfiler = document.getElementById('pp-profiler');
        var snap = sessionData && sessionData.snapshot;
        var hasData = snap && typeof snap === 'object';
        if (ppIntro) ppIntro.style.display = hasData ? 'none' : 'block';
        if (ppSnapshot) {
            if (hasData) {
                var s = snap;
                var txt = s.cpus + ' CPUs, ' + (s.totalMemMb || 0) + ' MB RAM (' + (s.freeMemMb || 0) + ' MB free)';
                if (s.processMemMb != null) txt += '; process: ' + s.processMemMb + ' MB';
                ppSnapshot.textContent = txt;
            } else {
                ppSnapshot.textContent = 'Not recorded for this log.';
            }
        }
        if (ppSamples) {
            if (sessionData && sessionData.samplesFile && sessionData.sampleCount != null) {
                ppSamples.textContent = sessionData.sampleCount + ' samples in ' + sessionData.samplesFile + '. Use "Open log folder" to view.';
            } else {
                ppSamples.textContent = 'Not recorded for this log.';
            }
        }
        if (ppProfiler) {
            ppProfiler.textContent = 'None.';
        }
    }
`;
}

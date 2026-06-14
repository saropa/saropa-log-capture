/**
 * Session tab script for the performance panel (setSessionTabLoading, renderSessionData).
 * Inlined into the same IIFE as viewer-performance-panel so ppSnapshot, ppSessionView, etc. are in scope.
 */
export function getPerformanceSessionTabScript(): string {
  return `
    function setSessionTabLoading(loading) {
        var ppSnapshot = document.getElementById(ppIdPrefix + 'pp-snapshot');
        var ppSamples = document.getElementById(ppIdPrefix + 'pp-samples');
        var ppProfiler = document.getElementById(ppIdPrefix + 'pp-profiler');
        var msg = loading ? 'Loading\\u2026' : '';
        if (ppSnapshot && loading) ppSnapshot.textContent = msg;
        if (ppSamples && loading) ppSamples.textContent = msg;
        if (ppProfiler && loading) ppProfiler.textContent = msg;
    }

    function renderSessionData(sessionData) {
        var ppIntro = document.getElementById(ppIdPrefix + 'pp-session-intro');
        var ppSnapshot = document.getElementById(ppIdPrefix + 'pp-snapshot');
        var ppSamples = document.getElementById(ppIdPrefix + 'pp-samples');
        var ppProfiler = document.getElementById(ppIdPrefix + 'pp-profiler');
        var snap = sessionData && sessionData.snapshot;
        var hasData = snap && typeof snap === 'object';
        if (ppIntro) ppIntro.style.display = hasData ? 'none' : 'block';
        if (ppSnapshot) {
            if (hasData) {
                var s = snap;
                var txt = vt('viewer.perf.system', s.cpus, (s.totalMemMb || 0), (s.freeMemMb || 0));
                if (s.processMemMb != null) txt += vt('viewer.perf.process', s.processMemMb);
                ppSnapshot.textContent = txt;
            } else {
                ppSnapshot.textContent = vt('viewer.perf.notRecorded');
            }
        }
        if (ppSamples) {
            if (sessionData && sessionData.samplesFile && sessionData.sampleCount != null) {
                ppSamples.textContent = vt('viewer.perf.samples', sessionData.sampleCount, sessionData.samplesFile);
            } else {
                ppSamples.textContent = vt('viewer.perf.notRecorded');
            }
        }
        if (ppProfiler) {
            ppProfiler.textContent = vt('viewer.perf.none');
        }
    }
`;
}

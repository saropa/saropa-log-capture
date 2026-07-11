/**
 * Run navigation: Prev run / Next run within a single log (launch, hot restart/reload).
 */
import { t } from '../../l10n';
import { getRunAppStartDividerScript } from './viewer-run-app-start-divider';

/** Run nav is rendered inside the session nav bar (same row). Only shown when runStartIndices.length > 1. */
export function getRunNavHtml(): string {
    return /* html */ `
<div id="run-nav">
    <span class="nav-bar-sep" aria-hidden="true">|</span>
    <button id="run-prev" type="button" title="${t('viewer.runNav.prev.title')}" disabled>&#x25C0; ${t('viewer.runNav.prev')}</button>
    <span class="nav-bar-label" title="${t('viewer.runNav.pos.title')}">${t('viewer.runNav.run')} <span id="run-current">1</span> ${t('viewer.runNav.of')} <span id="run-total">1</span></span>
    <button id="run-next" type="button" title="${t('viewer.runNav.next.title')}" disabled>${t('viewer.runNav.next')} &#x25B6;</button>
</div>`;
}

export function getRunNavScript(): string {
    // The app-start divider builders are prepended, not imported at runtime: every viewer
    // script is concatenated into one page scope, so insertAppStartMarker() is in scope below.
    return getRunAppStartDividerScript() + /* javascript */ `
var runStartIndices = [];
var runNavEl = document.getElementById('run-nav');
var runPrevBtn = document.getElementById('run-prev');
var runNextBtn = document.getElementById('run-next');
var runCurrentEl = document.getElementById('run-current');
var runTotalEl = document.getElementById('run-total');

/** Resolve current line index from scroll position. Uses prefixSums (O(log n)) when available. */
function getCurrentLineIndexFromScroll() {
    if (!allLines || allLines.length === 0) return 0;
    if (typeof findIndexAtOffset === 'function' && prefixSums && prefixSums.length === allLines.length + 1) {
        return findIndexAtOffset(logEl.scrollTop).index;
    }
    var acc = 0;
    for (var i = 0; i < allLines.length; i++) {
        if (acc + allLines[i].height > logEl.scrollTop) return i;
        acc += allLines[i].height;
    }
    return Math.max(0, allLines.length - 1);
}

function getCurrentRunIndex() {
    if (runStartIndices.length === 0) return 0;
    var lineIdx = getCurrentLineIndexFromScroll();
    var runIdx = 0;
    for (var j = 0; j < runStartIndices.length; j++) {
        if (runStartIndices[j] <= lineIdx) runIdx = j;
    }
    return runIdx;
}

function updateRunNav() {
    if (!runNavEl) return;
    if (runStartIndices.length <= 1) {
        runNavEl.classList.remove('visible');
        return;
    }
    runNavEl.classList.add('visible');
    var total = runStartIndices.length;
    if (runTotalEl) runTotalEl.textContent = total;
    var current = getCurrentRunIndex() + 1;
    if (runCurrentEl) runCurrentEl.textContent = current;
    if (runPrevBtn) runPrevBtn.disabled = current <= 1;
    if (runNextBtn) runNextBtn.disabled = current >= total;
}

function scrollToRunIndex(runIdx) {
    if (runIdx < 0 || runIdx >= runStartIndices.length || typeof scrollToLineNumber !== 'function') return;
    var lineNum = runIdx > 0 ? runStartIndices[runIdx] : 1;
    scrollToLineNumber(lineNum);
    updateRunNav();
}

var RUN_SEPARATOR_HEIGHT = 72;

function formatRunTime(ms) {
    if (!ms) return '--:--:--';
    var d = new Date(ms);
    return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}

function formatDuration(ms) {
    if (ms < 1000) return ms + 'ms';
    if (ms < 60000) return Math.round(ms / 1000) + 's';
    var m = Math.floor(ms / 60000);
    var s = Math.round((ms % 60000) / 1000);
    return s > 0 ? m + 'm ' + s + 's' : m + 'm';
}

/** Insert run-separator rows before each run (except the first). Single-pass to avoid O(N*R) splices. */
function insertRunSeparators(runSummaries) {
    if (!runSummaries || runSummaries.length <= 1 || !allLines || allLines.length === 0) return;
    var indices = runStartIndices.slice();
    var nextRunIdx = 1;
    var newLines = [];
    for (var i = 0; i < allLines.length; i++) {
        while (nextRunIdx < indices.length && indices[nextRunIdx] === i) {
            var summary = runSummaries[nextRunIdx];
            newLines.push({
                type: 'run-separator',
                height: RUN_SEPARATOR_HEIGHT,
                runSummary: summary,
                runIndex: nextRunIdx,
                groupId: -1,
                category: '',
                timestamp: 0
            });
            totalHeight += RUN_SEPARATOR_HEIGHT;
            runStartIndices[nextRunIdx] = newLines.length;
            nextRunIdx++;
        }
        newLines.push(allLines[i]);
    }
    allLines.length = 0;
    for (var k = 0; k < newLines.length; k++) allLines.push(newLines[k]);
    if (typeof buildPrefixSums === 'function') buildPrefixSums();
}

function handleRunBoundaries(msg) {
    runStartIndices = msg.runStartIndices || [];
    var runSummaries = msg.runSummaries;
    var launchIdx = firstLaunchLineIndex(msg.boundaries);
    /* Hand the launch line to the Trouble chart BEFORE the marker splice shifts indices, so the
       chart's app-start boundary is the very line the green divider anchors to — one source of
       truth for "where the app started", which the chart's parallel webview scan could not
       guarantee (it drifted to 0 in the field, charting the whole pre-app device backlog). */
    if (typeof setTroubleChartHostLaunchTs === 'function') setTroubleChartHostLaunchTs(launchIdx);
    /* App-start divider first (shifts runStartIndices), then the between-run separators. */
    if (allLines && allLines.length > 0) insertAppStartMarker(launchIdx);
    if (runSummaries && runSummaries.length > 1 && allLines && allLines.length > 0) insertRunSeparators(runSummaries);
    updateRunNav();
    if (typeof renderViewport === 'function') renderViewport(true);
    /* Re-render the chart so it adopts the host boundary just set (no-op while the mode is off). */
    if (typeof scheduleTroubleChartUpdate === 'function') scheduleTroubleChartUpdate();
}

function clearRunNav() {
    runStartIndices = [];
    if (runNavEl) runNavEl.classList.remove('visible');
}

if (runPrevBtn) runPrevBtn.addEventListener('click', function() {
    var runIdx = getCurrentRunIndex();
    if (runIdx > 0) scrollToRunIndex(runIdx - 1);
});
if (runNextBtn) runNextBtn.addEventListener('click', function() {
    var runIdx = getCurrentRunIndex();
    if (runIdx < runStartIndices.length - 1) scrollToRunIndex(runIdx + 1);
});
logEl.addEventListener('scroll', function() {
    if (runStartIndices.length > 1 && runNavEl && runNavEl.classList.contains('visible')) updateRunNav();
});
`;
}

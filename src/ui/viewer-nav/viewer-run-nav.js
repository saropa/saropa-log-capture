"use strict";
/**
 * Run navigation: Prev run / Next run within a single log (launch, hot restart/reload).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRunNavHtml = getRunNavHtml;
exports.getRunNavScript = getRunNavScript;
/** Run nav is rendered inside the session nav bar (same row). Only shown when runStartIndices.length > 1. */
function getRunNavHtml() {
    return /* html */ `
<div id="run-nav">
    <span class="nav-bar-sep" aria-hidden="true">|</span>
    <button id="run-prev" type="button" title="Previous run (launch/hot restart/reload)" disabled>&#x25C0; Prev</button>
    <span class="nav-bar-label">Run <span id="run-current">1</span> of <span id="run-total">1</span></span>
    <button id="run-next" type="button" title="Next run" disabled>Next &#x25B6;</button>
</div>`;
}
function getRunNavScript() {
    return /* javascript */ `
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
    if (runSummaries && runSummaries.length > 1 && allLines && allLines.length > 0) insertRunSeparators(runSummaries);
    updateRunNav();
    if (typeof renderViewport === 'function') renderViewport(true);
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
//# sourceMappingURL=viewer-run-nav.js.map
/**
 * Run navigation: Prev run / Next run within a single log (launch, hot restart/reload).
 */

export function getRunNavHtml(): string {
    return /* html */ `
<div id="run-nav">
    <button id="run-prev" type="button" title="Previous run (launch/hot restart/reload)" disabled>&#x25C0; Prev</button>
    <span class="nav-bar-label">Run <span id="run-current">1</span> of <span id="run-total">1</span></span>
    <button id="run-next" type="button" title="Next run" disabled>Next &#x25B6;</button>
</div>`;
}

export function getRunNavScript(): string {
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
    var lineIndex = runStartIndices[runIdx];
    scrollToLineNumber(lineIndex + 1);
    updateRunNav();
}

function handleRunBoundaries(msg) {
    runStartIndices = msg.runStartIndices || [];
    updateRunNav();
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

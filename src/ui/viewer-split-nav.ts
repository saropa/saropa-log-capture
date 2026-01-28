/**
 * Client-side JavaScript for split file navigation breadcrumb.
 */
export function getSplitNavScript(): string {
    return /* javascript */ `
var splitBreadcrumb = document.getElementById('split-breadcrumb');
var splitCurrentEl = document.getElementById('split-current');
var splitTotalEl = document.getElementById('split-total');
var splitPrevBtn = document.getElementById('split-prev');
var splitNextBtn = document.getElementById('split-next');

var currentPart = 1;
var totalParts = 1;

function updateSplitInfo(part, total) {
    currentPart = part;
    totalParts = total;

    if (total <= 1) {
        splitBreadcrumb.classList.remove('visible');
        return;
    }

    splitBreadcrumb.classList.add('visible');
    splitCurrentEl.textContent = part;
    splitTotalEl.textContent = total;
    splitPrevBtn.disabled = part <= 1;
    splitNextBtn.disabled = part >= total;
}

splitPrevBtn.addEventListener('click', function() {
    if (currentPart > 1) {
        vscodeApi.postMessage({ type: 'navigatePart', part: currentPart - 1 });
    }
});

splitNextBtn.addEventListener('click', function() {
    if (currentPart < totalParts) {
        vscodeApi.postMessage({ type: 'navigatePart', part: currentPart + 1 });
    }
});

// Handle split info message from extension
// This is called from the main message handler
function handleSplitInfo(msg) {
    updateSplitInfo(msg.currentPart || 1, msg.totalParts || 1);
}
`;
}

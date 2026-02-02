/**
 * Client-side JavaScript for keyword watch counter display in the log viewer.
 * Shows watch hit counts as colored chips in the viewer footer.
 * Concatenated into the same script scope as viewer-script.ts.
 */
export function getWatchScript(): string {
    return /* javascript */ `
var watchCountsEl = document.getElementById('watch-counts');
var watchCounts = {};

function updateWatchDisplay() {
    if (!watchCountsEl) return;
    var parts = [];
    for (var label in watchCounts) {
        if (watchCounts[label] > 0) {
            var cls = label.toLowerCase().indexOf('error') >= 0 || label.toLowerCase().indexOf('exception') >= 0
                ? 'watch-chip watch-error' : 'watch-chip watch-warn';
            var safe = label.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
            parts.push('<span class="' + cls + '" data-keyword="' + safe + '" title="Click to search">' + label + ': ' + watchCounts[label] + '</span>');
        }
    }
    watchCountsEl.innerHTML = parts.join('');
    var chips = watchCountsEl.querySelectorAll('.watch-chip');
    for (var ci = 0; ci < chips.length; ci++) {
        chips[ci].addEventListener('click', onWatchChipClick);
    }
}

/** Open search panel pre-filled with the clicked watch keyword. */
function onWatchChipClick(e) {
    e.stopPropagation();
    var keyword = e.currentTarget.getAttribute('data-keyword');
    if (!keyword) return;
    if (typeof searchOpen !== 'undefined' && !searchOpen) {
        if (typeof setActivePanel === 'function') { setActivePanel('search'); }
        else if (typeof openSearch === 'function') { openSearch(); }
    }
    if (typeof searchInputEl !== 'undefined' && searchInputEl) {
        searchInputEl.value = keyword;
        searchInputEl.focus();
        if (typeof updateClearButton === 'function') updateClearButton();
        if (typeof updateSearch === 'function') updateSearch();
    }
}

function handleUpdateWatchCounts(msg) {
    if (msg.counts) {
        var prev = watchCounts;
        watchCounts = msg.counts;
        updateWatchDisplay();
        for (var label in msg.counts) {
            if (msg.counts[label] > (prev[label] || 0)) {
                flashWatch(label);
            }
        }
    }
}

function flashWatch(label) {
    if (!watchCountsEl) return;
    var chips = watchCountsEl.querySelectorAll('.watch-chip');
    for (var i = 0; i < chips.length; i++) {
        if (chips[i].textContent.indexOf(label) >= 0) {
            chips[i].classList.remove('flash');
            void chips[i].offsetWidth;
            chips[i].classList.add('flash');
        }
    }
}
`;
}

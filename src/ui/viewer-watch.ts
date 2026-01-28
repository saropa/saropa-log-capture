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
            parts.push('<span class="' + cls + '">' + label + ': ' + watchCounts[label] + '</span>');
        }
    }
    watchCountsEl.innerHTML = parts.join('');
}

function handleUpdateWatchCounts(msg) {
    if (msg.counts) {
        watchCounts = msg.counts;
        updateWatchDisplay();
    }
}
`;
}

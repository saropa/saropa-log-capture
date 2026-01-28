/**
 * Client-side JavaScript for elapsed time display in the log viewer.
 * Shows +Nms / +N.Ns prefix on each line relative to the previous line.
 * Concatenated into the same script scope as viewer-script.ts.
 */
export function getTimingScript(): string {
    return /* javascript */ `
var showElapsed = false;

function formatElapsed(ms) {
    if (ms < 0) return '';
    if (ms < 1000) return '+' + ms + 'ms';
    if (ms < 10000) return '+' + (ms / 1000).toFixed(1) + 's';
    return '+' + Math.round(ms / 1000) + 's';
}

function getElapsedPrefix(item, idx) {
    if (!showElapsed || !item.timestamp) return '';
    if (idx === 0) return '<span class="elapsed-time">+0ms</span> ';
    var prev = null;
    for (var i = idx - 1; i >= 0; i--) {
        if (allLines[i].timestamp) { prev = allLines[i]; break; }
    }
    if (!prev) return '<span class="elapsed-time">+0ms</span> ';
    var elapsed = item.timestamp - prev.timestamp;
    return '<span class="elapsed-time">' + formatElapsed(elapsed) + '</span> ';
}

function handleSetShowElapsed(msg) {
    showElapsed = !!msg.show;
    renderViewport(true);
}
`;
}

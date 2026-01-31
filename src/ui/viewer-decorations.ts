/**
 * Client-side JavaScript for log line decoration prefixes in the viewer.
 * Adds colored severity dots, sequential counter, and timestamps
 * as a visual prefix on each line. Viewer-only; does not modify log files.
 *
 * Concatenated into the same script scope as viewer-script.ts.
 */
export function getDecorationsScript(): string {
    return /* javascript */ `
var showDecorations = false;

/** Map log level to a colored dot emoji. */
function getLevelDot(level) {
    if (level === 'error') return '\\ud83d\\udd34';
    if (level === 'warning') return '\\ud83d\\udfe0';
    return '\\ud83d\\udfe2';
}

/** Format epoch ms to T07:23:36. */
function formatDecoTimestamp(ts) {
    if (!ts) return '';
    var d = new Date(ts);
    var h = ('0' + d.getHours()).slice(-2);
    var m = ('0' + d.getMinutes()).slice(-2);
    var s = ('0' + d.getSeconds()).slice(-2);
    return 'T' + h + ':' + m + ':' + s;
}

/**
 * Build the decoration prefix HTML for a log line.
 * Format: [dot]  #N T07:23:36  \\u00BB content
 */
function getDecorationPrefix(item) {
    if (!showDecorations) return '';
    if (!item || item.type === 'marker' || item.type === 'stack-frame') return '';
    var dot = getLevelDot(item.level || 'info');
    var seq = item.seq !== undefined ? item.seq : '?';
    var ts = formatDecoTimestamp(item.timestamp);
    return '<span class="line-decoration">'
        + dot + '&nbsp; #' + seq
        + ' ' + ts + '&nbsp; \\u00BB '
        + '</span>';
}

function handleSetShowDecorations(msg) {
    showDecorations = !!msg.show;
    var btn = document.getElementById('deco-toggle');
    if (btn) btn.textContent = showDecorations ? 'Deco: ON' : 'Deco: OFF';
    renderViewport(true);
}

function toggleDecorations() {
    showDecorations = !showDecorations;
    var btn = document.getElementById('deco-toggle');
    if (btn) btn.textContent = showDecorations ? 'Deco: ON' : 'Deco: OFF';
    renderViewport(true);
}
`;
}

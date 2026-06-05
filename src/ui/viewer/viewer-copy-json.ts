/**
 * Client-side JavaScript for structured JSON copy in the log viewer.
 * Concatenated into the same script scope as viewer-copy.ts (so it can call
 * lineToPlainText / getSelectedLines / getVisibleLines / showCopyToast from there).
 * Powers the default Ctrl+C (copyJson action) and the top "Copy to JSON" menu item.
 */
export function getCopyJsonScript(): string {
    return /* javascript */ `
/* Structured JSON copy (default Ctrl+C + top "Copy to JSON" menu item). One object per
   line carrying the fields a downstream tool actually needs to triage — line number,
   wall-clock timestamp, severity, category, parsed tag, stream source — plus the plain
   text. Only populated fields are emitted (a print() line has no tag/level prefix), so
   the JSON stays readable instead of a wall of nulls. 'line' is the 1-based viewer row
   (viewerLineIndex) so it matches the counter column the user sees, not the internal
   allLines index. text reuses lineToPlainText so collapsed SQL-repeat rows expand the
   same way they do for every other copy path. */
function lineToJsonObject(item, idx) {
    var obj = {};
    obj.line = (item.viewerLineIndex != null ? item.viewerLineIndex : idx) + 1;
    if (item.timestamp) {
        try { obj.timestamp = new Date(item.timestamp).toISOString(); } catch (_e) { /* unparseable ts: omit */ }
    }
    if (item.level) obj.level = item.level;
    if (item.category) obj.category = item.category;
    var tag = item.sourceTag || item.logcatTag || item.parsedTag;
    if (tag) obj.tag = tag;
    if (item.source) obj.source = item.source;
    obj.text = lineToPlainText(item);
    return obj;
}

function linesToJson(lines) {
    var arr = [];
    for (var i = 0; i < lines.length; i++) arr.push(lineToJsonObject(lines[i], i));
    return JSON.stringify(arr, null, 2);
}

function postLinesAsJson(lines) {
    if (lines.length === 0) return;
    vscodeApi.postMessage({ type: 'copyToClipboard', text: linesToJson(lines) });
    if (typeof showCopyToast === 'function') {
        showCopyToast('Copied ' + lines.length + ' line' + (lines.length === 1 ? '' : 's') + ' as JSON');
    }
}

function copyAsJson() {
    if (selectionStart >= 0) { postLinesAsJson(getSelectedLines()); return; }
    /* Preserve raw drag-select copy: a sub-line native text selection can't be split
       into fields, so emit the literal selected text rather than silently JSON-ifying
       the whole viewport the user never asked for. */
    var nsel = window.getSelection();
    var ntxt = nsel ? nsel.toString() : '';
    if (ntxt.trim()) {
        vscodeApi.postMessage({ type: 'copyToClipboard', text: ntxt });
        if (typeof showCopyToast === 'function') showCopyToast();
        return;
    }
    postLinesAsJson(getVisibleLines());
}
`;
}

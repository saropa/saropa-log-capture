"use strict";
/**
 * Source reference collection helpers for the context menu.
 * These functions gather source-link data from log lines for
 * "Copy with Source" and "Open Source" actions.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getContextMenuSourcesScript = getContextMenuSourcesScript;
/** Get the context menu source-ref collection script. */
function getContextMenuSourcesScript() {
    return /* javascript */ `
function collectSourceRefsFromLinks(links) {
    var seen = {};
    var refs = [];
    for (var i = 0; i < links.length; i++) {
        var a = links[i];
        var path = a.getAttribute('data-path');
        var line = parseInt(a.getAttribute('data-line'), 10);
        if (!path) continue;
        var key = path + ':' + line;
        if (seen[key]) continue;
        seen[key] = true;
        refs.push({ path: path, line: isNaN(line) ? 1 : line });
    }
    return refs;
}

function collectSourceRefsInSelection() {
    var sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return [];
    var range = sel.getRangeAt(0);
    var container = range.commonAncestorContainer;
    var root = container.nodeType === 3 ? container.parentElement : container;
    if (!root || !root.querySelectorAll) return [];
    var links = root.querySelectorAll('.source-link');
    return collectSourceRefsFromLinks(links);
}

function collectSourceRefsForLineRange(lo, hi) {
    var viewport = document.getElementById('viewport');
    if (!viewport) return [];
    var refs = [];
    var seen = {};
    for (var i = lo; i <= hi; i++) {
        var row = viewport.querySelector('[data-idx="' + i + '"]');
        if (!row) continue;
        var links = row.querySelectorAll('.source-link');
        for (var j = 0; j < links.length; j++) {
            var a = links[j];
            var path = a.getAttribute('data-path');
            var line = parseInt(a.getAttribute('data-line'), 10);
            if (!path) continue;
            var key = path + ':' + line;
            if (seen[key]) continue;
            seen[key] = true;
            refs.push({ path: path, line: isNaN(line) ? 1 : line });
        }
    }
    return refs;
}
`;
}
//# sourceMappingURL=viewer-context-menu-sources.js.map
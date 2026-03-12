/**
 * Context menu action handlers and event dispatcher.
 * Processes copy, search, toggle, and line-specific actions
 * triggered from the right-click context menu.
 */

/** Get the context menu action handler script. */
export function getContextMenuActionsScript(): string {
    return /* javascript */ `
function handleGlobalAction(action) {
    if (action === 'copy-selection') {
        var sel = window.getSelection();
        var text = sel ? sel.toString() : '';
        if (text.length > 0) vscodeApi.postMessage({ type: 'copyToClipboard', text: text });
        return true;
    }
    if (action === 'copy-with-source') {
        var sel = window.getSelection();
        var text = sel ? sel.toString() : '';
        var refs = collectSourceRefsInSelection();
        if (text.length > 0 || refs.length > 0) vscodeApi.postMessage({ type: 'copyWithSource', text: text, sourceRefs: refs });
        return true;
    }
    if (action === 'copy-all') {
        if (typeof copyAllToClipboard === 'function') copyAllToClipboard();
        return true;
    }
    if (action === 'copy-all-decorated') {
        if (typeof copyAllDecorated === 'function') copyAllDecorated();
        return true;
    }
    if (action === 'copy-as-snippet') {
        if (typeof copyAsSnippet === 'function') copyAsSnippet();
        return true;
    }
    if (action === 'select-all') {
        var vp = document.getElementById('viewport');
        if (vp) {
            var range = document.createRange();
            range.selectNodeContents(vp);
            var selection = window.getSelection();
            if (selection) { selection.removeAllRanges(); selection.addRange(range); }
        }
        return true;
    }
    if (action === 'export-current-view') {
        if (typeof window.openExportModal === 'function') window.openExportModal();
        return true;
    }
    return false;
}

function handleSourceAction(action) {
    if (!contextMenuSourcePath) return false;
    if (action === 'open-source-link') {
        vscodeApi.postMessage({
            type: 'linkClicked', path: contextMenuSourcePath,
            line: parseInt(contextMenuSourceLine, 10), col: parseInt(contextMenuSourceCol, 10),
            splitEditor: false,
        });
        return true;
    }
    if (action === 'copy-relative-path') {
        vscodeApi.postMessage({ type: 'copySourcePath', path: contextMenuSourcePath, mode: 'relative' });
        return true;
    }
    if (action === 'copy-full-path') {
        vscodeApi.postMessage({ type: 'copySourcePath', path: contextMenuSourcePath, mode: 'full' });
        return true;
    }
    return false;
}

/** Handle toggle actions (Options submenu) — keep menu open. */
function handleToggleAction(action) {
    var toggleFns = {
        'toggle-wrap': typeof toggleWrap === 'function' ? toggleWrap : null,
        'toggle-decorations': typeof toggleDecorations === 'function' ? toggleDecorations : null,
        'toggle-spacing': typeof toggleVisualSpacing === 'function' ? toggleVisualSpacing : null,
        'toggle-line-height': typeof toggleLineHeightMode === 'function' ? toggleLineHeightMode : null,
        'toggle-hide-blank-lines': typeof toggleHideBlankLines === 'function' ? toggleHideBlankLines : null,
    };
    var fn = toggleFns[action];
    if (!fn) return false;
    fn();
    syncContextMenuToggles();
    if (typeof syncOptionsPanelUi === 'function') syncOptionsPanelUi();
    return true;
}

function onContextMenuAction(action) {
    // Toggle actions keep menu open — handle before hideContextMenu
    if (handleToggleAction(action)) return;

    var lineIdx = contextMenuLineIdx;
    hideContextMenu();

    if (handleGlobalAction(action)) return;
    if (handleSourceAction(action)) return;
    if (lineIdx < 0 || lineIdx >= allLines.length) return;

    var lineData = allLines[lineIdx];
    var plainText = stripTags(lineData.html || '');

    switch (action) {
        case 'copy': {
            /* When multiple lines are selected (shift+click) and right-click is inside that range, copy all selected full lines; else copy single line. */
            var start = typeof selectionStart !== 'undefined' ? selectionStart : -1;
            var end = typeof selectionEnd !== 'undefined' ? selectionEnd : -1;
            var lo = Math.min(start, end);
            var hi = Math.max(start, end);
            var multiLine = start >= 0 && hi > lo && lineIdx >= lo && lineIdx <= hi;
            if (multiLine && typeof getSelectedLines === 'function' && typeof linesToPlainText === 'function') {
                var lines = getSelectedLines();
                var text = lines.length > 0 ? linesToPlainText(lines) : plainText;
                vscodeApi.postMessage({ type: 'copyToClipboard', text: text });
            } else {
                vscodeApi.postMessage({ type: 'copyToClipboard', text: plainText });
            }
            break;
        }
        case 'copy-with-source': {
            var start = typeof selectionStart !== 'undefined' ? selectionStart : -1;
            var end = typeof selectionEnd !== 'undefined' ? selectionEnd : -1;
            var lo = Math.min(start, end);
            var hi = Math.max(start, end);
            var baseLo = lo >= 0 ? lo : lineIdx;
            var baseHi = hi > lo ? hi : lineIdx;
            /* Include N lines before/after selection (copyContextLines) for stack traces and surrounding context. */
            var n = typeof copyContextLines === 'number' ? Math.max(0, Math.min(20, copyContextLines)) : 0;
            var loExpand = Math.max(0, baseLo - n);
            var hiExpand = Math.min(allLines.length - 1, baseHi + n);
            var parts = [];
            for (var i = loExpand; i <= hiExpand; i++) {
                var item = allLines[i];
                if (item && item.html != null) parts.push(stripTags(item.html));
            }
            var logText = parts.join('\\n');
            var refs = collectSourceRefsForLineRange(loExpand, hiExpand);
            if (logText.length > 0 || refs.length > 0) vscodeApi.postMessage({ type: 'copyWithSource', text: logText, sourceRefs: refs });
            break;
        }
        case 'copy-to-search':
            if (typeof openSearch === 'function' && typeof searchInputEl !== 'undefined') {
                openSearch();
                searchInputEl.value = plainText;
                if (typeof updateSearch === 'function') updateSearch();
            }
            break;
        case 'search-codebase': vscodeApi.postMessage({ type: 'searchCodebase', text: plainText }); break;
        case 'search-sessions': vscodeApi.postMessage({ type: 'searchSessions', text: plainText }); break;
        case 'analyze-line': vscodeApi.postMessage({ type: 'analyzeLine', text: plainText, lineIndex: lineIdx }); break;
        case 'generate-report': vscodeApi.postMessage({ type: 'generateReport', text: plainText, lineIndex: lineIdx }); break;
        case 'add-watch': vscodeApi.postMessage({ type: 'addToWatch', text: plainText }); break;
        case 'add-exclusion': vscodeApi.postMessage({ type: 'addToExclusion', text: plainText }); break;
        case 'pin': if (typeof togglePin === 'function') togglePin(lineIdx); break;
        case 'annotate': if (typeof promptAnnotation === 'function') promptAnnotation(lineIdx); break;
        case 'bookmark': vscodeApi.postMessage({ type: 'addBookmark', lineIndex: lineIdx, text: plainText }); break;
        case 'open-source':
            var viewport = document.getElementById('viewport');
            if (viewport) {
                var lineEl = viewport.querySelector('[data-idx="' + lineIdx + '"] .source-link');
                if (lineEl) lineEl.click();
            }
            break;
        case 'edit': if (typeof openEditModal === 'function') openEditModal(lineIdx); break;
        case 'show-context': if (typeof openContextModal === 'function') openContextModal(lineIdx); break;
        case 'show-integration-context': {
            var ts = lineData.ts || lineData.timestamp;
            vscodeApi.postMessage({ type: 'showIntegrationContext', lineIndex: lineIdx, timestamp: ts });
            break;
        }
    }
}

function onLogContextMenu(e) {
    e.preventDefault();
    var sourceLink = e.target.closest('.source-link');
    var target = e.target;
    while (target && target !== document.body) {
        if (target.dataset && target.dataset.idx !== undefined) {
            var idx = parseInt(target.dataset.idx, 10);
            if (!isNaN(idx)) { showContextMenu(e.clientX, e.clientY, idx, sourceLink); return; }
        }
        target = target.parentElement;
    }
    showContextMenu(e.clientX, e.clientY, -1, null);
}

var _logEl = document.getElementById('log-content');
if (_logEl) _logEl.addEventListener('contextmenu', onLogContextMenu);

window.addEventListener('message', function(event) {
    var msg = event.data;
    if (msg && msg.type === 'setCopyContextLines' && typeof msg.count === 'number') {
        copyContextLines = Math.max(0, Math.min(20, Math.floor(msg.count)));
    }
});
`;
}

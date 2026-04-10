/**
 * Context menu action handlers and event dispatcher.
 * Processes copy, search, toggle, and line-specific actions
 * triggered from the right-click context menu.
 *
 * Copy/clipboard notes for reviewers:
 * - `copy-selection`: If the browser selection is empty, falls back to the line index from the
 *   right-click (`savedLineIdx`) so Shift+click line highlights (not native selection) still copy.
 * - `copy-with-source`: When the global path has nothing from the selection, returns false so
 *   `onContextMenuAction` can run the line-scoped branch (expanded context + source refs).
 */

import { getContextMenuLineActionsScript } from './viewer-context-menu-line-actions';

/** Get the context menu action handler script. */
export function getContextMenuActionsScript(): string {
    return getContextMenuLineActionsScript() + /* javascript */ String.raw`
function handleGlobalAction(action, savedLineIdx) {
    if (action === 'copy-selection') {
        var sel = window.getSelection();
        var text = sel ? sel.toString() : '';
        if (text.length > 0) {
            vscodeApi.postMessage({ type: 'copyToClipboard', text: text });
            return true;
        }
        /* Native selection is empty: shift+click range uses .selected only — copy like "Copy Line" from saved row. */
        if (typeof savedLineIdx === 'number' && savedLineIdx >= 0 && savedLineIdx < allLines.length) {
            var lineDataCs = allLines[savedLineIdx];
            var plainCs = stripTags(lineDataCs.html || '');
            var sel = getSelectionRange(savedLineIdx);
            var outCs;
            if (sel.multiLine && typeof getSelectedLines === 'function' && typeof linesToPlainText === 'function') {
                var linesCs = getSelectedLines();
                outCs = linesCs.length > 0 ? linesToPlainText(linesCs) : plainCs;
            } else {
                outCs = plainCs;
            }
            vscodeApi.postMessage({ type: 'copyToClipboard', text: outCs });
            return true;
        }
        vscodeApi.postMessage({ type: 'copyToClipboard', text: '' });
        return true;
    }
    if (action === 'copy-with-source') {
        var selWs = window.getSelection();
        var tws = selWs ? selWs.toString() : '';
        var refsWs = collectSourceRefsInSelection();
        if (tws.length > 0 || refsWs.length > 0) {
            vscodeApi.postMessage({ type: 'copyWithSource', text: tws, sourceRefs: refsWs });
            return true;
        }
        return false;
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
    if (action === 'open-drift-advisor') {
        vscodeApi.postMessage({ type: 'openDriftAdvisor' });
        return true;
    }
    if (action === 'hide-text-session') {
        var sel = window.getSelection();
        var text = sel ? sel.toString().trim() : '';
        if (text && typeof addAutoHidePatternSession === 'function') addAutoHidePatternSession(text);
        return true;
    }
    if (action === 'hide-text-always') {
        var sel = window.getSelection();
        var text = sel ? sel.toString().trim() : '';
        if (text && typeof addAutoHidePatternAlways === 'function') addAutoHidePatternAlways(text);
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

/** Workspace-backed toggles (scroll map, scrollbar) — keep menu open; host echoes config. */
function handleWorkspaceToggleAction(action) {
    function postBool(type, value) {
        vscodeApi.postMessage({ type: type, value: value });
        syncContextMenuToggles();
        if (typeof syncOptionsPanelUi === 'function') syncOptionsPanelUi();
    }
    if (action === 'toggle-minimap-proportional') {
        var nextProp = !((typeof minimapProportionalLines !== 'undefined') && minimapProportionalLines);
        minimapProportionalLines = nextProp;
        postBool('setMinimapProportionalLines', nextProp);
        return true;
    }
    if (action === 'toggle-show-scrollbar') {
        var nextSb = !document.body.classList.contains('scrollbar-visible');
        postBool('setShowScrollbar', nextSb);
        return true;
    }
    if (action === 'toggle-minimap-info-markers') {
        var nextInfo = !((typeof minimapShowInfoMarkers !== 'undefined') && minimapShowInfoMarkers);
        minimapShowInfoMarkers = nextInfo;
        postBool('setMinimapShowInfoMarkers', nextInfo);
        return true;
    }
    if (action === 'toggle-minimap-sql-density') {
        var nextSql = !((typeof minimapShowSqlDensity !== 'undefined') && minimapShowSqlDensity);
        if (typeof minimapShowSqlDensity !== 'undefined') minimapShowSqlDensity = nextSql;
        postBool('setMinimapSqlDensity', nextSql);
        return true;
    }
    if (action === 'toggle-minimap-viewport-red-outline') {
        var nextRo = !((typeof minimapViewportRedOutline !== 'undefined') && minimapViewportRedOutline);
        minimapViewportRedOutline = nextRo;
        postBool('setMinimapViewportRedOutline', nextRo);
        return true;
    }
    if (action === 'toggle-minimap-outside-arrow') {
        var nextAr = !((typeof minimapViewportOutsideArrow !== 'undefined') && minimapViewportOutsideArrow);
        minimapViewportOutsideArrow = nextAr;
        postBool('setMinimapViewportOutsideArrow', nextAr);
        return true;
    }
    return false;
}

/** Handle toggle actions (Layout submenu) — keep menu open. */
function handleToggleAction(action) {
    var toggleFns = {
        'toggle-wrap': typeof toggleWrap === 'function' ? toggleWrap : null,
        'toggle-timestamp': typeof toggleTimestamp === 'function' ? toggleTimestamp : null,
        'toggle-session-elapsed': typeof toggleSessionElapsed === 'function' ? toggleSessionElapsed : null,
        'toggle-spacing': typeof toggleVisualSpacing === 'function' ? toggleVisualSpacing : null,
        'toggle-line-height': typeof toggleLineHeightMode === 'function' ? toggleLineHeightMode : null,
        'toggle-hide-blank-lines': typeof toggleHideBlankLines === 'function' ? toggleHideBlankLines : null,
        'toggle-compress-lines': typeof toggleCompressLines === 'function' ? toggleCompressLines : null,
        'toggle-compress-lines-global': typeof toggleCompressNonConsecutiveLines === 'function' ? toggleCompressNonConsecutiveLines : null,
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
    if (handleWorkspaceToggleAction(action)) return;
    if (handleToggleAction(action)) return;

    var lineIdx = contextMenuLineIdx;
    hideContextMenu();

    if (handleGlobalAction(action, lineIdx)) return;
    if (handleSourceAction(action)) return;
    handleLineAction(action, lineIdx);
}

function onLogContextMenu(e) {
    var lc = e.currentTarget;
    if (lc && lc.id === 'log-content' && document.body.classList.contains('scrollbar-visible')) {
        var sbW = 14;
        if (e.offsetX > lc.clientWidth - sbW) {
            e.preventDefault();
            e.stopPropagation();
            showScrollChromeContextMenu(e.clientX, e.clientY);
            return;
        }
    }
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

function onScrollChromeStripContextMenu(e) {
    e.preventDefault();
    e.stopPropagation();
    showScrollChromeContextMenu(e.clientX, e.clientY);
}
var _mmCol = document.getElementById('scrollbar-minimap-column');
if (_mmCol) _mmCol.addEventListener('contextmenu', onScrollChromeStripContextMenu);
var _mmStrip = document.getElementById('scrollbar-minimap');
if (_mmStrip) _mmStrip.addEventListener('contextmenu', onScrollChromeStripContextMenu);

window.addEventListener('message', function(event) {
    var msg = event.data;
    if (msg && msg.type === 'setCopyContextLines' && typeof msg.count === 'number') {
        copyContextLines = Math.max(0, Math.min(20, Math.floor(msg.count)));
    }
});
`;
}

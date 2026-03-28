"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.getContextMenuActionsScript = getContextMenuActionsScript;
/** Get the context menu action handler script. */
function getContextMenuActionsScript() {
    return /* javascript */ String.raw `
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
            var scStart = typeof selectionStart !== 'undefined' ? selectionStart : -1;
            var scEnd = typeof selectionEnd !== 'undefined' ? selectionEnd : -1;
            var scLo = Math.min(scStart, scEnd);
            var scHi = Math.max(scStart, scEnd);
            var scMulti = scStart >= 0 && scHi > scLo && savedLineIdx >= scLo && savedLineIdx <= scHi;
            var outCs;
            if (scMulti && typeof getSelectedLines === 'function' && typeof linesToPlainText === 'function') {
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
        'toggle-decorations': typeof toggleDecorations === 'function' ? toggleDecorations : null,
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
        case 'create-report-file': {
            var crStart = typeof selectionStart !== 'undefined' ? selectionStart : -1;
            var crEnd = typeof selectionEnd !== 'undefined' ? selectionEnd : -1;
            var crLo = Math.min(crStart, crEnd);
            var crHi = Math.max(crStart, crEnd);
            var crMulti = crStart >= 0 && crHi > crLo && lineIdx >= crLo && lineIdx <= crHi;
            var crSelText, crSelStart, crSelEnd;
            if (crMulti && typeof getSelectedLines === 'function' && typeof linesToPlainText === 'function') {
                var crLines = getSelectedLines();
                crSelText = crLines.length > 0 ? linesToPlainText(crLines) : plainText;
                crSelStart = crLo;
                crSelEnd = crHi;
            } else {
                crSelText = plainText;
                crSelStart = lineIdx;
                crSelEnd = lineIdx;
            }
            var crAllLines = typeof getAllCopyableLines === 'function' ? getAllCopyableLines() : [];
            var crDecorated = typeof linesToDecoratedText === 'function' ? linesToDecoratedText(crAllLines) : '';
            vscodeApi.postMessage({
                type: 'createReportFile',
                selectedText: crSelText,
                selectedLineStart: crSelStart,
                selectedLineEnd: crSelEnd,
                fullDecoratedOutput: crDecorated,
                fullOutputLineCount: crAllLines.length,
                lineIndex: lineIdx,
                text: plainText,
                sessionInfo: typeof sessionInfoData !== 'undefined' ? sessionInfoData : null,
            });
            break;
        }
        case 'explain-with-ai': {
            var start = typeof selectionStart !== 'undefined' ? selectionStart : -1;
            var end = typeof selectionEnd !== 'undefined' ? selectionEnd : -1;
            var lo = Math.min(start, end);
            var hi = Math.max(start, end);
            var multiLine = start >= 0 && hi > lo && lineIdx >= lo && lineIdx <= hi;
            if (multiLine && typeof getSelectedLines === 'function' && typeof linesToPlainText === 'function') {
                var lines = getSelectedLines();
                var selText = lines.length > 0 ? linesToPlainText(lines) : plainText;
                var firstTs = (allLines[lo] && (allLines[lo].ts || allLines[lo].timestamp)) || lineData.ts || lineData.timestamp;
                vscodeApi.postMessage({ type: 'explainWithAi', text: selText, lineIndex: lo, lineEndIndex: hi, timestamp: firstTs });
            } else {
                vscodeApi.postMessage({ type: 'explainWithAi', text: plainText, lineIndex: lineIdx, timestamp: lineData.ts || lineData.timestamp });
            }
            break;
        }
        case 'explain-root-cause-hypotheses':
            if (typeof runTriggerExplainRootCauseHypothesesFromHost === 'function') runTriggerExplainRootCauseHypothesesFromHost();
            break;
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
        case 'find-static-sources-line': {
            var fpLine = lineData.dbInsight && lineData.dbInsight.fingerprint;
            if (fpLine && typeof staticSqlFromFingerprintEnabled !== 'undefined' && staticSqlFromFingerprintEnabled) {
                vscodeApi.postMessage({ type: 'findStaticSourcesForSqlFingerprint', fingerprint: fpLine });
            }
            break;
        }
        case 'show-integration-context': {
            var ts = lineData.ts || lineData.timestamp;
            var hasDbLine = !!(lineData && lineData.sourceTag === 'database');
            vscodeApi.postMessage({ type: 'showIntegrationContext', lineIndex: lineIdx, timestamp: ts, hasDatabaseLine: hasDbLine, lineText: plainText });
            break;
        }
        case 'show-related-queries': {
            var rqTs = lineData.ts || lineData.timestamp;
            vscodeApi.postMessage({ type: 'showRelatedQueries', lineIndex: lineIdx, timestamp: rqTs, lineText: plainText });
            break;
        }
        case 'show-code-quality': {
            if (typeof showPopoverToast === 'function') showPopoverToast('Loading code quality…');
            vscodeApi.postMessage({ type: 'showCodeQualityForFrame', lineIndex: lineIdx, lineText: plainText });
            break;
        }
        case 'hide-line':
            if (typeof hideLine === 'function') hideLine(lineIdx);
            break;
        case 'unhide-line':
            if (typeof unhideLine === 'function') unhideLine(lineIdx);
            break;
        case 'hide-selection':
            if (typeof hideSelection === 'function') hideSelection();
            break;
        case 'unhide-selection':
            if (typeof unhideSelection === 'function') unhideSelection();
            break;
        case 'hide-all-visible':
            if (typeof hideAllVisible === 'function') hideAllVisible();
            break;
        case 'unhide-all':
            if (typeof unhideAll === 'function') unhideAll();
            break;
    }
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
//# sourceMappingURL=viewer-context-menu-actions.js.map
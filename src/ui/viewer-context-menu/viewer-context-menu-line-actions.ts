/**
 * Context menu line-specific action handlers (copy, search, analyze, report, explain, etc.).
 * Handles actions that operate on a specific log line identified by index.
 * Extracted from viewer-context-menu-actions.ts to keep files under the line limit.
 */

/** Get the line-scoped context menu action handler script. */
export function getContextMenuLineActionsScript(): string {
    return /* javascript */ String.raw`
function handleLineAction(action, lineIdx) {
    if (lineIdx < 0 || lineIdx >= allLines.length) return false;

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
            return true;
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
            var logText = parts.join('\n');
            var refs = collectSourceRefsForLineRange(loExpand, hiExpand);
            if (logText.length > 0 || refs.length > 0) vscodeApi.postMessage({ type: 'copyWithSource', text: logText, sourceRefs: refs });
            return true;
        }
        case 'copy-to-search':
            if (typeof openSearch === 'function' && typeof searchInputEl !== 'undefined') {
                openSearch();
                searchInputEl.value = plainText;
                if (typeof updateSearch === 'function') updateSearch();
            }
            return true;
        case 'search-codebase': vscodeApi.postMessage({ type: 'searchCodebase', text: plainText }); return true;
        case 'search-sessions': vscodeApi.postMessage({ type: 'searchSessions', text: plainText }); return true;
        case 'analyze-line': vscodeApi.postMessage({ type: 'analyzeLine', text: plainText, lineIndex: lineIdx }); return true;
        case 'generate-report': vscodeApi.postMessage({ type: 'generateReport', text: plainText, lineIndex: lineIdx }); return true;
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
            return true;
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
            return true;
        }
        case 'explain-root-cause-hypotheses':
            if (typeof runTriggerExplainRootCauseHypothesesFromHost === 'function') runTriggerExplainRootCauseHypothesesFromHost();
            return true;
        case 'add-watch': vscodeApi.postMessage({ type: 'addToWatch', text: plainText }); return true;
        case 'add-exclusion': vscodeApi.postMessage({ type: 'addToExclusion', text: plainText }); return true;
        case 'pin': if (typeof togglePin === 'function') togglePin(lineIdx); return true;
        case 'annotate': if (typeof promptAnnotation === 'function') promptAnnotation(lineIdx); return true;
        case 'bookmark': vscodeApi.postMessage({ type: 'addBookmark', lineIndex: lineIdx, text: plainText }); return true;
        case 'open-source':
            var viewport = document.getElementById('viewport');
            if (viewport) {
                var lineEl = viewport.querySelector('[data-idx="' + lineIdx + '"] .source-link');
                if (lineEl) lineEl.click();
            }
            return true;
        case 'edit': if (typeof openEditModal === 'function') openEditModal(lineIdx); return true;
        case 'show-context': if (typeof openContextModal === 'function') openContextModal(lineIdx); return true;
        case 'find-static-sources-line': {
            var fpLine = lineData.dbInsight && lineData.dbInsight.fingerprint;
            if (fpLine && typeof staticSqlFromFingerprintEnabled !== 'undefined' && staticSqlFromFingerprintEnabled) {
                vscodeApi.postMessage({ type: 'findStaticSourcesForSqlFingerprint', fingerprint: fpLine });
            }
            return true;
        }
        case 'show-integration-context': {
            var ts = lineData.ts || lineData.timestamp;
            var hasDbLine = !!(lineData && lineData.sourceTag === 'database');
            vscodeApi.postMessage({ type: 'showIntegrationContext', lineIndex: lineIdx, timestamp: ts, hasDatabaseLine: hasDbLine, lineText: plainText });
            return true;
        }
        case 'show-related-queries': {
            var rqTs = lineData.ts || lineData.timestamp;
            vscodeApi.postMessage({ type: 'showRelatedQueries', lineIndex: lineIdx, timestamp: rqTs, lineText: plainText });
            return true;
        }
        case 'show-code-quality': {
            if (typeof showPopoverToast === 'function') showPopoverToast('Loading code quality\u2026');
            vscodeApi.postMessage({ type: 'showCodeQualityForFrame', lineIndex: lineIdx, lineText: plainText });
            return true;
        }
        case 'hide-line':
            if (typeof hideLine === 'function') hideLine(lineIdx);
            return true;
        case 'unhide-line':
            if (typeof unhideLine === 'function') unhideLine(lineIdx);
            return true;
        case 'hide-selection':
            if (typeof hideSelection === 'function') hideSelection();
            return true;
        case 'unhide-selection':
            if (typeof unhideSelection === 'function') unhideSelection();
            return true;
        case 'hide-all-visible':
            if (typeof hideAllVisible === 'function') hideAllVisible();
            return true;
        case 'unhide-all':
            if (typeof unhideAll === 'function') unhideAll();
            return true;
    }
    return false;
}
`;
}

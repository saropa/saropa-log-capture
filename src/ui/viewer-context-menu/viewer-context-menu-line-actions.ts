/**
 * Context menu line-specific action handlers (copy, search, analyze, report, explain, etc.).
 * Handles actions that operate on a specific log line identified by index.
 * Extracted from viewer-context-menu-actions.ts to keep files under the line limit.
 *
 * Also defines two shared helpers used by both `handleLineAction` (this file) and
 * `handleGlobalAction` (viewer-context-menu-actions.ts):
 *  - `getSelectionRange()` — shift+click selection bounds relative to a row index.
 *  - `formatCopyToastMessage()` — copy-feedback strings (`Copied line 178 (87 characters)`,
 *    `Copied lines 116-225 (1,247 characters)`, etc.) rendered via `showCopyToast()`.
 *
 * Copy actions on the right-click menu use `sel.multiLine` (right-click is INSIDE the
 * shift-click range) as the SOLE trigger for multi-line copy. A previous `hasAnySel`
 * fallback widened that to "any prior shift-click range" and silently hijacked Copy
 * Line on rows outside the selection — the user right-clicked line 50 to copy line 50
 * but lines 5-10 landed on the clipboard. That fallback is gone.
 */

/** Get the line-scoped context menu action handler script. */
export function getContextMenuLineActionsScript(): string {
    return /* javascript */ String.raw`
/**
 * Return the current shift+click selection range relative to lineIdx.
 * @returns {{ lo: number, hi: number, multiLine: boolean }}
 */
function getSelectionRange(lineIdx) {
    var start = typeof selectionStart !== 'undefined' ? selectionStart : -1;
    var end = typeof selectionEnd !== 'undefined' ? selectionEnd : -1;
    var lo = Math.min(start, end);
    var hi = Math.max(start, end);
    var multiLine = start >= 0 && hi > lo && lineIdx >= lo && lineIdx <= hi;
    return { lo: lo, hi: hi, multiLine: multiLine };
}

/**
 * Format the in-webview copy toast — instant feedback so the user sees what landed on
 * the clipboard without having to glance at the status bar. Numbers are locale-formatted
 * so "1,247 characters" reads naturally; line numbers are 1-based to match the counter
 * decoration column users see in the viewer.
 */
function formatCopyToastMessage(kind, lo, hi, charCount) {
    var fmt = function(n) {
        try { return Number(n).toLocaleString(); } catch (_e) { return String(n); }
    };
    var charPart = ' (' + fmt(charCount) + ' character' + (charCount === 1 ? '' : 's') + ')';
    if (kind === 'lines') return 'Copied lines ' + lo + '-' + hi + charPart;
    if (kind === 'line') return 'Copied line ' + lo + charPart;
    if (kind === 'lines-decorated') return 'Copied lines ' + lo + '-' + hi + ' decorated' + charPart;
    if (kind === 'line-decorated') return 'Copied line ' + lo + ' decorated' + charPart;
    if (kind === 'line-number') return 'Copied line number ' + lo;
    if (kind === 'timestamp') return 'Copied timestamp';
    if (kind === 'selection') return 'Copied selection' + charPart;
    return 'Copied' + charPart;
}

function handleLineAction(action, lineIdx) {
    if (lineIdx < 0 || lineIdx >= allLines.length) return false;

    var lineData = allLines[lineIdx];
    var plainText = stripTags(lineData.html || '');

    switch (action) {
        case 'copy': {
            /* Only treat this as a multi-line copy when the right-clicked line is INSIDE the
               shift-click selection (sel.multiLine). Without this guard, a stale selection
               from earlier in the session silently hijacks "Copy Line" on any other row —
               user right-clicks line 50, sees Copy Line, but lines 5-10 land on the clipboard. */
            var sel = getSelectionRange(lineIdx);
            var copyText;
            var copyToast;
            if (sel.multiLine && typeof getSelectedLines === 'function' && typeof linesToPlainText === 'function') {
                var lines = getSelectedLines();
                copyText = lines.length > 0 ? linesToPlainText(lines) : plainText;
                copyToast = formatCopyToastMessage('lines', sel.lo + 1, sel.hi + 1, copyText.length);
            } else {
                copyText = plainText;
                copyToast = formatCopyToastMessage('line', lineIdx + 1, lineIdx + 1, copyText.length);
            }
            vscodeApi.postMessage({ type: 'copyToClipboard', text: copyText });
            if (copyText.length > 0 && typeof showCopyToast === 'function') showCopyToast(copyToast);
            return true;
        }
        case 'copy-decorated': {
            var sel = getSelectionRange(lineIdx);
            var decoLines = sel.multiLine && typeof getSelectedLines === 'function' ? getSelectedLines() : [lineData];
            var decoText = typeof linesToDecoratedText === 'function' ? linesToDecoratedText(decoLines) : plainText;
            vscodeApi.postMessage({ type: 'copyToClipboard', text: decoText });
            var decoToast = sel.multiLine
                ? formatCopyToastMessage('lines-decorated', sel.lo + 1, sel.hi + 1, decoText.length)
                : formatCopyToastMessage('line-decorated', lineIdx + 1, lineIdx + 1, decoText.length);
            if (decoText.length > 0 && typeof showCopyToast === 'function') showCopyToast(decoToast);
            return true;
        }
        case 'copy-with-source': {
            var sel = getSelectionRange(lineIdx);
            var baseLo = sel.lo >= 0 ? sel.lo : lineIdx;
            var baseHi = sel.hi > sel.lo ? sel.hi : lineIdx;
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
        case 'copy-line-number': {
            /* 1-based index in the viewer row list — matches the counter decoration users see. We
               do not expose the internal 0-based lineIdx because the rest of the UI (counter column,
               status bar, line pickers) is 1-based, and mixing bases silently is a footgun. */
            vscodeApi.postMessage({ type: 'copyToClipboard', text: String(lineIdx + 1) });
            if (typeof showCopyToast === 'function') showCopyToast(formatCopyToastMessage('line-number', lineIdx + 1, lineIdx + 1, 0));
            return true;
        }
        case 'copy-timestamp': {
            /* Prefer .timestamp (canonical on stack headers/frames, markers, and doc items in
               addToData) and fall back to .ts for any code path that still sets the short name.
               ISO 8601 is unambiguous when pasted into another tool/log/bug report — the on-screen
               T07:23:36 decoration is for reading, not for round-tripping. */
            var tsVal = lineData.timestamp || lineData.ts;
            if (!tsVal) return true;
            vscodeApi.postMessage({ type: 'copyToClipboard', text: new Date(tsVal).toISOString() });
            if (typeof showCopyToast === 'function') showCopyToast(formatCopyToastMessage('timestamp', 0, 0, 0));
            return true;
        }
        case 'copy-error-warning-block': {
            var inc = (typeof computeIncidentLineRange === 'function') ? computeIncidentLineRange(lineIdx) : null;
            if (!inc) return true;
            var partsEw = [];
            for (var ii = inc.lo; ii <= inc.hi; ii++) {
                var li = allLines[ii];
                if (li && li.html != null) partsEw.push(stripTags(li.html));
            }
            var textEw = partsEw.join(String.fromCharCode(10));
            vscodeApi.postMessage({ type: 'copyToClipboard', text: textEw });
            if (textEw.length > 0 && typeof showCopyToast === 'function') {
                showCopyToast(formatCopyToastMessage('lines', inc.lo + 1, inc.hi + 1, textEw.length));
            }
            return true;
        }
        case 'copy-db-cluster-block': {
            var dbR = (typeof computeDbTimestampBurstLineRange === 'function') ? computeDbTimestampBurstLineRange(lineIdx) : null;
            if (!dbR) return true;
            var partsDb = [];
            for (var dj = dbR.lo; dj <= dbR.hi; dj++) {
                var lj = allLines[dj];
                if (lj && lj.html != null) partsDb.push(stripTags(lj.html));
            }
            var textDb = partsDb.join(String.fromCharCode(10));
            vscodeApi.postMessage({ type: 'copyToClipboard', text: textDb });
            if (textDb.length > 0 && typeof showCopyToast === 'function') {
                showCopyToast(formatCopyToastMessage('lines', dbR.lo + 1, dbR.hi + 1, textDb.length));
            }
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
            var sel = getSelectionRange(lineIdx);
            var crSelText, crSelStart, crSelEnd;
            if (sel.multiLine && typeof getSelectedLines === 'function' && typeof linesToPlainText === 'function') {
                var crLines = getSelectedLines();
                crSelText = crLines.length > 0 ? linesToPlainText(crLines) : plainText;
                crSelStart = sel.lo;
                crSelEnd = sel.hi;
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
            var sel = getSelectionRange(lineIdx);
            if (sel.multiLine && typeof getSelectedLines === 'function' && typeof linesToPlainText === 'function') {
                var lines = getSelectedLines();
                var selText = lines.length > 0 ? linesToPlainText(lines) : plainText;
                var firstTs = (allLines[sel.lo] && (allLines[sel.lo].ts || allLines[sel.lo].timestamp)) || lineData.ts || lineData.timestamp;
                vscodeApi.postMessage({ type: 'explainWithAi', text: selText, lineIndex: sel.lo, lineEndIndex: sel.hi, timestamp: firstTs });
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
            var fpLine = lineData.dbSignal && lineData.dbSignal.fingerprint;
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

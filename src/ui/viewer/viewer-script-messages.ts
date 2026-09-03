/** Message handler script for the log viewer webview. Extracted to keep viewer-script.ts under the line limit. */

import { getViewerScriptDbMessageHandler } from './viewer-script-messages-db';
import { getViewerScriptTypographyMessageHandler } from './viewer-script-messages-typography';
import { getSourceLineStampScript } from './viewer-source-line-stamp';
import { getFileCodeStampScript } from './viewer-file-code-stamp';
import { getViewerScriptAddLinesHandlerScript } from './viewer-script-messages-addlines';
import { getViewerScriptClearHandlerScript } from './viewer-script-messages-clear';
import { getViewerScriptMiscMessageHandler } from './viewer-script-messages-misc';

export function getViewerScriptMessageHandler(): string {
    return getViewerScriptDbMessageHandler() + getViewerScriptTypographyMessageHandler() + getSourceLineStampScript() + getFileCodeStampScript() + getViewerScriptAddLinesHandlerScript() + getViewerScriptClearHandlerScript() + getViewerScriptMiscMessageHandler() + /* javascript */ `
/* Crashlytics icon shows only when the adapter is enabled AND the workspace looks like a deployable
   app (host posts 'crashlyticsApplicable'). Both signals arrive as separate messages, so this single
   helper re-derives visibility whenever either changes. Default is hidden until the host confirms
   applicability, so a library / package project never flashes the icon. */
function syncCrashlyticsIconVisibility() {
    var ibCrash = document.getElementById('ib-crashlytics');
    if (!ibCrash) return;
    var enabled = Array.isArray(window.integrationAdapters) && window.integrationAdapters.indexOf('crashlytics') >= 0;
    var applicable = window.crashlyticsApplicable === true;
    ibCrash.classList.toggle('ib-integration-enabled', enabled && applicable);
}
window.addEventListener('message', function(event) {
    var msg = event.data;
    /* Pre-handlers return true when they've dispatched the message; skip the switch on hit. */
    if ((typeof handleDbMessages === 'function' && handleDbMessages(msg)) || (typeof handleTypographyMessages === 'function' && handleTypographyMessages(msg)) || (typeof handleSuiteSuggestionsMessage === 'function' && handleSuiteSuggestionsMessage(msg)) || (typeof handleMiscViewerMessages === 'function' && handleMiscViewerMessages(msg))) return;
    switch (msg.type) {
        case 'addLines':
            handleAddLinesMessage(msg);
            break;
        case 'setTroubleChartInterval':
            if (typeof setTroubleChartInterval === 'function') setTroubleChartInterval(msg.seconds);
            break;
        case 'troubleDetailReady':
            if (typeof renderTroubleDetail === 'function') renderTroubleDetail(msg);
            break;
        case 'setCorrelationByLineIndex':
            correlationByLineIndex = msg.correlationByLineIndex || {};
            if (typeof renderViewport === 'function') renderViewport(true);
            break;
        case 'setDatabaseQueryLines':
            databaseQueryLinesByIndex = msg.databaseQueryLines || {};
            if (typeof renderViewport === 'function') renderViewport(true);
            break;
        case 'setTraceLineLinks':
            traceLinksByIndex = msg.traceLines || {};
            if (typeof renderViewport === 'function') renderViewport(true);
            break;
        case 'updateLintData':
            if (typeof handleUpdateLintData === 'function') handleUpdateLintData(msg);
            break;
        case 'clear':
            handleClearMessage();
            break;
        case 'updateFooter':
            if (footerTextEl) footerTextEl.textContent = msg.text;
            break;
        case 'setPaused':
            isPaused = msg.paused;
            if (footerEl) footerEl.classList.toggle('paused', isPaused);
            updateFooterText();
            break;
        case 'setViewingMode':
            isViewingFile = !!msg.viewing;
            if (isViewingFile) { autoScroll = false; }
            if (typeof window.setReplayEnabled === 'function') window.setReplayEnabled(isViewingFile, isSessionActive);
            /* Capture-on-demand only applies to a live session, never a saved log (plan 114). */
            if (typeof screenshotSyncFooter === 'function') screenshotSyncFooter();
            updateFooterText();
            break;
        case 'sessionState':
            isSessionActive = !!msg.active;
            if (typeof window.setReplayEnabled === 'function') window.setReplayEnabled(isViewingFile, isSessionActive);
            if (typeof screenshotSyncFooter === 'function') screenshotSyncFooter();
            break;
        case 'setSessionInfo':
            if (typeof applySessionInfo === 'function') applySessionInfo(msg.info);
            break;
        /* setSessionHeaderLines: stash raw header lines for the (i) info modal; window-global so init order does not matter. */
        case 'setSessionHeaderLines': if (typeof window !== 'undefined') { window.__sessionHeaderLines = Array.isArray(msg.headerLines) ? msg.headerLines : []; if (typeof window.__applySessionHeaderLines === 'function') window.__applySessionHeaderLines(window.__sessionHeaderLines); } break;
        case 'setHasPerformanceData':
            var perfChip = document.getElementById('session-perf-chip');
            if (perfChip) perfChip.classList.toggle('u-hidden', !msg.has);
            break;
        case 'setCodeQualityPayload':
            if (typeof window !== 'undefined') window.codeQualityPayload = msg.payload || null;
            break;
        case 'setDriftAdvisorAvailable':
            if (typeof window !== 'undefined') window.driftAdvisorAvailable = !!msg.available; break;
        case 'setCompanionInstalled':
            // applyCompanionInstalled caches msg.states on window for re-apply on view open; the
            // integrations helper is concatenated before any message is delivered, so it is defined.
            if (typeof applyCompanionInstalled === 'function') applyCompanionInstalled(msg.states); break;
        case 'setDriftAdvisorDbPanelMeta':
            if (typeof window !== 'undefined') window.driftAdvisorDbPanelMeta = (msg.payload != null) ? msg.payload : null; break;
        case 'driftViewerHealth':
            if (typeof applyDriftViewerHealthFromHost === 'function') applyDriftViewerHealthFromHost(msg); break;
        case 'driftDbIssues': if (typeof applyDriftDbIssuesFromHost === 'function') applyDriftDbIssuesFromHost(msg); break;
        case 'driftLintViolations': if (typeof applyDriftLintViolationsFromHost === 'function') applyDriftLintViolationsFromHost(msg); break;
        case 'rootCauseHypothesesResult':
            if (typeof handleRootCauseHypothesesResult === 'function') handleRootCauseHypothesesResult(msg.hypotheses, msg.trends); break;
        case 'setRootCauseHintHostFields':
            if (Object.prototype.hasOwnProperty.call(msg, 'driftAdvisorSummary')) {
                rchHostDriftAdvisorSummary = (msg.driftAdvisorSummary && typeof msg.driftAdvisorSummary.issueCount === 'number' && msg.driftAdvisorSummary.issueCount > 0) ? msg.driftAdvisorSummary : null;
            }
            if (Object.prototype.hasOwnProperty.call(msg, 'sessionDiffSummary')) {
                rchHostSessionDiffSummary = (msg.sessionDiffSummary && msg.sessionDiffSummary.regressionFingerprints && msg.sessionDiffSummary.regressionFingerprints.length) ? { regressionFingerprints: msg.sessionDiffSummary.regressionFingerprints } : null;
            }
            if (typeof scheduleRootCauseHypothesesRefresh === 'function') scheduleRootCauseHypothesesRefresh();
            break;
        case 'setRootCauseHintL10n':
            if (typeof window !== 'undefined') window.rchL10n = (msg.strings && typeof msg.strings === 'object') ? msg.strings : {};
            if (typeof scheduleRootCauseHypothesesRefresh === 'function') scheduleRootCauseHypothesesRefresh();
            break;
        case 'triggerCopyAllFiltered': if (typeof copyAllFilteredWithCount === 'function') copyAllFilteredWithCount(); break;
        case 'triggerCollapseAllSections': if (typeof collapseAllSections === 'function') collapseAllSections(); if (typeof window.__setAllSectionsCollapsed === 'function') window.__setAllSectionsCollapsed(true); break;
        case 'triggerExpandAllSections': if (typeof expandAllSections === 'function') expandAllSections(); if (typeof window.__setAllSectionsCollapsed === 'function') window.__setAllSectionsCollapsed(false); break;
        case 'triggerToggleSearch': if (typeof toggleSearchPanel === 'function') toggleSearchPanel(); break;
        case 'triggerToggleTroubleMode': if (typeof toggleTroubleMode === 'function') toggleTroubleMode(); break;
        case 'activateTroubleMode': if (typeof activateTroubleMode === 'function') activateTroubleMode(); break;
        case 'setTroubleLevels': if (typeof setTroubleLevels === 'function') setTroubleLevels(msg.levels); break;
        case 'triggerGotoLine': if (typeof openGotoLine === 'function') openGotoLine(); break;
        case 'triggerExplainRootCauseHypotheses':
            if (typeof runTriggerExplainRootCauseHypothesesFromHost === 'function') runTriggerExplainRootCauseHypothesesFromHost();
            break;
        case 'openSqlQueryHistoryPanel':
            if (typeof setActivePanel === 'function') setActivePanel('sqlHistory');
            break;
        case 'setFilename':
            currentFilename = msg.filename || '';
            updateFooterText();
            break;
        /* Structured documents (markdown reports, JSON, CSV) auto-enable formatting:
           opening one and seeing raw text behind a hidden toggle reads as "not rendered".
           The layout build (buildMdSections etc.) is deferred to loadComplete because
           setFileMode is posted before any content lines arrive, so allLines is empty here. */
        case 'setFileMode': fileMode = msg.mode || 'log'; formatEnabled = (fileMode !== 'log'); if (typeof updateFormatToggleVisibility === 'function') updateFormatToggleVisibility(); if (typeof applyMarkdownTypography === 'function') applyMarkdownTypography(); break;
        case 'setSources':
            if (typeof window !== 'undefined') { window.availableSources = Array.isArray(msg.sources) ? msg.sources : []; window.enabledSources = Array.isArray(msg.enabledSources) ? msg.enabledSources : null; }
            /* Log Sources tab is always visible — no need to toggle panel display */
            if (typeof recalcHeights === 'function') recalcHeights();
            if (typeof renderViewport === 'function') renderViewport(true);
            if (typeof updateFooterText === 'function') updateFooterText();
            break;
        case 'setEnabledSources':
            if (typeof window !== 'undefined' && Array.isArray(msg.enabledSources)) window.enabledSources = msg.enabledSources;
            if (typeof recalcHeights === 'function') recalcHeights();
            if (typeof renderViewport === 'function') renderViewport(true);
            break;
        case 'setCategories':
            handleSetCategories(msg);
            break;
        case 'updateWatchCounts':
            if (typeof handleUpdateWatchCounts === 'function') handleUpdateWatchCounts(msg);
            break;
        case 'setExclusions':
            if (typeof handleSetExclusions === 'function') handleSetExclusions(msg);
            break;
        case 'setAutoHidePatterns':
            if (typeof handleSetAutoHidePatterns === 'function') handleSetAutoHidePatterns(msg);
            break;
        case 'loadAnnotations':
            if (typeof handleLoadAnnotations === 'function') handleLoadAnnotations(msg);
            break;
        case 'setAnnotation':
            if (typeof setAnnotation === 'function') setAnnotation(msg.lineIndex, msg.text);
            break;
        case 'setShowElapsed':
            if (typeof handleSetShowElapsed === 'function') handleSetShowElapsed(msg);
            break;
        case 'errorClassificationSettings':
            if (typeof handleErrorClassificationSettings === 'function') handleErrorClassificationSettings(msg);
            break;
        case 'splitInfo':
            if (typeof handleSplitInfo === 'function') handleSplitInfo(msg);
            break;
        case 'runBoundaries':
            if (typeof handleRunBoundaries === 'function') handleRunBoundaries(msg);
            break;
        case 'sessionNavInfo':
            if (typeof handleSessionNavInfo === 'function') handleSessionNavInfo(msg);
            break;
        /* Plan 109: staleness + lifespan context for the open log. Drives the toolbar warning chip
           and the unified banner (auto-surfaces a newer main-project log). */
        case 'logContextInfo': if (typeof window.handleLogContextInfo === 'function') window.handleLogContextInfo(msg); break;
        case 'scrollToSignal':
            /* Host loaded the session containing the clicked signal; jump to the first matching line.
               signalScrollToLabel lives in the signal panel script (owns pulseLinesAround); if the
               signal script never ran in this webview, this is a silent no-op. */
            if (typeof window.signalScrollToLabel === 'function') { window.signalScrollToLabel(msg.label || '', msg.detail || ''); }
            break;
        case 'scrollToLine': {
            /* msg.line is a gutter/source line number, not an allLines array index — every host-side
               caller (bookmarks, error snackbars, SQL query history cross-log jumps, flow-map reveal,
               command-palette "Go to Line…") derives it from the file's physical line number, e.g.
               "scrollToLine is 1-based to match the viewer's go-to-line input" in
               extension-activation-helpers.ts. Synthetic rows (markers, stack headers) push
               sourceLineNo past the array length, so treating it as allLines[line - 1] landed on
               the wrong row (bug_026). Resolve through the same sourceLineNo lookup the Go-to-Line
               input uses instead of indexing directly. */
            if (window.isContextMenuOpen) break;
            if (typeof findAllLinesIndexBySourceLine !== 'function' || allLines.length === 0) break;
            var li = findAllLinesIndexBySourceLine(Number(msg.line));
            if (li < 0) break;
            var ch = 0; for (var si = 0; si < li; si++) ch += allLines[si].height;
            if (window.setProgrammaticScroll) window.setProgrammaticScroll();
            suppressScroll = true; logEl.scrollTop = ch; suppressScroll = false;
            autoScroll = false; break;
        }
        case 'setupFindSearch':
            if (typeof setupFromFindInFiles === 'function') setupFromFindInFiles(msg);
            break;
        case 'findNextMatch':
            if (typeof searchNext === 'function') searchNext();
            break;
        case 'loadTruncated':
            loadTruncatedInfo = { shown: msg.shown || 0, total: msg.total || 0 };
            updateFooterText();
            break;
        case 'setMaxLines':
            if (typeof msg.maxLines === 'number' && Number.isFinite(msg.maxLines) && msg.maxLines > 0) {
                MAX_LINES = Math.max(MAX_LINES, Math.floor(msg.maxLines));
            }
            break;
        case 'loadComplete':
            if (currentFilename && scrollMemory[currentFilename] !== undefined && !window.isContextMenuOpen) {
                if (window.setProgrammaticScroll) window.setProgrammaticScroll();
                suppressScroll = true; logEl.scrollTop = scrollMemory[currentFilename]; suppressScroll = false;
                autoScroll = false; if (jumpBtn) jumpBtn.style.display = 'block'; renderViewport(true);
            }
            updateFooterText();
            /* All content has arrived: build the structured-mode layout now that allLines
               is populated, then re-measure and repaint so auto-enabled formatting (set in
               setFileMode) renders headings/fences/tables instead of raw text. */
            if (typeof formatEnabled !== 'undefined' && formatEnabled && typeof fileMode !== 'undefined' && fileMode !== 'log') {
                if (typeof applyMarkdownTypography === 'function') applyMarkdownTypography();
                if (typeof window.buildFormatModeLayout === 'function') window.buildFormatModeLayout();
                if (typeof recalcHeights === 'function') recalcHeights();
                if (typeof buildPrefixSums === 'function') buildPrefixSums();
                if (typeof renderViewport === 'function') renderViewport(true);
            }
            if (typeof window.setReplayEnabled === 'function') {
                window.setReplayEnabled(isViewingFile, isSessionActive);
                // Defer again so replay bar visibility is applied after loadComplete layout has settled.
                setTimeout(function() { if (typeof window.setReplayEnabled === 'function') window.setReplayEnabled(isViewingFile, isSessionActive); }, 0);
            }
            if (typeof scheduleRootCauseHypothesesRefresh === 'function') scheduleRootCauseHypothesesRefresh();
            /* Screenshot badges need allLines populated to map sidecar logLine → row idx. */
            if (typeof vscodeApi !== 'undefined') vscodeApi.postMessage({ type: 'requestScreenshots' });
            break;
        case 'screenshotList':
            if (typeof screenshotApplyList === 'function') screenshotApplyList(msg);
            break;
        case 'screenshotCaptured':
            if (typeof screenshotHandleCaptured === 'function') screenshotHandleCaptured(msg);
            break;
        case 'screenshotImage':
            if (typeof screenshotHandleImage === 'function') screenshotHandleImage(msg);
            break;
        case 'screenshotSettings':
            if (typeof screenshotHandleSettings === 'function') screenshotHandleSettings(msg);
            break;
        case 'setScopeContext':
            if (typeof handleScopeContextMessage === 'function') handleScopeContextMessage(msg);
            break;
    }
});
`;
}

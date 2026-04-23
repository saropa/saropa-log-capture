/** Message handler script for the log viewer webview. Extracted to keep viewer-script.ts under the line limit. */

import { getViewerScriptDbMessageHandler } from './viewer-script-messages-db';
import { getViewerScriptTypographyMessageHandler } from './viewer-script-messages-typography';

export function getViewerScriptMessageHandler(): string {
    return getViewerScriptDbMessageHandler() + getViewerScriptTypographyMessageHandler() + /* javascript */ `
window.addEventListener('message', function(event) {
    var msg = event.data;
    /* Pre-handlers return true when they've dispatched the message; skip the switch on hit. */
    if ((typeof handleDbMessages === 'function' && handleDbMessages(msg)) || (typeof handleTypographyMessages === 'function' && handleTypographyMessages(msg))) return;
    switch (msg.type) {
        case 'addLines': {
            var isHidden = typeof document !== 'undefined' && document.visibilityState === 'hidden';
            for (var i = 0; i < msg.lines.length; i++) {
                var ln = msg.lines[i];
                addToData(ln.text, ln.isMarker, ln.category, ln.timestamp, ln.fw, ln.sourcePath, ln.elapsedMs, ln.qualityPercent, ln.source, ln.rawText, ln.tier);
                if (typeof applyLintDataToLastLine === 'function') applyLintDataToLastLine(ln);
            }
            trimData();
            if (msg.lineCount !== undefined) {
                lineCount = msg.lineCount;
                // Decoration width only changes when line-count digit width crosses a threshold.
                if (typeof applyDecorationLayoutWidth === 'function') applyDecorationLayoutWidth();
            }
            /* Compress mode mutates heights: any compression mode can mutate prior line heights/visibility; must full recalc, not appendPrefixSums only. */
            if ((typeof compressLinesMode !== 'undefined' && compressLinesMode)
                || (typeof compressNonConsecutiveMode !== 'undefined' && compressNonConsecutiveMode)) {
                if (typeof recalcHeights === 'function') recalcHeights();
                if (typeof buildPrefixSums === 'function') buildPrefixSums();
            } else if (typeof buildPrefixSums === 'function' && typeof appendPrefixSums === 'function') {
                if (prefixSums && prefixSums.length + msg.lines.length === allLines.length + 1) { appendPrefixSums(); }
                else { buildPrefixSums(); }
            }
            if (!isHidden) {
                // Use hysteresis (force=false) so we skip full DOM replace when visible range unchanged,
                // preserving text selection while the log is being written to.
                renderViewport(false);
                if (typeof scheduleMinimap === 'function') scheduleMinimap();
                if (autoScroll && !window.isContextMenuOpen) { if (window.setProgrammaticScroll) window.setProgrammaticScroll(); suppressScroll = true; logEl.scrollTop = logEl.scrollHeight; suppressScroll = false; }
                updateFooterText();
            }
            if (typeof scheduleRootCauseHypothesesRefresh === 'function') scheduleRootCauseHypothesesRefresh();
            break;
        }
        case 'setCorrelationByLineIndex':
            correlationByLineIndex = msg.correlationByLineIndex || {};
            if (typeof renderViewport === 'function') renderViewport(true);
            break;
        case 'updateLintData':
            if (typeof handleUpdateLintData === 'function') handleUpdateLintData(msg);
            break;
        case 'clear':
            loadTruncatedInfo = null;
            correlationByLineIndex = {};
            MAX_LINES = MAX_LINES_DEFAULT;
            if (typeof window !== 'undefined') { window.enabledSources = null; window.availableSources = []; }
            if (typeof window.exitReplayMode === 'function') window.exitReplayMode();
            if (currentFilename && !autoScroll) { scrollMemory[currentFilename] = logEl.scrollTop; }
            autoScroll = true;
            fileMode = 'log'; formatEnabled = false; if (typeof updateFormatToggleVisibility === 'function') updateFormatToggleVisibility();
            allLines.length = 0; totalHeight = 0; lineCount = 0; activeGroupHeader = null; nextSeq = 1; sessionStartTs = 0;
            if (typeof applyDecorationLayoutWidth === 'function') applyDecorationLayoutWidth();
            lastStart = -1; lastEnd = -1; groupHeaderMap = {}; prefixSums = null;
            if (typeof resetContinuationState === 'function') resetContinuationState();
            cachedVisibleCount = 0; if (typeof window !== 'undefined') window.__visibleCountDirty = false;
            isPaused = false; isViewingFile = false; if (footerEl) footerEl.classList.remove('paused');
            if (typeof window.setReplayEnabled === 'function') window.setReplayEnabled(false, isSessionActive);
            if (typeof closeContextModal === 'function') closeContextModal();
            if (typeof resetSourceTags === 'function') resetSourceTags(); if (typeof resetClassTags === 'function') resetClassTags(); if (typeof resetSqlPatternTags === 'function') resetSqlPatternTags(); if (typeof resetScopeFilter === 'function') resetScopeFilter(); if (typeof dbTimeFilterActive !== 'undefined') { dbTimeFilterActive = false; dbTimeFilterMin = 0; dbTimeFilterMax = 0; } if (typeof window !== 'undefined') { window.driftAdvisorDbPanelMeta = null; window.ppDbTimelineMeta = null; } if (typeof resetDriftDebugServerFromLogSession === 'function') resetDriftDebugServerFromLogSession(); if (typeof updateSessionNav === 'function') updateSessionNav(false, false, 0, 0);
            if (typeof clearRunNav === 'function') clearRunNav();
            if (typeof artBlockTracker !== 'undefined') { artBlockTracker.startIdx = -1; artBlockTracker.count = 0; artBlockTracker.timestamp = 0; }
            if (typeof resetAsciiArtDetector === 'function') resetAsciiArtDetector();
            if (typeof repeatTracker !== 'undefined') {
                repeatTracker.lastHash = null; repeatTracker.lastPlainText = null; repeatTracker.lastLevel = null; repeatTracker.count = 0;
                repeatTracker.lastTimestamp = 0; repeatTracker.lastLineIndex = -1; repeatTracker.lastRepeatNotificationIndex = -1; repeatTracker.streakMinN = 2; repeatTracker.streakSqlFp = false;
                repeatTracker.sqlRepeatPreview = null; repeatTracker.sqlStreakFingerprint = null; repeatTracker.sqlStreakSqlSnippet = '';
                repeatTracker.sqlStreakFirstTs = 0; repeatTracker.sqlStreakLastTs = 0; repeatTracker.sqlStreakVariantOrder = []; repeatTracker.sqlStreakVariantCounts = null;
            }
            if (typeof resetDbSignalDetectorSession === 'function') resetDbSignalDetectorSession();
            if (typeof setDbBaselineFingerprintSummaryFromHost === 'function') setDbBaselineFingerprintSummaryFromHost(null);
            if (typeof resetRootCauseHypothesesSession === 'function') resetRootCauseHypothesesSession();
            if (typeof resetCompressDupStreak === 'function') resetCompressDupStreak();
            if (typeof compressSuggestShown !== 'undefined') { compressSuggestShown = false; compressSuggestBannerDismissed = false; }
            if (typeof hideCompressSuggestionBanner === 'function') hideCompressSuggestionBanner();
            var _rb = document.getElementById('resume-session-banner'); if (_rb) _rb.classList.add('u-hidden');
            if (typeof hiddenLineIndices !== 'undefined') { hiddenLineIndices.clear(); isPeeking = false; autoHiddenCount = 0; sessionAutoHidePatterns = []; updateHiddenDisplay(); }
            if (footerTextEl) footerTextEl.textContent = 'Cleared'; updateLineCount(); renderViewport(true); if (typeof scheduleMinimap === 'function') scheduleMinimap();
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
            updateFooterText();
            break;
        case 'sessionState':
            isSessionActive = !!msg.active;
            if (typeof window.setReplayEnabled === 'function') window.setReplayEnabled(isViewingFile, isSessionActive);
            break;
        case 'setSessionInfo':
            if (typeof applySessionInfo === 'function') applySessionInfo(msg.info);
            break;
        case 'setHasPerformanceData':
            var perfChip = document.getElementById('session-perf-chip');
            if (perfChip) perfChip.classList.toggle('u-hidden', !msg.has);
            break;
        case 'setCodeQualityPayload':
            if (typeof window !== 'undefined') window.codeQualityPayload = msg.payload || null;
            break;
        case 'setDriftAdvisorAvailable':
            if (typeof window !== 'undefined') window.driftAdvisorAvailable = !!msg.available; break;
        case 'setDriftAdvisorDbPanelMeta':
            if (typeof window !== 'undefined') window.driftAdvisorDbPanelMeta = (msg.payload != null) ? msg.payload : null; break;
        case 'driftViewerHealth':
            if (typeof applyDriftViewerHealthFromHost === 'function') applyDriftViewerHealthFromHost(msg); break;
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
        case 'triggerCollapseAllSections': if (typeof collapseAllSections === 'function') collapseAllSections(); break;
        case 'triggerExpandAllSections': if (typeof expandAllSections === 'function') expandAllSections(); break;
        case 'triggerToggleSearch': if (typeof toggleSearchPanel === 'function') toggleSearchPanel(); break;
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
        case 'setFileMode': fileMode = msg.mode || 'log'; formatEnabled = false; if (typeof updateFormatToggleVisibility === 'function') updateFormatToggleVisibility(); break;
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
        case 'scrollToLine': {
            if (window.isContextMenuOpen) break;
            var li = Math.max(0, Math.min(Number(msg.line) - 1, allLines.length - 1));
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
            if (typeof window.setReplayEnabled === 'function') {
                window.setReplayEnabled(isViewingFile, isSessionActive);
                // Defer again so replay bar visibility is applied after loadComplete layout has settled.
                setTimeout(function() { if (typeof window.setReplayEnabled === 'function') window.setReplayEnabled(isViewingFile, isSessionActive); }, 0);
            }
            if (typeof scheduleRootCauseHypothesesRefresh === 'function') scheduleRootCauseHypothesesRefresh();
            break;
        case 'setScopeContext':
            if (typeof handleScopeContextMessage === 'function') handleScopeContextMessage(msg);
            break;
        case 'minimapShowInfo':
            minimapShowInfoMarkers = !!msg.show;
            if (typeof handleMinimapShowInfo === 'function') handleMinimapShowInfo(msg);
            break;
        case 'minimapShowSqlDensity':
            if (typeof minimapShowSqlDensity !== 'undefined') minimapShowSqlDensity = msg.show !== false;
            if (typeof handleMinimapShowSqlDensity === 'function') handleMinimapShowSqlDensity(msg);
            if (typeof syncOptionsPanelUi === 'function') syncOptionsPanelUi();
            break;
        case 'minimapProportionalLines':
            minimapProportionalLines = msg.show !== false;
            if (typeof handleMinimapProportionalLines === 'function') handleMinimapProportionalLines(msg);
            break;
        case 'minimapViewportRedOutline':
            minimapViewportRedOutline = msg.show === true;
            if (typeof handleMinimapViewportRedOutline === 'function') handleMinimapViewportRedOutline(msg);
            break;
        case 'minimapViewportOutsideArrow':
            minimapViewportOutsideArrow = msg.show === true;
            if (typeof handleMinimapViewportOutsideArrow === 'function') handleMinimapViewportOutsideArrow(msg);
            break;
        case 'minimapWidth': if (typeof handleMinimapWidth === 'function') handleMinimapWidth(msg); break;
        case 'minimapWidthPx': if (typeof handleMinimapWidthPx === 'function') handleMinimapWidthPx(msg); break;
        case 'scrollbarVisible': /* Apply showScrollbar setting + force Chromium scrollbar re-render */ applyScrollbarVisible(msg.show === true); break;
        case 'searchMatchOptionsAlwaysVisible': document.body.classList.toggle('search-match-options-always', msg.always === true); break;
        case 'iconBarPosition':
            document.body.dataset.iconBar = msg.position || 'left';
            syncJumpButtonInset();
            break;
        case 'captureEnabled':
            window.captureEnabled = msg.enabled !== false;
            if (typeof syncCaptureEnabledUi === 'function') syncCaptureEnabledUi();
            break;
        case 'setLearningOptions':
            learningEnabled = msg.enabled !== false;
            learningMaxLineLen = typeof msg.maxLineLength === 'number' && msg.maxLineLength >= 80 ? msg.maxLineLength : 2000;
            learningTrackScroll = msg.trackScroll === true;
            break;
        case 'integrationsAdapters':
            window.integrationAdapters = Array.isArray(msg.adapterIds) ? msg.adapterIds : [];
            if (typeof syncIntegrationsUi === 'function') syncIntegrationsUi();
            var ibCrash = document.getElementById('ib-crashlytics');
            if (ibCrash) ibCrash.classList.toggle('ib-integration-enabled', window.integrationAdapters.indexOf('crashlytics') >= 0);
            var ibPerf = document.getElementById('ib-performance');
            if (ibPerf) ibPerf.classList.toggle('ib-integration-enabled', window.integrationAdapters.indexOf('performance') >= 0);
            if (typeof window.applyFooterQualityReportState === 'function') window.applyFooterQualityReportState();
            break;
        case 'errorHoverData':
            if (typeof handleErrorHoverData === 'function') handleErrorHoverData(msg);
            break;
        case 'setViewerKeybindings':
            if (msg.keyToAction && typeof msg.keyToAction === 'object') window.viewerKeyMap = msg.keyToAction;
            break;
        case 'setErrorRateConfig':
            if (typeof msg.bucketSize === 'string') erBucketSizeSetting = msg.bucketSize;
            if (typeof msg.showWarnings === 'boolean') erShowWarnings = msg.showWarnings;
            if (typeof msg.detectSpikes === 'boolean') erDetectSpikes = msg.detectSpikes; break;
        case 'viewerKeybindingRecordMode':
            window.viewerKeybindingRecordingFor = msg.active ? (msg.actionId || null) : null;
            break;
        case 'showResumeSession': {
            var rb = document.getElementById('resume-session-banner');
            var rbtn = document.getElementById('resume-session-btn');
            if (rb && rbtn && msg.uriString && msg.name) {
                rbtn.textContent = 'Resume: ' + msg.name;
                rbtn.setAttribute('data-uri', msg.uriString);
                rb.classList.remove('u-hidden');
            }
            break;
        }
    }
});
(function() {
    var resumeBtn = document.getElementById('resume-session-btn');
    var resumeDismiss = document.getElementById('resume-session-dismiss');
    var resumeBanner = document.getElementById('resume-session-banner');
    if (resumeBtn) resumeBtn.addEventListener('click', function() {
        var uri = resumeBtn.getAttribute('data-uri');
        if (uri) vscodeApi.postMessage({ type: 'openSessionFromPanel', uriString: uri });
        if (resumeBanner) resumeBanner.classList.add('u-hidden');
    });
    if (resumeDismiss) resumeDismiss.addEventListener('click', function() {
        if (resumeBanner) resumeBanner.classList.add('u-hidden');
    });
})();
`;
}

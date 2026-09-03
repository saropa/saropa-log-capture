/**
 * 'clear' host-message handler for the log viewer webview — resets all
 * per-log state to a fresh, empty viewer. Extracted from
 * viewer-script-messages.ts to keep that file under the line limit.
 */

export function getViewerScriptClearHandlerScript(): string {
    return /* javascript */ `
function handleClearMessage() {
    loadTruncatedInfo = null;
    correlationByLineIndex = {};
    databaseQueryLinesByIndex = {};
    traceLinksByIndex = {};
    MAX_LINES = MAX_LINES_DEFAULT;
    if (typeof window !== 'undefined') { window.enabledSources = null; window.availableSources = []; }
    if (typeof window.exitReplayMode === 'function') window.exitReplayMode();
    if (currentFilename && !autoScroll) { scrollMemory[currentFilename] = logEl.scrollTop; }
    autoScroll = true;
    fileMode = 'log'; formatEnabled = false; if (typeof updateFormatToggleVisibility === 'function') updateFormatToggleVisibility(); if (typeof applyMarkdownTypography === 'function') applyMarkdownTypography();
    allLines.length = 0; totalHeight = 0; lineCount = 0; activeGroupHeader = null; nextSeq = 1; sessionStartTs = 0; if (typeof resetDecoSeen === 'function') resetDecoSeen(); if (typeof resetTreeDetector === 'function') resetTreeDetector(); if (typeof resetFileCodes === 'function') resetFileCodes(); if (typeof resetTroubleChartLaunchScan === 'function') resetTroubleChartLaunchScan();
    if (typeof applyDecorationLayoutWidth === 'function') applyDecorationLayoutWidth();
    lastStart = -1; lastEnd = -1; groupHeaderMap = {}; prefixSums = null;
    if (typeof resetContinuationState === 'function') resetContinuationState();
    if (typeof resetFlutterBannerDetector === 'function') resetFlutterBannerDetector();
    cachedVisibleCount = 0; if (typeof window !== 'undefined') window.__visibleCountDirty = false;
    isPaused = false; isViewingFile = false; if (footerEl) footerEl.classList.remove('paused');
    if (typeof window.setReplayEnabled === 'function') window.setReplayEnabled(false, isSessionActive);
    if (typeof closeContextModal === 'function') closeContextModal();
    if (typeof resetSourceTags === 'function') resetSourceTags(); if (typeof resetClassTags === 'function') resetClassTags(); if (typeof resetSqlPatternTags === 'function') resetSqlPatternTags(); if (typeof resetScopeFilter === 'function') resetScopeFilter(); if (typeof resetWarmupFilter === 'function') resetWarmupFilter(); if (typeof dbTimeFilterActive !== 'undefined') { dbTimeFilterActive = false; dbTimeFilterMin = 0; dbTimeFilterMax = 0; } if (typeof window !== 'undefined') { window.driftAdvisorDbPanelMeta = null; window.ppDbTimelineMeta = null; } if (typeof resetDriftDebugServerFromLogSession === 'function') resetDriftDebugServerFromLogSession(); if (typeof updateSessionNav === 'function') updateSessionNav(false, false, 0, 0);
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
    if (typeof hiddenLineIndices !== 'undefined') { hiddenLineIndices.clear(); isPeeking = false; autoHiddenCount = 0; sessionAutoHidePatterns = []; updateHiddenDisplay(); }
    /* Selection state is keyed by allLines index; switching logs replaces allLines
       wholesale (see allLines.length = 0 above) so any stale selection would apply
       Ctrl+C / Shift+Arrow to rows of the NEW file that happen to share old indices
       (bug_025). Reset the anchor, cursor, and implicit-click caret together. */
    if (typeof selectionStart !== 'undefined') selectionStart = -1;
    if (typeof selectionEnd !== 'undefined') selectionEnd = -1;
    if (typeof lastClickedIdx !== 'undefined') lastClickedIdx = -1;
    /* bug_025 (log-switch gap): pinnedIndices and annotations are ALSO keyed by
       allLines index, same as selection above — trimData() re-indexes them on a
       trim, but nothing reset them on a full log switch, so a pin/annotation from
       the old file silently reappeared on whatever unrelated row now sits at that
       index in the new file. screenshotByIdx needs no reset here: it is rebuilt
       wholesale from the sidecar list on every 'screenshotList' message, which
       loadComplete always requests after a switch. */
    if (typeof pinnedIndices !== 'undefined') { pinnedIndices.clear(); if (typeof renderPinnedSection === 'function') renderPinnedSection(); }
    if (typeof annotations !== 'undefined') annotations = {};
    if (footerTextEl) footerTextEl.textContent = 'Cleared'; updateLineCount(); renderViewport(true); if (typeof scheduleMinimap === 'function') scheduleMinimap();
    if (typeof scheduleTroubleChartUpdate === 'function') scheduleTroubleChartUpdate();
}
`;
}

/** Message handler script for the log viewer webview. Extracted to keep viewer-script.ts under the line limit. */

export function getViewerScriptMessageHandler(): string {
    return /* javascript */ `
window.addEventListener('message', function(event) {
    var msg = event.data;
    switch (msg.type) {
        case 'addLines': {
            var isHidden = typeof document !== 'undefined' && document.visibilityState === 'hidden';
            for (var i = 0; i < msg.lines.length; i++) {
                var ln = msg.lines[i];
                addToData(ln.text, ln.isMarker, ln.category, ln.timestamp, ln.fw, ln.sourcePath, ln.elapsedMs, ln.qualityPercent);
            }
            trimData();
            if (msg.lineCount !== undefined) lineCount = msg.lineCount;
            if (typeof buildPrefixSums === 'function' && typeof appendPrefixSums === 'function') {
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
            break;
        }
        case 'setCorrelationByLineIndex':
            correlationByLineIndex = msg.correlationByLineIndex || {};
            if (typeof renderViewport === 'function') renderViewport(true);
            break;
        case 'clear':
            loadTruncatedInfo = null;
            correlationByLineIndex = {};
            if (typeof window.exitReplayMode === 'function') window.exitReplayMode();
            if (currentFilename && !autoScroll) { scrollMemory[currentFilename] = logEl.scrollTop; }
            autoScroll = true;
            allLines.length = 0; totalHeight = 0; lineCount = 0; activeGroupHeader = null; nextSeq = 1; sessionStartTs = 0;
            lastStart = -1; lastEnd = -1; groupHeaderMap = {}; prefixSums = null;
            cachedVisibleCount = 0; if (typeof window !== 'undefined') window.__visibleCountDirty = false;
            isPaused = false; isViewingFile = false; footerEl.classList.remove('paused');
            if (typeof window.setReplayEnabled === 'function') window.setReplayEnabled(false, isSessionActive);
            if (typeof closeContextModal === 'function') closeContextModal();
            if (typeof resetSourceTags === 'function') resetSourceTags(); if (typeof resetClassTags === 'function') resetClassTags(); if (typeof resetScopeFilter === 'function') resetScopeFilter(); if (typeof updateSessionNav === 'function') updateSessionNav(false, false, 0, 0);
            if (typeof clearRunNav === 'function') clearRunNav();
            if (typeof repeatTracker !== 'undefined') { repeatTracker.lastHash = null; repeatTracker.lastPlainText = null; repeatTracker.lastLevel = null; repeatTracker.count = 0; repeatTracker.lastTimestamp = 0; repeatTracker.lastLineIndex = -1; }
            if (typeof hiddenLineIndices !== 'undefined') { hiddenLineIndices.clear(); isPeeking = false; autoHiddenCount = 0; sessionAutoHidePatterns = []; updateHiddenDisplay(); }
            footerTextEl.textContent = 'Cleared'; updateLineCount(); renderViewport(true); if (typeof scheduleMinimap === 'function') scheduleMinimap();
            break;
        case 'updateFooter':
            footerTextEl.textContent = msg.text;
            break;
        case 'setPaused':
            isPaused = msg.paused;
            footerEl.classList.toggle('paused', isPaused);
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
        case 'setFilename':
            currentFilename = msg.filename || '';
            updateFooterText();
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
        case 'setShowDecorations':
            if (typeof handleSetShowDecorations === 'function') handleSetShowDecorations(msg);
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
        case 'loadComplete':
            if (currentFilename && scrollMemory[currentFilename] !== undefined && !window.isContextMenuOpen) {
                if (window.setProgrammaticScroll) window.setProgrammaticScroll();
                suppressScroll = true; logEl.scrollTop = scrollMemory[currentFilename]; suppressScroll = false;
                autoScroll = false; jumpBtn.style.display = 'block'; renderViewport(true);
            }
            updateFooterText();
            if (typeof window.setReplayEnabled === 'function') {
                window.setReplayEnabled(isViewingFile, isSessionActive);
                // Defer again so replay bar visibility is applied after loadComplete layout has settled.
                setTimeout(function() { if (typeof window.setReplayEnabled === 'function') window.setReplayEnabled(isViewingFile, isSessionActive); }, 0);
            }
            break;
        case 'setScopeContext':
            if (typeof handleScopeContextMessage === 'function') handleScopeContextMessage(msg);
            break;
        case 'minimapShowInfo': if (typeof handleMinimapShowInfo === 'function') handleMinimapShowInfo(msg); break;
        case 'minimapWidth': if (typeof handleMinimapWidth === 'function') handleMinimapWidth(msg); break;
        case 'scrollbarVisible': /* Apply showScrollbar setting: body class drives --scrollbar-w and vertical scrollbar width in CSS */ document.body.classList.toggle('scrollbar-visible', msg.show === true); break;
        case 'iconBarPosition': document.body.dataset.iconBar = msg.position || 'left'; break;
        case 'captureEnabled':
            window.captureEnabled = msg.enabled !== false;
            if (typeof syncCaptureEnabledUi === 'function') syncCaptureEnabledUi();
            break;
        case 'integrationsAdapters':
            window.integrationAdapters = Array.isArray(msg.adapterIds) ? msg.adapterIds : [];
            if (typeof syncIntegrationsUi === 'function') syncIntegrationsUi();
            var ibCrash = document.getElementById('ib-crashlytics');
            if (ibCrash) ibCrash.classList.toggle('ib-integration-enabled', window.integrationAdapters.indexOf('crashlytics') >= 0);
            var ibPerf = document.getElementById('ib-performance');
            if (ibPerf) ibPerf.classList.toggle('ib-integration-enabled', window.integrationAdapters.indexOf('performance') >= 0);
            break;
        case 'errorHoverData':
            if (typeof handleErrorHoverData === 'function') handleErrorHoverData(msg);
            break;
        case 'setViewerKeybindings':
            if (msg.keyToAction && typeof msg.keyToAction === 'object') window.viewerKeyMap = msg.keyToAction;
            break;
        case 'viewerKeybindingRecordMode':
            window.viewerKeybindingRecordingFor = msg.active ? (msg.actionId || null) : null;
            break;
    }
});
`;
}

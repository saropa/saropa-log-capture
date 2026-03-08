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
                addToData(ln.text, ln.isMarker, ln.category, ln.timestamp, ln.fw, ln.sourcePath, ln.elapsedMs);
            }
            trimData();
            if (msg.lineCount !== undefined) lineCount = msg.lineCount;
            if (typeof buildPrefixSums === 'function' && typeof appendPrefixSums === 'function') {
                if (prefixSums && prefixSums.length + msg.lines.length === allLines.length + 1) { appendPrefixSums(); }
                else { buildPrefixSums(); }
            }
            if (!isHidden) {
                renderViewport(true);
                if (typeof scheduleMinimap === 'function') scheduleMinimap();
                if (autoScroll && !window.isContextMenuOpen) { if (window.setProgrammaticScroll) window.setProgrammaticScroll(); suppressScroll = true; logEl.scrollTop = logEl.scrollHeight; suppressScroll = false; }
                updateFooterText();
            }
            break;
        }
        case 'clear':
            loadTruncatedInfo = null;
            if (typeof window.exitReplayMode === 'function') window.exitReplayMode();
            if (currentFilename && !autoScroll) { scrollMemory[currentFilename] = logEl.scrollTop; }
            autoScroll = true;
            allLines.length = 0; totalHeight = 0; lineCount = 0; activeGroupHeader = null; nextSeq = 1;
            lastStart = -1; lastEnd = -1; groupHeaderMap = {}; prefixSums = null;
            cachedVisibleCount = 0; if (typeof window !== 'undefined') window.__visibleCountDirty = false;
            isPaused = false; isViewingFile = false; footerEl.classList.remove('paused');
            if (typeof closeContextModal === 'function') closeContextModal();
            if (typeof resetSourceTags === 'function') resetSourceTags(); if (typeof resetClassTags === 'function') resetClassTags(); if (typeof resetScopeFilter === 'function') resetScopeFilter(); if (typeof updateSessionNav === 'function') updateSessionNav(false, false, 0, 0);
            if (typeof clearRunNav === 'function') clearRunNav();
            if (typeof repeatTracker !== 'undefined') { repeatTracker.lastHash = null; repeatTracker.lastPlainText = null; repeatTracker.lastLevel = null; repeatTracker.count = 0; repeatTracker.lastTimestamp = 0; repeatTracker.lastLineIndex = -1; }
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
            updateFooterText();
            break;
        case 'setSessionInfo':
            if (typeof applySessionInfo === 'function') applySessionInfo(msg.info);
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
            break;
        case 'setScopeContext':
            if (typeof handleScopeContextMessage === 'function') handleScopeContextMessage(msg);
            break;
        case 'minimapShowInfo': if (typeof handleMinimapShowInfo === 'function') handleMinimapShowInfo(msg); break;
        case 'minimapWidth': if (typeof handleMinimapWidth === 'function') handleMinimapWidth(msg); break;
        case 'iconBarPosition': document.body.dataset.iconBar = msg.position || 'left'; break;
        case 'integrationsAdapters':
            window.integrationAdapters = Array.isArray(msg.adapterIds) ? msg.adapterIds : [];
            if (typeof syncIntegrationsUi === 'function') syncIntegrationsUi();
            var ibCrash = document.getElementById('ib-crashlytics');
            if (ibCrash) ibCrash.classList.toggle('ib-integration-enabled', window.integrationAdapters.indexOf('crashlytics') >= 0);
            break;
    }
});
`;
}

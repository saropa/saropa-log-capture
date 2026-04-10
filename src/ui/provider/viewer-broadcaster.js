"use strict";
/**
 * Broadcasts viewer state changes to all registered ViewerTarget instances.
 *
 * Used by extension.ts to send data to both the sidebar LogViewerProvider
 * and the pop-out PopOutPanel without duplicating every call.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViewerBroadcaster = void 0;
const log_viewer_provider_batch_1 = require("./log-viewer-provider-batch");
/** Dispatches every ViewerTarget method to all registered targets. */
class ViewerBroadcaster {
    targets = new Set();
    diagnosticCache;
    /** Set the diagnostic cache used to attach lint counts to outgoing lines. */
    setDiagnosticCache(cache) { this.diagnosticCache = cache; }
    /** Register a target to receive broadcasts. */
    addTarget(target) { this.targets.add(target); }
    /** Unregister a target. */
    removeTarget(target) { this.targets.delete(target); }
    addLine(data) {
        const line = (0, log_viewer_provider_batch_1.buildPendingLineFromLineData)(data, this.diagnosticCache);
        for (const t of this.targets) {
            // Pop-out defers raw LineData while loading disk snapshot; it cannot use pre-built HTML yet.
            if (t.isLiveCaptureHydrating?.()) {
                t.addLine(data);
                continue;
            }
            t.appendLiveLineFromBroadcast({ ...line }, data.text);
        }
    }
    appendLiveLineFromBroadcast(line, rawText) {
        for (const t of this.targets) {
            t.appendLiveLineFromBroadcast({ ...line }, rawText);
        }
    }
    clear() {
        for (const t of this.targets) {
            t.clear();
        }
    }
    setPaused(paused) {
        for (const t of this.targets) {
            t.setPaused(paused);
        }
    }
    setFilename(filename) {
        for (const t of this.targets) {
            t.setFilename(filename);
        }
    }
    setExclusions(patterns) {
        for (const t of this.targets) {
            t.setExclusions(patterns);
        }
    }
    setAnnotation(lineIndex, text) {
        for (const t of this.targets) {
            t.setAnnotation(lineIndex, text);
        }
    }
    loadAnnotations(annotations) {
        for (const t of this.targets) {
            t.loadAnnotations(annotations);
        }
    }
    setSplitInfo(currentPart, totalParts) {
        for (const t of this.targets) {
            t.setSplitInfo(currentPart, totalParts);
        }
    }
    updateFooter(text) {
        for (const t of this.targets) {
            t.updateFooter(text);
        }
    }
    setContextLines(count) {
        for (const t of this.targets) {
            t.setContextLines(count);
        }
    }
    setContextViewLines(count) {
        for (const t of this.targets) {
            t.setContextViewLines(count);
        }
    }
    setCopyContextLines(count) {
        for (const t of this.targets) {
            t.setCopyContextLines(count);
        }
    }
    setShowElapsed(show) {
        for (const t of this.targets) {
            t.setShowElapsed(show);
        }
    }
    setErrorClassificationSettings(settings) {
        for (const t of this.targets) {
            t.setErrorClassificationSettings(settings);
        }
    }
    applyPreset(name) {
        for (const t of this.targets) {
            t.applyPreset(name);
        }
    }
    setHighlightRules(rules) {
        for (const t of this.targets) {
            t.setHighlightRules(rules);
        }
    }
    setPresets(presets) {
        for (const t of this.targets) {
            t.setPresets(presets);
        }
    }
    setCurrentFile(uri) {
        for (const t of this.targets) {
            t.setCurrentFile(uri);
        }
    }
    setSessionInfo(info) {
        for (const t of this.targets) {
            t.setSessionInfo(info);
        }
    }
    setHasPerformanceData(has) {
        for (const t of this.targets) {
            t.setHasPerformanceData(has);
        }
    }
    sendSessionList(sessions, rootInfo) {
        for (const t of this.targets) {
            t.sendSessionList(sessions, rootInfo);
        }
    }
    sendSessionListLoading(folderPath) {
        for (const t of this.targets) {
            t.sendSessionListLoading(folderPath);
        }
    }
    sendDisplayOptions(options) {
        for (const t of this.targets) {
            t.sendDisplayOptions(options);
        }
    }
    setSessionActive(active) {
        for (const t of this.targets) {
            t.setSessionActive(active);
        }
    }
    updateWatchCounts(counts) {
        for (const t of this.targets) {
            t.updateWatchCounts(counts);
        }
    }
    sendBookmarkList(files) {
        for (const t of this.targets) {
            t.sendBookmarkList(files);
        }
    }
    setScopeContext(context) {
        for (const t of this.targets) {
            t.setScopeContext(context);
        }
    }
    setMinimapShowInfo(show) {
        for (const t of this.targets) {
            t.setMinimapShowInfo(show);
        }
    }
    setMinimapShowSqlDensity(show) {
        for (const t of this.targets) {
            t.setMinimapShowSqlDensity(show);
        }
    }
    setMinimapProportionalLines(show) {
        for (const t of this.targets) {
            t.setMinimapProportionalLines(show);
        }
    }
    setMinimapViewportRedOutline(show) {
        for (const t of this.targets) {
            t.setMinimapViewportRedOutline(show);
        }
    }
    setMinimapViewportOutsideArrow(show) {
        for (const t of this.targets) {
            t.setMinimapViewportOutsideArrow(show);
        }
    }
    setViewerRepeatThresholds(thresholds) {
        for (const t of this.targets) {
            t.setViewerRepeatThresholds(thresholds);
        }
    }
    setViewerDbInsightsEnabled(enabled) {
        for (const t of this.targets) {
            t.setViewerDbInsightsEnabled(enabled);
        }
    }
    setStaticSqlFromFingerprintEnabled(enabled) {
        for (const t of this.targets) {
            t.setStaticSqlFromFingerprintEnabled(enabled);
        }
    }
    setViewerDbDetectorToggles(toggles) {
        for (const t of this.targets) {
            t.setViewerDbDetectorToggles(toggles);
        }
    }
    setViewerSlowBurstThresholds(thresholds) {
        for (const t of this.targets) {
            t.setViewerSlowBurstThresholds(thresholds);
        }
    }
    setMinimapWidth(width) {
        for (const t of this.targets) {
            t.setMinimapWidth(width);
        }
    }
    setScrollbarVisible(show) {
        for (const t of this.targets) {
            t.setScrollbarVisible(show);
        }
    }
    setSearchMatchOptionsAlwaysVisible(always) {
        for (const t of this.targets) {
            t.setSearchMatchOptionsAlwaysVisible(always);
        }
    }
    setIconBarPosition(position) {
        for (const t of this.targets) {
            t.setIconBarPosition(position);
        }
    }
    setErrorRateConfig(config) {
        for (const t of this.targets) {
            t.setErrorRateConfig(config);
        }
    }
    setAutoHidePatterns(patterns) {
        for (const t of this.targets) {
            t.setAutoHidePatterns(patterns);
        }
    }
    setDbBaselineFingerprintSummary(entries) {
        for (const t of this.targets) {
            t.setDbBaselineFingerprintSummary(entries);
        }
    }
    postToWebview(message) {
        for (const t of this.targets) {
            t.postToWebview(message);
        }
    }
}
exports.ViewerBroadcaster = ViewerBroadcaster;
//# sourceMappingURL=viewer-broadcaster.js.map
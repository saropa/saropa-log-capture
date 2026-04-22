"use strict";
/**
 * PostMessage-based state updates for LogViewerProvider (set* / send*).
 * Extracted to keep log-viewer-provider.ts under the line limit.
 *
 * Viewer-affecting workspace settings (e.g. `showScrollbar`, `viewerAlwaysShowSearchMatchOptions`) are
 * read in the extension host, then pushed here as small typed messages; the webview applies `body` classes
 * or DOM updates in `viewer-script-messages.ts` — avoid duplicating config parsing inside the iframe.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.scrollToLineImpl = scrollToLineImpl;
exports.setExclusionsImpl = setExclusionsImpl;
exports.setAnnotationImpl = setAnnotationImpl;
exports.loadAnnotationsImpl = loadAnnotationsImpl;
exports.setSplitInfoImpl = setSplitInfoImpl;
exports.setSessionNavInfoImpl = setSessionNavInfoImpl;
exports.updateFooterImpl = updateFooterImpl;
exports.setPausedImpl = setPausedImpl;
exports.setFilenameImpl = setFilenameImpl;
exports.setContextLinesImpl = setContextLinesImpl;
exports.setContextViewLinesImpl = setContextViewLinesImpl;
exports.setCopyContextLinesImpl = setCopyContextLinesImpl;
exports.setShowElapsedImpl = setShowElapsedImpl;
exports.getReplayConfig = getReplayConfig;
exports.setErrorClassificationSettingsImpl = setErrorClassificationSettingsImpl;
exports.applyPresetImpl = applyPresetImpl;
exports.setHighlightRulesImpl = setHighlightRulesImpl;
exports.setPresetsImpl = setPresetsImpl;
exports.setScopeContextImpl = setScopeContextImpl;
exports.setMinimapShowInfoImpl = setMinimapShowInfoImpl;
exports.setMinimapShowSqlDensityImpl = setMinimapShowSqlDensityImpl;
exports.setMinimapProportionalLinesImpl = setMinimapProportionalLinesImpl;
exports.setMinimapViewportRedOutlineImpl = setMinimapViewportRedOutlineImpl;
exports.setMinimapViewportOutsideArrowImpl = setMinimapViewportOutsideArrowImpl;
exports.setViewerRepeatThresholdsImpl = setViewerRepeatThresholdsImpl;
exports.setViewerDbSignalsEnabledImpl = setViewerDbSignalsEnabledImpl;
exports.setStaticSqlFromFingerprintEnabledImpl = setStaticSqlFromFingerprintEnabledImpl;
exports.setViewerDbDetectorTogglesImpl = setViewerDbDetectorTogglesImpl;
exports.setDbBaselineFingerprintSummaryImpl = setDbBaselineFingerprintSummaryImpl;
exports.setViewerSlowBurstThresholdsImpl = setViewerSlowBurstThresholdsImpl;
exports.setViewerSqlPatternChipSettingsImpl = setViewerSqlPatternChipSettingsImpl;
exports.setMinimapWidthImpl = setMinimapWidthImpl;
exports.setScrollbarVisibleImpl = setScrollbarVisibleImpl;
exports.setSearchMatchOptionsAlwaysVisibleImpl = setSearchMatchOptionsAlwaysVisibleImpl;
exports.setIconBarPositionImpl = setIconBarPositionImpl;
exports.setErrorRateConfigImpl = setErrorRateConfigImpl;
exports.setAutoHidePatternsImpl = setAutoHidePatternsImpl;
exports.setSessionInfoImpl = setSessionInfoImpl;
exports.setHasPerformanceDataImpl = setHasPerformanceDataImpl;
exports.setCodeQualityPayloadImpl = setCodeQualityPayloadImpl;
exports.sendFindResultsImpl = sendFindResultsImpl;
exports.setupFindSearchImpl = setupFindSearchImpl;
exports.findNextMatchImpl = findNextMatchImpl;
exports.sendSessionListImpl = sendSessionListImpl;
exports.sendSessionListLoadingImpl = sendSessionListLoadingImpl;
exports.sendBookmarkListImpl = sendBookmarkListImpl;
exports.sendDisplayOptionsImpl = sendDisplayOptionsImpl;
exports.sendIntegrationsAdaptersImpl = sendIntegrationsAdaptersImpl;
exports.setSessionStateImpl = setSessionStateImpl;
exports.postStartReplayImpl = postStartReplayImpl;
const config_1 = require("../../modules/config/config");
const helpers = __importStar(require("./viewer-provider-helpers"));
function scrollToLineImpl(target, line) {
    target.postMessage({ type: "scrollToLine", line });
}
function setExclusionsImpl(target, patterns) {
    target.postMessage({ type: "setExclusions", patterns });
}
function setAnnotationImpl(target, lineIndex, text) {
    target.postMessage({ type: "setAnnotation", lineIndex, text });
}
function loadAnnotationsImpl(target, annotations) {
    target.postMessage({ type: "loadAnnotations", annotations });
}
function setSplitInfoImpl(target, currentPart, totalParts) {
    target.postMessage({ type: "splitInfo", currentPart, totalParts });
}
function setSessionNavInfoImpl(target, opts) {
    target.postMessage({ type: "sessionNavInfo", ...opts });
}
function updateFooterImpl(target, text) {
    target.postMessage({ type: "updateFooter", text });
}
function setPausedImpl(target, paused) {
    target.postMessage({ type: "setPaused", paused });
}
function setFilenameImpl(target, filename) {
    target.postMessage({ type: "setFilename", filename });
    const levels = helpers.getSavedLevelFilters(target.getContext(), filename);
    if (levels) {
        target.postMessage({ type: "restoreLevelFilters", levels });
    }
}
function setContextLinesImpl(target, count) {
    target.postMessage({ type: "setContextLines", count });
}
function setContextViewLinesImpl(target, count) {
    target.postMessage({ type: "setContextViewLines", count });
}
function setCopyContextLinesImpl(target, count) {
    target.postMessage({ type: "setCopyContextLines", count });
}
function setShowElapsedImpl(target, show) {
    target.postMessage({ type: "setShowElapsed", show });
}
function getReplayConfig() {
    const r = (0, config_1.getConfig)().replay;
    return { defaultMode: r.defaultMode, defaultSpeed: r.defaultSpeed, minLineDelayMs: r.minLineDelayMs, maxDelayMs: r.maxDelayMs };
}
function setErrorClassificationSettingsImpl(target, opts) {
    target.postMessage({ type: "errorClassificationSettings", ...opts });
}
function applyPresetImpl(target, name) {
    target.postMessage({ type: "applyPreset", name });
}
function setHighlightRulesImpl(target, rules) {
    target.postMessage({ type: "setHighlightRules", rules });
}
function setPresetsImpl(target, presets) {
    const lastUsed = target.getContext().workspaceState.get("saropaLogCapture.lastUsedPresetName");
    target.postMessage({ type: "setPresets", presets, lastUsedPresetName: lastUsed });
}
function setScopeContextImpl(target, ctx) {
    target.postMessage({ type: "setScopeContext", ...ctx });
}
function setMinimapShowInfoImpl(target, show) {
    target.postMessage({ type: "minimapShowInfo", show });
}
function setMinimapShowSqlDensityImpl(target, show) {
    target.postMessage({ type: "minimapShowSqlDensity", show });
}
function setMinimapProportionalLinesImpl(target, show) {
    target.postMessage({ type: "minimapProportionalLines", show });
}
function setMinimapViewportRedOutlineImpl(target, show) {
    target.postMessage({ type: "minimapViewportRedOutline", show });
}
function setMinimapViewportOutsideArrowImpl(target, show) {
    target.postMessage({ type: "minimapViewportOutsideArrow", show });
}
function setViewerRepeatThresholdsImpl(target, thresholds) {
    target.postMessage({
        type: "setViewerRepeatThresholds",
        thresholds: {
            globalMinCount: thresholds.globalMinCount,
            readMinCount: thresholds.readMinCount,
            transactionMinCount: thresholds.transactionMinCount,
            dmlMinCount: thresholds.dmlMinCount,
        },
    });
}
function setViewerDbSignalsEnabledImpl(target, enabled) {
    target.postMessage({ type: "setViewerDbSignalsEnabled", enabled });
}
function setStaticSqlFromFingerprintEnabledImpl(target, enabled) {
    target.postMessage({ type: "setStaticSqlFromFingerprintEnabled", enabled });
}
function setViewerDbDetectorTogglesImpl(target, toggles) {
    target.postMessage({
        type: "setViewerDbDetectorToggles",
        nPlusOneEnabled: toggles.nPlusOneEnabled,
        slowBurstEnabled: toggles.slowBurstEnabled,
        baselineHintsEnabled: toggles.baselineHintsEnabled,
    });
}
function setDbBaselineFingerprintSummaryImpl(target, entries) {
    target.postMessage({ type: "setDbBaselineFingerprintSummary", fingerprints: entries });
}
function setViewerSlowBurstThresholdsImpl(target, thresholds) {
    target.postMessage({
        type: "setViewerSlowBurstThresholds",
        thresholds: {
            slowQueryMs: thresholds.slowQueryMs,
            burstMinCount: thresholds.burstMinCount,
            burstWindowMs: thresholds.burstWindowMs,
            cooldownMs: thresholds.cooldownMs,
        },
    });
}
function setViewerSqlPatternChipSettingsImpl(target, chipMinCount, chipMaxChips) {
    target.postMessage({ type: "setViewerSqlPatternChipSettings", chipMinCount, chipMaxChips });
}
function setMinimapWidthImpl(target, width) {
    target.postMessage({ type: "minimapWidth", width });
}
function setScrollbarVisibleImpl(target, show) {
    target.postMessage({ type: "scrollbarVisible", show });
}
function setSearchMatchOptionsAlwaysVisibleImpl(target, always) {
    target.postMessage({ type: "searchMatchOptionsAlwaysVisible", always });
}
function setIconBarPositionImpl(target, position) {
    target.postMessage({ type: "iconBarPosition", position });
}
function setErrorRateConfigImpl(target, config) {
    target.postMessage({
        type: "setErrorRateConfig",
        bucketSize: config.bucketSize,
        showWarnings: config.showWarnings,
        detectSpikes: config.detectSpikes,
    });
}
function setAutoHidePatternsImpl(target, patterns) {
    target.postMessage({ type: "setAutoHidePatterns", patterns: [...patterns] });
}
function setSessionInfoImpl(target, info) {
    target.postMessage({ type: "setSessionInfo", info });
}
function setHasPerformanceDataImpl(target, has) {
    target.postMessage({ type: "setHasPerformanceData", has });
}
function setCodeQualityPayloadImpl(target, payload) {
    target.postMessage({ type: "setCodeQualityPayload", payload });
}
function sendFindResultsImpl(target, results) {
    target.postMessage({ type: "findResults", ...results });
}
function setupFindSearchImpl(target, query, options) {
    target.postMessage({ type: "setupFindSearch", query, ...options });
}
function findNextMatchImpl(target) {
    target.postMessage({ type: "findNextMatch" });
}
function sendSessionListImpl(target, sessions, rootInfo) {
    target.postMessage({ type: "sessionList", sessions, ...rootInfo });
}
function sendSessionListLoadingImpl(target, folderPath) {
    target.postMessage({ type: "sessionListLoading", folderPath });
}
function sendBookmarkListImpl(target, files) {
    target.postMessage({ type: "bookmarkList", files });
}
function sendDisplayOptionsImpl(target, options) {
    target.postMessage({ type: "sessionDisplayOptions", options });
}
function sendIntegrationsAdaptersImpl(target, adapterIds) {
    target.postMessage({ type: "integrationsAdapters", adapterIds: [...adapterIds] });
}
function setSessionStateImpl(target, active) {
    target.postMessage({ type: "sessionState", active });
}
function postStartReplayImpl(target) {
    target.postMessage({ type: "startReplay", replayConfig: getReplayConfig() });
}
//# sourceMappingURL=log-viewer-provider-state.js.map
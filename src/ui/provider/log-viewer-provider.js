"use strict";
/**
 * Sidebar log viewer webview host. Implements ViewerTarget so it receives broadcaster
 * calls (addLine, setFilename, setSessionInfo, etc.) and postMessage from the iframe;
 * wires handlers via viewer-handler-wiring and viewer-message-handler.
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
exports.LogViewerProvider = void 0;
const vscode = __importStar(require("vscode"));
const log_viewer_provider_load_1 = require("./log-viewer-provider-load");
const log_viewer_provider_setup_1 = require("./log-viewer-provider-setup");
const viewer_highlight_serializer_1 = require("../viewer-decorations/viewer-highlight-serializer");
const helpers = __importStar(require("./viewer-provider-helpers"));
const viewer_thread_grouping_1 = require("../viewer/viewer-thread-grouping");
const panelHandlers = __importStar(require("../shared/viewer-panel-handlers"));
const viewer_message_handler_1 = require("./viewer-message-handler");
const log_viewer_provider_batch_1 = require("./log-viewer-provider-batch");
const viewer_keybindings_1 = require("../viewer/viewer-keybindings");
const state = __importStar(require("./log-viewer-provider-state"));
class LogViewerProvider {
    extensionUri;
    version;
    context;
    /** All resolved webview views (one per window when the panel is open in multiple windows). */
    views = new Set();
    /** View that was most recently visible (for getView() and batch visibility). */
    visibleView;
    pendingLines = [];
    batchTimer;
    threadDumpState = (0, viewer_thread_grouping_1.createThreadDumpState)();
    onMarkerRequest;
    onLinkClick;
    onTogglePause;
    onExclusionAdded;
    onExclusionRemoved;
    onAnnotationPrompt;
    onSearchCodebase;
    onSearchSessions;
    onAnalyzeLine;
    onAddToWatch;
    onPartNavigate;
    onSavePresetRequest;
    onSessionListRequest;
    onOpenSessionFromPanel;
    onDisplayOptionsChange;
    onPopOutRequest;
    onOpenInsightTabRequest;
    onRevealLogFile;
    onAddBookmark;
    onFindInFiles;
    onOpenFindResult;
    onFindNavigateMatch;
    onBookmarkAction;
    onSessionNavigate;
    onFileLoaded;
    onSessionAction;
    onBrowseSessionRoot;
    onClearSessionRoot;
    seenCategories = new Set();
    unreadWatchHits = 0;
    cachedPresets = [];
    cachedHighlightRules = [];
    currentFileUri;
    isSessionActive = false;
    pendingLoadUri;
    loadGeneration = 0;
    tailWatcher;
    tailLastLineCount = 0;
    tailSessionMidnightMs = 0;
    tailUri;
    tailUpdateInProgress = false;
    constructor(extensionUri, version, context) {
        this.extensionUri = extensionUri;
        this.version = version;
        this.context = context;
        this.context.subscriptions.push(vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration('saropaLogCapture.viewerKeybindings')) {
                const keyToAction = (0, viewer_keybindings_1.getViewerKeybindingsFromConfig)();
                this.postMessage({ type: 'setViewerKeybindings', keyToAction });
            }
        }));
    }
    resolveWebviewView(webviewView) {
        this.views.add(webviewView);
        if (webviewView.visible) {
            this.visibleView = webviewView;
        }
        (0, log_viewer_provider_setup_1.setupLogViewerWebview)(this, webviewView);
    }
    removeView(webviewView) {
        this.views.delete(webviewView);
        if (this.visibleView === webviewView) {
            this.visibleView = undefined;
        }
        if (this.views.size === 0) {
            (0, log_viewer_provider_batch_1.stopBatchTimer)(this);
        }
    }
    setVisibleView(webviewView) { this.visibleView = webviewView; }
    getCachedPresets() { return this.cachedPresets; }
    getCachedHighlightRules() { return this.cachedHighlightRules; }
    getPendingLoadUri() { return this.pendingLoadUri; }
    setView(view) {
        if (view === undefined) {
            this.visibleView = undefined;
        }
        else {
            this.views.add(view);
            this.visibleView = view;
        }
    }
    getUnreadWatchHits() { return this.unreadWatchHits; }
    setUnreadWatchHits(n) { this.unreadWatchHits = n; }
    getExtensionUri() { return this.extensionUri; }
    getVersion() { return this.version; }
    getContext() { return this.context; }
    // -- Handler setters (one callback per webview action) --
    setMarkerHandler(handler) { this.onMarkerRequest = handler; }
    setTogglePauseHandler(handler) { this.onTogglePause = handler; }
    setExclusionAddedHandler(handler) { this.onExclusionAdded = handler; }
    setExclusionRemovedHandler(handler) { this.onExclusionRemoved = handler; }
    setAnnotationPromptHandler(handler) { this.onAnnotationPrompt = handler; }
    setSearchCodebaseHandler(handler) { this.onSearchCodebase = handler; }
    setSearchSessionsHandler(handler) { this.onSearchSessions = handler; }
    setAnalyzeLineHandler(handler) { this.onAnalyzeLine = handler; }
    setAddToWatchHandler(handler) { this.onAddToWatch = handler; }
    setLinkClickHandler(handler) { this.onLinkClick = handler; }
    setPartNavigateHandler(handler) { this.onPartNavigate = handler; }
    setSavePresetRequestHandler(handler) { this.onSavePresetRequest = handler; }
    setSessionListHandler(handler) { this.onSessionListRequest = handler; }
    setOpenSessionFromPanelHandler(handler) { this.onOpenSessionFromPanel = handler; }
    setDisplayOptionsHandler(handler) { this.onDisplayOptionsChange = handler; }
    setPopOutHandler(handler) { this.onPopOutRequest = handler; }
    setOpenInsightTabHandler(handler) { this.onOpenInsightTabRequest = handler; }
    setRevealLogFileHandler(handler) { this.onRevealLogFile = handler; }
    setAddBookmarkHandler(handler) { this.onAddBookmark = handler; }
    setFindInFilesHandler(handler) { this.onFindInFiles = handler; }
    setOpenFindResultHandler(handler) { this.onOpenFindResult = handler; }
    setFindNavigateMatchHandler(handler) { this.onFindNavigateMatch = handler; }
    setBookmarkActionHandler(handler) { this.onBookmarkAction = handler; }
    setSessionNavigateHandler(handler) { this.onSessionNavigate = handler; }
    setFileLoadedHandler(handler) { this.onFileLoaded = handler; }
    setSessionActionHandler(handler) { this.onSessionAction = handler; }
    setBrowseSessionRootHandler(handler) { this.onBrowseSessionRoot = handler; }
    setClearSessionRootHandler(handler) { this.onClearSessionRoot = handler; }
    // -- Webview state methods --
    scrollToLine(line) { state.scrollToLineImpl(this, line); }
    setExclusions(patterns) { state.setExclusionsImpl(this, patterns); }
    setAnnotation(lineIndex, text) { state.setAnnotationImpl(this, lineIndex, text); }
    loadAnnotations(annotations) { state.loadAnnotationsImpl(this, annotations); }
    setSplitInfo(currentPart, totalParts) { state.setSplitInfoImpl(this, currentPart, totalParts); }
    setSessionNavInfo(hasPrev, hasNext, index, total) { state.setSessionNavInfoImpl(this, { hasPrev, hasNext, index, total }); }
    getCurrentFileUri() { return this.currentFileUri; }
    updateFooter(text) { state.updateFooterImpl(this, text); }
    setPaused(paused) { state.setPausedImpl(this, paused); }
    setFilename(filename) { state.setFilenameImpl(this, filename); }
    setContextLines(count) { state.setContextLinesImpl(this, count); }
    setContextViewLines(count) { state.setContextViewLinesImpl(this, count); }
    setCopyContextLines(count) { state.setCopyContextLinesImpl(this, count); }
    setShowElapsed(show) { state.setShowElapsedImpl(this, show); }
    setShowDecorations(show) { state.setShowDecorationsImpl(this, show); }
    startReplay() { state.postStartReplayImpl(this); }
    getReplayConfig() { return state.getReplayConfig(); }
    setErrorClassificationSettings(suppressTransientErrors, breakOnCritical, levelDetection, deemphasizeFrameworkLevels, stderrTreatAsError) {
        state.setErrorClassificationSettingsImpl(this, {
            suppressTransientErrors, breakOnCritical, levelDetection, deemphasizeFrameworkLevels, stderrTreatAsError,
        });
    }
    applyPreset(name) { state.applyPresetImpl(this, name); }
    setHighlightRules(rules) {
        this.cachedHighlightRules = (0, viewer_highlight_serializer_1.serializeHighlightRules)(rules);
        state.setHighlightRulesImpl(this, this.cachedHighlightRules);
    }
    setPresets(presets) {
        this.cachedPresets = presets;
        state.setPresetsImpl(this, presets);
    }
    addLine(data) { (0, log_viewer_provider_batch_1.addLineToBatch)(this, data); }
    appendLiveLineFromBroadcast(line, rawText) {
        (0, log_viewer_provider_batch_1.appendLiveLineToBatch)(this, line, rawText);
    }
    setCurrentFile(uri) {
        this.currentFileUri = uri;
        this.postMessage({ type: 'currentLogChanged', currentFileUri: uri?.toString() });
    }
    setScopeContext(ctx) { state.setScopeContextImpl(this, ctx); }
    setMinimapShowInfo(show) { state.setMinimapShowInfoImpl(this, show); }
    setMinimapShowSqlDensity(show) { state.setMinimapShowSqlDensityImpl(this, show); }
    setMinimapProportionalLines(show) { state.setMinimapProportionalLinesImpl(this, show); }
    setMinimapViewportRedOutline(show) { state.setMinimapViewportRedOutlineImpl(this, show); }
    setMinimapViewportOutsideArrow(show) { state.setMinimapViewportOutsideArrowImpl(this, show); }
    setViewerRepeatThresholds(thresholds) {
        state.setViewerRepeatThresholdsImpl(this, thresholds);
    }
    setViewerDbInsightsEnabled(enabled) {
        state.setViewerDbInsightsEnabledImpl(this, enabled);
    }
    setStaticSqlFromFingerprintEnabled(enabled) {
        state.setStaticSqlFromFingerprintEnabledImpl(this, enabled);
    }
    setViewerDbDetectorToggles(toggles) {
        state.setViewerDbDetectorTogglesImpl(this, toggles);
    }
    setDbBaselineFingerprintSummary(entries) {
        state.setDbBaselineFingerprintSummaryImpl(this, entries);
    }
    setViewerSlowBurstThresholds(thresholds) {
        state.setViewerSlowBurstThresholdsImpl(this, thresholds);
    }
    setViewerSqlPatternChipSettings(chipMinCount, chipMaxChips) {
        state.setViewerSqlPatternChipSettingsImpl(this, chipMinCount, chipMaxChips);
    }
    setMinimapWidth(width) { state.setMinimapWidthImpl(this, width); }
    setScrollbarVisible(show) { state.setScrollbarVisibleImpl(this, show); }
    setSearchMatchOptionsAlwaysVisible(always) { state.setSearchMatchOptionsAlwaysVisibleImpl(this, always); }
    setIconBarPosition(position) { state.setIconBarPositionImpl(this, position); }
    setErrorRateConfig(config) { state.setErrorRateConfigImpl(this, config); }
    setAutoHidePatterns(patterns) { state.setAutoHidePatternsImpl(this, patterns); }
    setSessionInfo(info) { state.setSessionInfoImpl(this, info); }
    setHasPerformanceData(has) { state.setHasPerformanceDataImpl(this, has); }
    setCodeQualityPayload(payload) { state.setCodeQualityPayloadImpl(this, payload); }
    sendFindResults(results) { state.sendFindResultsImpl(this, results); }
    setupFindSearch(query, options) { state.setupFindSearchImpl(this, query, options); }
    findNextMatch() { state.findNextMatchImpl(this); }
    sendSessionList(sessions, rootInfo) { state.sendSessionListImpl(this, sessions, rootInfo); }
    sendSessionListLoading(folderPath) { state.sendSessionListLoadingImpl(this, folderPath); }
    sendBookmarkList(files) { state.sendBookmarkListImpl(this, files); }
    sendDisplayOptions(options) { state.sendDisplayOptionsImpl(this, options); }
    sendIntegrationsAdapters(adapterIds) { state.sendIntegrationsAdaptersImpl(this, adapterIds); }
    setSessionActive(active) { this.isSessionActive = active; state.setSessionStateImpl(this, active); }
    clear() {
        this.stopTailing();
        (0, log_viewer_provider_batch_1.flushPendingBatch)(this);
        this.pendingLines = [];
        this.currentFileUri = undefined;
        this.postMessage({ type: "clear" });
        state.setSessionInfoImpl(this, null);
        state.setHasPerformanceDataImpl(this, false);
        state.setCodeQualityPayloadImpl(this, null);
    }
    async loadFromFile(uri, options) {
        const gen = ++this.loadGeneration;
        this.pendingLoadUri = uri;
        // Reveal viewer in every window that has the panel (multi-window fix).
        for (const v of this.views) {
            v.show?.(true);
        }
        for (let i = 0; i < 20 && this.views.size === 0; i++) {
            await new Promise(r => setTimeout(r, 50));
        }
        if (this.views.size === 0 || gen !== this.loadGeneration) {
            return;
        }
        this.stopTailing();
        this.clear();
        this.seenCategories.clear();
        this.currentFileUri = uri;
        const loadResult = await (0, log_viewer_provider_load_1.executeLoadContent)(this, uri, () => gen === this.loadGeneration);
        if (gen !== this.loadGeneration) {
            return;
        }
        this.onFileLoaded?.(uri, loadResult);
        this.pendingLoadUri = undefined;
        if (options?.tail) {
            this.startTailing(uri, loadResult.sessionMidnightMs, loadResult.contentLength);
        }
        if (options?.replay) {
            this.postMessage({ type: "startReplay", replayConfig: this.getReplayConfig() });
        }
    }
    stopTailing() {
        this.tailWatcher?.dispose();
        this.tailWatcher = undefined;
        this.tailUri = undefined;
    }
    startTailing(uri, sessionMidnightMs, initialLineCount) {
        this.stopTailing();
        this.tailUri = uri;
        this.tailSessionMidnightMs = sessionMidnightMs;
        this.tailWatcher = (0, log_viewer_provider_load_1.createTailWatcher)(uri, sessionMidnightMs, initialLineCount, this);
    }
    getTailLastLineCount() { return this.tailLastLineCount; }
    setTailLastLineCount(n) { this.tailLastLineCount = n; }
    getTailUpdateInProgress() { return this.tailUpdateInProgress; }
    setTailUpdateInProgress(v) { this.tailUpdateInProgress = v; }
    getView() {
        return this.visibleView ?? this.views.values().next().value;
    }
    getSeenCategories() { return this.seenCategories; }
    updateWatchCounts(counts) {
        const obj = Object.fromEntries(counts);
        const total = [...counts.values()].reduce((s, n) => s + n, 0);
        this.postMessage({ type: "updateWatchCounts", counts: obj });
        if (total > this.unreadWatchHits) {
            this.unreadWatchHits = total;
        }
        for (const v of this.views) {
            helpers.updateBadge(v, this.unreadWatchHits);
        }
    }
    dispose() {
        this.stopTailing();
        (0, log_viewer_provider_batch_1.stopBatchTimer)(this);
        this.views.clear();
        this.visibleView = undefined;
        panelHandlers.disposeHandlers();
    }
    handleMessage(msg) {
        if (msg.type === 'viewerFocused') {
            if (this.unreadWatchHits > 0) {
                this.unreadWatchHits = 0;
                for (const v of this.views) {
                    helpers.updateBadge(v, 0);
                }
            }
            return;
        }
        const ctx = {
            currentFileUri: this.currentFileUri, isSessionActive: this.isSessionActive,
            context: this.context, extensionVersion: this.version,
            post: (m) => this.postMessage(m), load: (u) => this.loadFromFile(u),
            onMarkerRequest: this.onMarkerRequest, onTogglePause: this.onTogglePause,
            onExclusionAdded: this.onExclusionAdded, onExclusionRemoved: this.onExclusionRemoved,
            onAnnotationPrompt: this.onAnnotationPrompt, onSearchCodebase: this.onSearchCodebase,
            onSearchSessions: this.onSearchSessions, onAnalyzeLine: this.onAnalyzeLine,
            onAddToWatch: this.onAddToWatch, onLinkClick: this.onLinkClick,
            onPartNavigate: this.onPartNavigate, onSavePresetRequest: this.onSavePresetRequest,
            onSessionListRequest: this.onSessionListRequest, onOpenSessionFromPanel: this.onOpenSessionFromPanel,
            onDisplayOptionsChange: this.onDisplayOptionsChange, onPopOutRequest: this.onPopOutRequest,
            onOpenInsightTabRequest: this.onOpenInsightTabRequest, onRevealLogFile: this.onRevealLogFile, onAddBookmark: this.onAddBookmark,
            onFindInFiles: this.onFindInFiles, onOpenFindResult: this.onOpenFindResult,
            onFindNavigateMatch: this.onFindNavigateMatch, onBookmarkAction: this.onBookmarkAction,
            onSessionNavigate: this.onSessionNavigate, onSessionAction: this.onSessionAction,
            onBrowseSessionRoot: this.onBrowseSessionRoot, onClearSessionRoot: this.onClearSessionRoot,
        };
        (0, viewer_message_handler_1.dispatchViewerMessage)(msg, ctx);
    }
    startBatchTimer() { (0, log_viewer_provider_batch_1.startBatchTimer)(this); }
    stopBatchTimer() { (0, log_viewer_provider_batch_1.stopBatchTimer)(this); }
    postMessage(message) {
        const snapshot = [...this.views];
        for (const v of snapshot) {
            v.webview.postMessage(message);
        }
    }
    postToWebview(message) {
        this.postMessage(message);
    }
}
exports.LogViewerProvider = LogViewerProvider;
//# sourceMappingURL=log-viewer-provider.js.map
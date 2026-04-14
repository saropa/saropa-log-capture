"use strict";
/**
 * Pop-out log viewer panel.
 *
 * Opens the same viewer HTML as an editor-tab WebviewPanel so the user
 * can drag it to a second monitor. Implements ViewerTarget for broadcast
 * compatibility with the sidebar LogViewerProvider.
 *
 * On first open, the panel hydrates from the same log file URI as the main viewer
 * (`executeLoadContent`) so the pop-out shows full session history, not only lines emitted
 * after the window was created. Live `addLine` events during that async load are deferred
 * and replayed (see `filterDeferredLinesAfterSnapshot`) to avoid gaps and duplicates.
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
exports.PopOutPanel = void 0;
const vscode = __importStar(require("vscode"));
const viewer_content_1 = require("../provider/viewer-content");
const config_1 = require("../../modules/config/config");
const viewer_highlight_serializer_1 = require("../viewer-decorations/viewer-highlight-serializer");
const helpers = __importStar(require("../provider/viewer-provider-helpers"));
const log_viewer_provider_batch_1 = require("../provider/log-viewer-provider-batch");
const viewer_thread_grouping_1 = require("../viewer/viewer-thread-grouping");
const viewer_message_handler_1 = require("../provider/viewer-message-handler");
const log_viewer_provider_load_1 = require("../provider/log-viewer-provider-load");
const pop_out_panel_viewer_config_post_1 = require("./pop-out-panel-viewer-config-post");
const pop_out_panel_deferred_replay_1 = require("./pop-out-panel-deferred-replay");
const pop_out_panel_viewer_state_1 = require("./pop-out-panel-viewer-state");
const pop_out_panel_batch_1 = require("./pop-out-panel-batch");
const pop_out_panel_message_context_1 = require("./pop-out-panel-message-context");
/** Pop-out viewer as an editor tab (movable to a floating window). */
class PopOutPanel {
    extensionUri;
    version;
    context;
    broadcaster;
    panel;
    /** Public for BatchTarget (same as LogViewerProvider). */
    pendingLines = [];
    batchTimer;
    threadDumpState = (0, viewer_thread_grouping_1.createThreadDumpState)();
    seenCategories = new Set();
    cachedPresets = [];
    cachedHighlightRules = [];
    currentFileUri;
    isSessionActive = false;
    // Handler callbacks (wired from extension.ts, same pattern as LogViewerProvider).
    handlers = {};
    /** Snapshot URI from the main viewer so the pop-out can load full on-disk history when opened. */
    getHydrationUri;
    hydratingFromFile = false;
    deferredLinesDuringHydrate = [];
    hydrateGen = 0;
    constructor(opts) {
        this.extensionUri = opts.extensionUri;
        this.version = opts.version;
        this.context = opts.context;
        this.broadcaster = opts.broadcaster;
        this.getHydrationUri = opts.getHydrationUri;
    }
    /** Open or reveal the pop-out panel, then move to a new window. */
    async open() {
        if (this.panel) {
            this.panel.reveal();
            return;
        }
        // Buffer live lines while we load from disk so the webview shows full history, not only post-open lines.
        this.hydratingFromFile = true;
        this.deferredLinesDuringHydrate = [];
        const audioUri = vscode.Uri.joinPath(this.extensionUri, 'audio');
        const codiconsUri = vscode.Uri.joinPath(this.extensionUri, 'media', 'codicons');
        try {
            this.panel = vscode.window.createWebviewPanel('saropaLogCapture.popOutViewer', 'Saropa Log Capture', vscode.ViewColumn.Active, { enableScripts: true, retainContextWhenHidden: true, localResourceRoots: [audioUri, codiconsUri] });
            this.broadcaster.addTarget(this);
            this.setupWebview(audioUri, codiconsUri);
        }
        catch (e) {
            this.hydratingFromFile = false;
            if (this.panel) {
                this.broadcaster.removeTarget(this);
                this.panel.dispose();
                this.panel = undefined;
            }
            throw e;
        }
        this.panel.reveal();
        await vscode.commands.executeCommand('workbench.action.moveEditorToNewWindow');
    }
    /** Whether the panel is currently visible. */
    get isOpen() { return !!this.panel; }
    // -- Handler setters --
    setMarkerHandler(h) { this.handlers.onMarkerRequest = h; }
    setTogglePauseHandler(h) { this.handlers.onTogglePause = h; }
    setExclusionAddedHandler(h) { this.handlers.onExclusionAdded = h; }
    setExclusionRemovedHandler(h) { this.handlers.onExclusionRemoved = h; }
    setAnnotationPromptHandler(h) { this.handlers.onAnnotationPrompt = h; }
    setSearchCodebaseHandler(h) { this.handlers.onSearchCodebase = h; }
    setSearchSessionsHandler(h) { this.handlers.onSearchSessions = h; }
    setAnalyzeLineHandler(h) { this.handlers.onAnalyzeLine = h; }
    setAddToWatchHandler(h) { this.handlers.onAddToWatch = h; }
    setLinkClickHandler(h) { this.handlers.onLinkClick = h; }
    setPartNavigateHandler(h) { this.handlers.onPartNavigate = h; }
    setSavePresetRequestHandler(h) { this.handlers.onSavePresetRequest = h; }
    setSessionListHandler(h) { this.handlers.onSessionListRequest = h; }
    setOpenSessionFromPanelHandler(h) { this.handlers.onOpenSessionFromPanel = h; }
    setDisplayOptionsHandler(h) { this.handlers.onDisplayOptionsChange = h; }
    setAddBookmarkHandler(h) { this.handlers.onAddBookmark = h; }
    setBookmarkActionHandler(h) { this.handlers.onBookmarkAction = h; }
    setSessionActionHandler(h) { this.handlers.onSessionAction = h; }
    setBrowseSessionRootHandler(h) { this.handlers.onBrowseSessionRoot = h; }
    setClearSessionRootHandler(h) { this.handlers.onClearSessionRoot = h; }
    // -- ViewerTarget state methods --
    addLine(data) {
        // During hydrate, capture all lines (even if panel not visible yet) so we don't drop or duplicate vs file load.
        if (this.hydratingFromFile) {
            this.deferredLinesDuringHydrate.push(data);
            return;
        }
        (0, log_viewer_provider_batch_1.addLineToBatch)(this, data);
    }
    /** Pre-built line from ViewerBroadcaster (avoids duplicate ANSI/linkify when sidebar + pop-out are both open). */
    appendLiveLineFromBroadcast(line, rawText) {
        (0, log_viewer_provider_batch_1.appendLiveLineToBatch)(this, line, rawText);
    }
    /** Pop-out buffers raw lines while loading snapshot from disk (see ViewerBroadcaster.addLine). */
    isLiveCaptureHydrating() {
        return this.hydratingFromFile;
    }
    /** Visibility for live batch pipeline (matches sidebar LogViewerProvider.getView). */
    getView() {
        return this.panel ? { visible: this.panel.visible } : undefined;
    }
    /** BatchTarget / LogViewerLoadTarget compatibility (sidebar uses postMessage naming). */
    getSeenCategories() {
        return this.seenCategories;
    }
    postMessage(message) {
        this.post(message);
    }
    clear() {
        (0, viewer_thread_grouping_1.flushThreadDump)(this.threadDumpState, this.pendingLines);
        this.pendingLines = [];
        this.currentFileUri = undefined;
        this.post({ type: "clear" });
        this.setSessionInfo(null);
        this.setHasPerformanceData(false);
    }
    setHasPerformanceData(has) { this.post({ type: "setHasPerformanceData", has }); }
    setPaused(paused) { this.post({ type: "setPaused", paused }); }
    setFilename(filename) {
        this.post({ type: "setFilename", filename });
        const levels = helpers.getSavedLevelFilters(this.context, filename);
        if (levels) {
            this.post({ type: "restoreLevelFilters", levels });
        }
    }
    setExclusions(patterns) { this.post({ type: "setExclusions", patterns }); }
    setAnnotation(lineIndex, text) { this.post({ type: "setAnnotation", lineIndex, text }); }
    loadAnnotations(a) { this.post({ type: "loadAnnotations", annotations: a }); }
    setSplitInfo(currentPart, totalParts) { this.post({ type: "splitInfo", currentPart, totalParts }); }
    updateFooter(text) { this.post({ type: "updateFooter", text }); }
    setContextLines(count) { this.post({ type: "setContextLines", count }); }
    setContextViewLines(count) { this.post({ type: "setContextViewLines", count }); }
    setCopyContextLines(count) { this.post({ type: "setCopyContextLines", count }); }
    setShowElapsed(show) { this.post({ type: "setShowElapsed", show }); }
    setErrorClassificationSettings(settings) {
        this.post({ type: "errorClassificationSettings", ...settings });
    }
    applyPreset(name) { this.post({ type: "applyPreset", name }); }
    setHighlightRules(rules) {
        this.cachedHighlightRules = (0, viewer_highlight_serializer_1.serializeHighlightRules)(rules);
        this.post({ type: "setHighlightRules", rules: this.cachedHighlightRules });
    }
    setPresets(presets) {
        this.cachedPresets = presets;
        const lastUsed = this.context.workspaceState.get("saropaLogCapture.lastUsedPresetName");
        this.post({ type: "setPresets", presets, lastUsedPresetName: lastUsed });
    }
    setCurrentFile(uri) { this.currentFileUri = uri; }
    setScopeContext(ctx) { (0, pop_out_panel_viewer_state_1.postScopeContext)(this, ctx); }
    setMinimapShowInfo(show) { this.post({ type: "minimapShowInfo", show }); }
    setMinimapShowSqlDensity(show) { this.post({ type: "minimapShowSqlDensity", show }); }
    setMinimapProportionalLines(show) { this.post({ type: "minimapProportionalLines", show }); }
    setMinimapViewportRedOutline(show) { this.post({ type: "minimapViewportRedOutline", show }); }
    setMinimapViewportOutsideArrow(show) { this.post({ type: "minimapViewportOutsideArrow", show }); }
    setViewerRepeatThresholds(t) { (0, pop_out_panel_viewer_state_1.postViewerRepeatThresholds)(this, t); }
    setViewerDbInsightsEnabled(enabled) { this.post({ type: "setViewerDbInsightsEnabled", enabled }); }
    setStaticSqlFromFingerprintEnabled(enabled) { this.post({ type: "setStaticSqlFromFingerprintEnabled", enabled }); }
    setViewerDbDetectorToggles(toggles) { (0, pop_out_panel_viewer_state_1.postViewerDbDetectorToggles)(this, toggles); }
    setDbBaselineFingerprintSummary(entries) { (0, pop_out_panel_viewer_state_1.postDbBaselineFingerprintSummary)(this, entries); }
    setViewerSlowBurstThresholds(t) { (0, pop_out_panel_viewer_state_1.postViewerSlowBurstThresholds)(this, t); }
    setMinimapWidth(width) { this.post({ type: "minimapWidth", width }); }
    setScrollbarVisible(show) { this.post({ type: "scrollbarVisible", show }); }
    setSearchMatchOptionsAlwaysVisible(always) { this.post({ type: "searchMatchOptionsAlwaysVisible", always }); }
    setIconBarPosition(position) { this.post({ type: "iconBarPosition", position }); }
    setErrorRateConfig(config) { (0, pop_out_panel_viewer_state_1.postErrorRateConfig)(this, config); }
    setAutoHidePatterns(patterns) { this.post({ type: "setAutoHidePatterns", patterns: [...patterns] }); }
    setSessionInfo(info) { this.post({ type: "setSessionInfo", info }); }
    sendSessionList(sessions, rootInfo) {
        this.post({ type: "sessionList", sessions, ...rootInfo });
    }
    sendSessionListLoading(folderPath) {
        this.post({ type: "sessionListLoading", folderPath });
    }
    sendBookmarkList(files) { this.post({ type: "bookmarkList", files }); }
    sendDisplayOptions(options) { this.post({ type: "sessionDisplayOptions", options }); }
    setSessionActive(active) { this.isSessionActive = active; this.post({ type: "sessionState", active }); }
    updateWatchCounts(counts) {
        this.post({ type: "updateWatchCounts", counts: Object.fromEntries(counts) });
    }
    dispose() {
        this.stopBatchTimer();
        this.panel?.dispose();
        this.panel = undefined;
    }
    // -- Private --
    setupWebview(audioUri, codiconsUri) {
        if (!this.panel) {
            return;
        }
        const wv = this.panel.webview;
        const audioWebviewUri = wv.asWebviewUri(audioUri).toString();
        const codiconCssUri = wv.asWebviewUri(vscode.Uri.joinPath(codiconsUri, 'codicon.css')).toString();
        const cfg = (0, config_1.getConfig)();
        const viewerMaxLines = (0, viewer_content_1.getEffectiveViewerLines)(cfg.maxLines, cfg.viewerMaxLines ?? 0);
        wv.html = (0, viewer_content_1.buildViewerHtml)({
            nonce: (0, viewer_content_1.getNonce)(),
            extensionUri: audioWebviewUri,
            version: this.version,
            cspSource: wv.cspSource,
            codiconCssUri,
            viewerMaxLines,
            viewerPreserveAsciiBoxArt: cfg.viewerPreserveAsciiBoxArt,
            viewerGroupAsciiArt: cfg.viewerGroupAsciiArt,
            viewerDetectAsciiArt: cfg.viewerDetectAsciiArt,
            viewerRepeatThresholds: cfg.viewerRepeatThresholds,
            viewerDbInsightsEnabled: cfg.viewerDbInsightsEnabled,
            staticSqlFromFingerprintEnabled: cfg.staticSqlFromFingerprintEnabled,
            viewerDbDetectorToggles: (0, config_1.viewerDbDetectorTogglesFromConfig)(cfg),
            viewerSlowBurstThresholds: cfg.viewerSlowBurstThresholds,
            signalSlowOpThresholdMs: cfg.signalSlowOpThresholdMs,
        });
        wv.onDidReceiveMessage((msg) => this.handleMessage(msg));
        this.startBatchTimer();
        queueMicrotask(() => helpers.sendCachedConfig(this.cachedPresets, this.cachedHighlightRules, (m) => this.post(m)));
        (0, pop_out_panel_viewer_config_post_1.queuePopOutViewerConfigMicrotask)((m) => this.post(m), cfg);
        void this.runHydrationFromDisk();
        this.panel.onDidDispose(() => {
            this.stopBatchTimer();
            this.broadcaster.removeTarget(this);
            this.panel = undefined;
        });
    }
    handleMessage(msg) {
        const ctx = (0, pop_out_panel_message_context_1.buildPopOutMessageContext)({ currentFileUri: this.currentFileUri, isSessionActive: this.isSessionActive, context: this.context, version: this.version, post: (m) => this.post(m) }, this.handlers);
        (0, viewer_message_handler_1.dispatchViewerMessage)(msg, ctx);
    }
    getPanel() { return this.panel; }
    startBatchTimer() { (0, pop_out_panel_batch_1.startPopOutBatchTimer)(this); }
    stopBatchTimer() { (0, pop_out_panel_batch_1.stopPopOutBatchTimer)(this); }
    post(message) { this.panel?.webview.postMessage(message); }
    postToWebview(message) {
        this.post(message);
    }
    /**
     * Load the same log file as the sidebar so the pop-out shows the full capture, not only lines after open.
     * Live lines received during load are deferred and replayed after the snapshot so nothing is dropped.
     */
    async runHydrationFromDisk() {
        const gen = ++this.hydrateGen;
        try {
            const uri = this.getHydrationUri?.();
            if (!uri) {
                this.replayDeferredLinesAfterSnapshot(undefined);
                return;
            }
            this.currentFileUri = uri;
            (0, viewer_thread_grouping_1.flushThreadDump)(this.threadDumpState, this.pendingLines);
            this.pendingLines = [];
            this.seenCategories.clear();
            this.post({ type: "clear" });
            const loadTarget = {
                postMessage: (m) => this.post(m),
                setFilename: (name) => this.setFilename(name),
                setSessionInfo: (info) => this.setSessionInfo(info),
                setHasPerformanceData: (has) => this.setHasPerformanceData(has),
                setCodeQualityPayload: (payload) => { this.post({ type: "setCodeQualityPayload", payload }); },
                getSeenCategories: () => this.seenCategories,
            };
            const result = await (0, log_viewer_provider_load_1.executeLoadContent)(loadTarget, uri, () => gen === this.hydrateGen && !!this.panel);
            if (gen !== this.hydrateGen || !this.panel) {
                return;
            }
            // Live capture uses addLine only; mirror the sidebar (not viewing a static file) after loading the snapshot.
            if (this.isSessionActive) {
                this.post({ type: "setViewingMode", viewing: false });
            }
            this.replayDeferredLinesAfterSnapshot(result.contentLength);
        }
        finally {
            this.hydratingFromFile = false;
        }
    }
    /** Replay lines that arrived while hydrating; skip ones already present in the file snapshot. */
    replayDeferredLinesAfterSnapshot(loadedContentLength) {
        const toReplay = (0, pop_out_panel_deferred_replay_1.filterDeferredLinesAfterSnapshot)(this.deferredLinesDuringHydrate, loadedContentLength);
        this.deferredLinesDuringHydrate = [];
        for (const d of toReplay) {
            (0, log_viewer_provider_batch_1.addLineToBatch)(this, d);
        }
    }
}
exports.PopOutPanel = PopOutPanel;
//# sourceMappingURL=pop-out-panel.js.map
"use strict";
/**
 * Pop-out log viewer panel.
 *
 * Opens the same viewer HTML as an editor-tab WebviewPanel so the user
 * can drag it to a second monitor. Implements ViewerTarget for broadcast
 * compatibility with the sidebar LogViewerProvider.
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
const ansi_1 = require("../../modules/capture/ansi");
const source_linker_1 = require("../../modules/source/source-linker");
const viewer_content_1 = require("../provider/viewer-content");
const config_1 = require("../../modules/config/config");
const viewer_highlight_serializer_1 = require("../viewer-decorations/viewer-highlight-serializer");
const helpers = __importStar(require("../provider/viewer-provider-helpers"));
const viewer_thread_grouping_1 = require("../viewer/viewer-thread-grouping");
const viewer_message_handler_1 = require("../provider/viewer-message-handler");
const pop_out_panel_viewer_config_post_1 = require("./pop-out-panel-viewer-config-post");
const BATCH_INTERVAL_MS = 200;
const BATCH_INTERVAL_UNDER_LOAD_MS = 500;
const BATCH_BACKLOG_THRESHOLD = 1000;
/** Pop-out viewer as an editor tab (movable to a floating window). */
class PopOutPanel {
    extensionUri;
    version;
    context;
    broadcaster;
    panel;
    pendingLines = [];
    batchTimer;
    threadDumpState = (0, viewer_thread_grouping_1.createThreadDumpState)();
    seenCategories = new Set();
    cachedPresets = [];
    cachedHighlightRules = [];
    currentFileUri;
    isSessionActive = false;
    // Handler callbacks (wired from extension.ts, same pattern as LogViewerProvider).
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
    onAddBookmark;
    onBookmarkAction;
    onSessionAction;
    onBrowseSessionRoot;
    onClearSessionRoot;
    constructor(extensionUri, version, context, broadcaster) {
        this.extensionUri = extensionUri;
        this.version = version;
        this.context = context;
        this.broadcaster = broadcaster;
    }
    /** Open or reveal the pop-out panel, then move to a new window. */
    async open() {
        if (this.panel) {
            this.panel.reveal();
            return;
        }
        const audioUri = vscode.Uri.joinPath(this.extensionUri, 'audio');
        const codiconsUri = vscode.Uri.joinPath(this.extensionUri, 'media', 'codicons');
        this.panel = vscode.window.createWebviewPanel('saropaLogCapture.popOutViewer', 'Saropa Log Capture', vscode.ViewColumn.Active, { enableScripts: true, retainContextWhenHidden: true, localResourceRoots: [audioUri, codiconsUri] });
        this.broadcaster.addTarget(this);
        this.setupWebview(audioUri, codiconsUri);
        this.panel.reveal();
        await vscode.commands.executeCommand('workbench.action.moveEditorToNewWindow');
    }
    /** Whether the panel is currently visible. */
    get isOpen() { return !!this.panel; }
    // -- Handler setters --
    setMarkerHandler(h) { this.onMarkerRequest = h; }
    setTogglePauseHandler(h) { this.onTogglePause = h; }
    setExclusionAddedHandler(h) { this.onExclusionAdded = h; }
    setExclusionRemovedHandler(h) { this.onExclusionRemoved = h; }
    setAnnotationPromptHandler(h) { this.onAnnotationPrompt = h; }
    setSearchCodebaseHandler(h) { this.onSearchCodebase = h; }
    setSearchSessionsHandler(h) { this.onSearchSessions = h; }
    setAnalyzeLineHandler(h) { this.onAnalyzeLine = h; }
    setAddToWatchHandler(h) { this.onAddToWatch = h; }
    setLinkClickHandler(h) { this.onLinkClick = h; }
    setPartNavigateHandler(h) { this.onPartNavigate = h; }
    setSavePresetRequestHandler(h) { this.onSavePresetRequest = h; }
    setSessionListHandler(h) { this.onSessionListRequest = h; }
    setOpenSessionFromPanelHandler(h) { this.onOpenSessionFromPanel = h; }
    setDisplayOptionsHandler(h) { this.onDisplayOptionsChange = h; }
    setAddBookmarkHandler(h) { this.onAddBookmark = h; }
    setBookmarkActionHandler(h) { this.onBookmarkAction = h; }
    setSessionActionHandler(h) { this.onSessionAction = h; }
    setBrowseSessionRootHandler(h) { this.onBrowseSessionRoot = h; }
    setClearSessionRootHandler(h) { this.onClearSessionRoot = h; }
    // -- ViewerTarget state methods --
    addLine(data) {
        /* Skip when panel not visible to avoid CPU spike (same as sidebar viewer). */
        if (!this.panel?.visible) {
            return;
        }
        let html = data.isMarker ? (0, ansi_1.escapeHtml)(data.text) : (0, source_linker_1.linkifyUrls)((0, source_linker_1.linkifyHtml)((0, ansi_1.ansiToHtml)(data.text)));
        if (!data.isMarker) {
            html = helpers.tryFormatThreadHeader(data.text, html);
        }
        const fw = helpers.classifyFrame(data.text);
        const qualityPercent = data.isMarker ? undefined : helpers.lookupQuality(data.text, fw);
        const line = {
            text: html, isMarker: data.isMarker, lineCount: data.lineCount,
            category: data.category, timestamp: data.timestamp.getTime(),
            fw, sourcePath: data.sourcePath,
            ...(qualityPercent === undefined ? {} : { qualityPercent }),
        };
        (0, viewer_thread_grouping_1.processLineForThreadDump)(this.threadDumpState, line, data.text, this.pendingLines);
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
    setShowDecorations(show) { this.post({ type: "setShowDecorations", show }); }
    setErrorClassificationSettings(s, b, d, fw) { this.post({ type: "errorClassificationSettings", suppressTransientErrors: s, breakOnCritical: b, levelDetection: d, deemphasizeFrameworkLevels: fw }); }
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
    setScopeContext(ctx) { this.post({ type: "setScopeContext", ...ctx }); }
    setMinimapShowInfo(show) { this.post({ type: "minimapShowInfo", show }); }
    setMinimapShowSqlDensity(show) { this.post({ type: "minimapShowSqlDensity", show }); }
    setViewerRepeatThresholds(thresholds) {
        this.post({
            type: "setViewerRepeatThresholds",
            thresholds: {
                globalMinCount: thresholds.globalMinCount,
                readMinCount: thresholds.readMinCount,
                transactionMinCount: thresholds.transactionMinCount,
                dmlMinCount: thresholds.dmlMinCount,
            },
        });
    }
    setViewerDbInsightsEnabled(enabled) {
        this.post({ type: "setViewerDbInsightsEnabled", enabled });
    }
    setStaticSqlFromFingerprintEnabled(enabled) {
        this.post({ type: "setStaticSqlFromFingerprintEnabled", enabled });
    }
    setViewerDbDetectorToggles(toggles) {
        this.post({
            type: "setViewerDbDetectorToggles",
            nPlusOneEnabled: toggles.nPlusOneEnabled,
            slowBurstEnabled: toggles.slowBurstEnabled,
            baselineHintsEnabled: toggles.baselineHintsEnabled,
        });
    }
    setDbBaselineFingerprintSummary(entries) {
        this.post({ type: "setDbBaselineFingerprintSummary", fingerprints: entries });
    }
    setViewerSlowBurstThresholds(thresholds) {
        this.post({
            type: "setViewerSlowBurstThresholds",
            thresholds: {
                slowQueryMs: thresholds.slowQueryMs,
                burstMinCount: thresholds.burstMinCount,
                burstWindowMs: thresholds.burstWindowMs,
                cooldownMs: thresholds.cooldownMs,
            },
        });
    }
    setViewerSqlPatternChipSettings(chipMinCount, chipMaxChips) {
        this.post({ type: "setViewerSqlPatternChipSettings", chipMinCount, chipMaxChips });
    }
    setMinimapWidth(width) { this.post({ type: "minimapWidth", width }); }
    setScrollbarVisible(show) { this.post({ type: "scrollbarVisible", show }); }
    setSearchMatchOptionsAlwaysVisible(always) { this.post({ type: "searchMatchOptionsAlwaysVisible", always }); }
    setIconBarPosition(position) { this.post({ type: "iconBarPosition", position }); }
    setErrorRateConfig(config) {
        this.post({ type: "setErrorRateConfig", bucketSize: config.bucketSize, showWarnings: config.showWarnings, detectSpikes: config.detectSpikes });
    }
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
            viewerRepeatThresholds: cfg.viewerRepeatThresholds,
            viewerDbInsightsEnabled: cfg.viewerDbInsightsEnabled,
            staticSqlFromFingerprintEnabled: cfg.staticSqlFromFingerprintEnabled,
            viewerDbDetectorToggles: (0, config_1.viewerDbDetectorTogglesFromConfig)(cfg),
            viewerSlowBurstThresholds: cfg.viewerSlowBurstThresholds,
            viewerSqlPatternChipMinCount: cfg.viewerSqlPatternChipMinCount,
            viewerSqlPatternMaxChips: cfg.viewerSqlPatternMaxChips,
        });
        wv.onDidReceiveMessage((msg) => this.handleMessage(msg));
        this.startBatchTimer();
        queueMicrotask(() => helpers.sendCachedConfig(this.cachedPresets, this.cachedHighlightRules, (m) => this.post(m)));
        (0, pop_out_panel_viewer_config_post_1.queuePopOutViewerConfigMicrotask)((m) => this.post(m), cfg);
        this.panel.onDidDispose(() => {
            this.stopBatchTimer();
            this.broadcaster.removeTarget(this);
            this.panel = undefined;
        });
    }
    handleMessage(msg) {
        const ctx = {
            currentFileUri: this.currentFileUri,
            isSessionActive: this.isSessionActive,
            context: this.context,
            extensionVersion: this.version,
            post: (m) => this.post(m),
            load: async () => { },
            onMarkerRequest: this.onMarkerRequest,
            onTogglePause: this.onTogglePause,
            onExclusionAdded: this.onExclusionAdded,
            onExclusionRemoved: this.onExclusionRemoved,
            onAnnotationPrompt: this.onAnnotationPrompt,
            onSearchCodebase: this.onSearchCodebase,
            onSearchSessions: this.onSearchSessions,
            onAnalyzeLine: this.onAnalyzeLine,
            onAddToWatch: this.onAddToWatch,
            onLinkClick: this.onLinkClick,
            onPartNavigate: this.onPartNavigate,
            onSavePresetRequest: this.onSavePresetRequest,
            onSessionListRequest: this.onSessionListRequest,
            onOpenSessionFromPanel: this.onOpenSessionFromPanel,
            onDisplayOptionsChange: this.onDisplayOptionsChange,
            onAddBookmark: this.onAddBookmark,
            onBookmarkAction: this.onBookmarkAction,
            onSessionAction: this.onSessionAction,
            onBrowseSessionRoot: this.onBrowseSessionRoot,
            onClearSessionRoot: this.onClearSessionRoot,
        };
        (0, viewer_message_handler_1.dispatchViewerMessage)(msg, ctx);
    }
    startBatchTimer() {
        this.stopBatchTimer();
        this.scheduleNextBatch();
    }
    scheduleNextBatch() {
        if (!this.panel) {
            return;
        }
        const delay = this.pendingLines.length > BATCH_BACKLOG_THRESHOLD ? BATCH_INTERVAL_UNDER_LOAD_MS : BATCH_INTERVAL_MS;
        this.batchTimer = setTimeout(() => {
            this.batchTimer = undefined;
            this.flushBatch();
            this.scheduleNextBatch();
        }, delay);
    }
    stopBatchTimer() {
        if (this.batchTimer !== undefined) {
            clearTimeout(this.batchTimer);
            this.batchTimer = undefined;
        }
    }
    flushBatch() {
        helpers.flushBatch(this.pendingLines, !!this.panel, (m) => this.post(m), (lines) => helpers.sendNewCategories(lines, this.seenCategories, (m) => this.post(m)));
    }
    post(message) { this.panel?.webview.postMessage(message); }
    postToWebview(message) {
        this.post(message);
    }
}
exports.PopOutPanel = PopOutPanel;
//# sourceMappingURL=pop-out-panel.js.map
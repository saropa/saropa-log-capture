/**
 * Sidebar log viewer webview host. Implements ViewerTarget so it receives broadcaster
 * calls (addLine, setFilename, setSessionInfo, etc.) and postMessage from the iframe;
 * wires handlers via viewer-handler-wiring and viewer-message-handler.
 */

import * as vscode from "vscode";
import type { ViewerRepeatThresholds } from "../../modules/db/drift-db-repeat-thresholds";
import type { ViewerSlowBurstThresholds } from "../../modules/db/drift-db-slow-burst-thresholds";
import type { PersistedDriftSqlFingerprintEntryV1 } from "../../modules/db/drift-sql-fingerprint-summary-persist";
import { LineData } from "../../modules/session/session-manager";
import { HighlightRule } from "../../modules/storage/highlight-rules";
import { FilterPreset } from "../../modules/storage/filter-presets";
import { executeLoadContent, createTailWatcher, type LoadResultFirstError } from "./log-viewer-provider-load";
import { setupLogViewerWebview } from "./log-viewer-provider-setup";
import { type PendingLine } from "../viewer/viewer-file-loader";
import { SerializedHighlightRule, serializeHighlightRules } from "../viewer-decorations/viewer-highlight-serializer";
import type { SessionDisplayOptions } from "../session/session-display";
import type { ScopeContext } from "../../modules/storage/scope-context";
import type { ViewerDbDetectorToggles } from "../../modules/config/config-types";
import type { ViewerTarget } from "../viewer/viewer-target";
import * as helpers from "./viewer-provider-helpers";
import { createThreadDumpState, type ThreadDumpState } from "../viewer/viewer-thread-grouping";
import * as panelHandlers from "../shared/viewer-panel-handlers";
import { dispatchViewerMessage, type ViewerMessageContext } from "./viewer-message-handler";
import { addLineToBatch, startBatchTimer, stopBatchTimer, flushPendingBatch } from "./log-viewer-provider-batch";
import { getViewerKeybindingsFromConfig } from "../viewer/viewer-keybindings";
import * as state from "./log-viewer-provider-state";

export class LogViewerProvider
  implements vscode.WebviewViewProvider, ViewerTarget, vscode.Disposable
{
  /** All resolved webview views (one per window when the panel is open in multiple windows). */
  private readonly views = new Set<vscode.WebviewView>();
  /** View that was most recently visible (for getView() and batch visibility). */
  private visibleView: vscode.WebviewView | undefined;
  pendingLines: PendingLine[] = [];
  batchTimer: ReturnType<typeof setTimeout> | undefined;
  threadDumpState: ThreadDumpState = createThreadDumpState();
  private onMarkerRequest?: () => void;
  private onLinkClick?: (path: string, line: number, col: number, split: boolean) => void;
  private onTogglePause?: () => void;
  private onExclusionAdded?: (pattern: string) => void;
  private onExclusionRemoved?: (pattern: string) => void;
  private onAnnotationPrompt?: (lineIndex: number, current: string) => void;
  private onSearchCodebase?: (text: string) => void;
  private onSearchSessions?: (text: string) => void;
  private onAnalyzeLine?: (text: string, lineIndex: number, fileUri: vscode.Uri | undefined) => void;
  private onAddToWatch?: (text: string) => void;
  private onPartNavigate?: (part: number) => void;
  private onSavePresetRequest?: (filters: Record<string, unknown>) => void;
  private onSessionListRequest?: () => void;
  private onOpenSessionFromPanel?: (uriString: string) => void;
  private onDisplayOptionsChange?: (options: SessionDisplayOptions) => void;
  private onPopOutRequest?: () => void;
  private onOpenInsightTabRequest?: () => void;
  private onRevealLogFile?: (uriString: string) => void;
  private onAddBookmark?: (lineIndex: number, text: string, fileUri: vscode.Uri | undefined) => void;
  private onFindInFiles?: (query: string, options: Record<string, unknown>) => void;
  private onOpenFindResult?: (uriString: string, query: string, options: Record<string, unknown>) => void;
  private onFindNavigateMatch?: (uriString: string, matchIndex: number) => void;
  private onBookmarkAction?: (msg: Record<string, unknown>) => void;
  private onSessionNavigate?: (direction: number) => void;
  private onFileLoaded?: (uri: vscode.Uri, loadResult?: LoadResultFirstError) => void;
  private onSessionAction?: (action: string, uriStrings: string[], filenames: string[]) => void;
  private onBrowseSessionRoot?: () => Promise<void>;
  private onClearSessionRoot?: () => Promise<void>;
  private readonly seenCategories = new Set<string>();
  private unreadWatchHits = 0;
  private cachedPresets: readonly FilterPreset[] = [];
  private cachedHighlightRules: SerializedHighlightRule[] = [];
  private currentFileUri: vscode.Uri | undefined;
  private isSessionActive = false;
  private pendingLoadUri: vscode.Uri | undefined;
  private loadGeneration = 0;
  private tailWatcher: vscode.Disposable | undefined;
  private tailLastLineCount = 0;
  private tailSessionMidnightMs = 0;
  private tailUri: vscode.Uri | undefined;
  private tailUpdateInProgress = false;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly version: string,
    private readonly context: vscode.ExtensionContext,
  ) {
    this.context.subscriptions.push(
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('saropaLogCapture.viewerKeybindings')) {
          const keyToAction = getViewerKeybindingsFromConfig();
          this.postMessage({ type: 'setViewerKeybindings', keyToAction });
        }
      }),
    );
  }

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.views.add(webviewView);
    if (webviewView.visible) { this.visibleView = webviewView; }
    setupLogViewerWebview(this, webviewView);
  }
  removeView(webviewView: vscode.WebviewView): void {
    this.views.delete(webviewView);
    if (this.visibleView === webviewView) { this.visibleView = undefined; }
    if (this.views.size === 0) { stopBatchTimer(this); }
  }
  setVisibleView(webviewView: vscode.WebviewView | undefined): void { this.visibleView = webviewView; }
  getCachedPresets(): readonly FilterPreset[] { return this.cachedPresets; }
  getCachedHighlightRules(): SerializedHighlightRule[] { return this.cachedHighlightRules; }
  getPendingLoadUri(): vscode.Uri | undefined { return this.pendingLoadUri; }
  setView(view: vscode.WebviewView | undefined): void {
    if (view === undefined) { this.visibleView = undefined; }
    else { this.views.add(view); this.visibleView = view; }
  }
  getUnreadWatchHits(): number { return this.unreadWatchHits; }
  setUnreadWatchHits(n: number): void { this.unreadWatchHits = n; }
  getExtensionUri(): vscode.Uri { return this.extensionUri; }
  getVersion(): string { return this.version; }
  getContext(): vscode.ExtensionContext { return this.context; }
  // -- Handler setters (one callback per webview action) --
  setMarkerHandler(handler: () => void): void { this.onMarkerRequest = handler; }
  setTogglePauseHandler(handler: () => void): void { this.onTogglePause = handler; }
  setExclusionAddedHandler(handler: (pattern: string) => void): void { this.onExclusionAdded = handler; }
  setExclusionRemovedHandler(handler: (pattern: string) => void): void { this.onExclusionRemoved = handler; }
  setAnnotationPromptHandler(handler: (lineIndex: number, current: string) => void): void { this.onAnnotationPrompt = handler; }
  setSearchCodebaseHandler(handler: (text: string) => void): void { this.onSearchCodebase = handler; }
  setSearchSessionsHandler(handler: (text: string) => void): void { this.onSearchSessions = handler; }
  setAnalyzeLineHandler(handler: (text: string, lineIndex: number, fileUri: vscode.Uri | undefined) => void): void { this.onAnalyzeLine = handler; }
  setAddToWatchHandler(handler: (text: string) => void): void { this.onAddToWatch = handler; }
  setLinkClickHandler(handler: (path: string, line: number, col: number, split: boolean) => void): void { this.onLinkClick = handler; }
  setPartNavigateHandler(handler: (part: number) => void): void { this.onPartNavigate = handler; }
  setSavePresetRequestHandler(handler: (filters: Record<string, unknown>) => void): void { this.onSavePresetRequest = handler; }
  setSessionListHandler(handler: () => void): void { this.onSessionListRequest = handler; }
  setOpenSessionFromPanelHandler(handler: (uriString: string) => void): void { this.onOpenSessionFromPanel = handler; }
  setDisplayOptionsHandler(handler: (options: SessionDisplayOptions) => void): void { this.onDisplayOptionsChange = handler; }
  setPopOutHandler(handler: () => void): void { this.onPopOutRequest = handler; }
  setOpenInsightTabHandler(handler: () => void): void { this.onOpenInsightTabRequest = handler; }
  setRevealLogFileHandler(handler: (uriString: string) => void): void { this.onRevealLogFile = handler; }
  setAddBookmarkHandler(handler: (lineIndex: number, text: string, fileUri: vscode.Uri | undefined) => void): void { this.onAddBookmark = handler; }
  setFindInFilesHandler(handler: (query: string, options: Record<string, unknown>) => void): void { this.onFindInFiles = handler; }
  setOpenFindResultHandler(handler: (uriString: string, query: string, options: Record<string, unknown>) => void): void { this.onOpenFindResult = handler; }
  setFindNavigateMatchHandler(handler: (uriString: string, matchIndex: number) => void): void { this.onFindNavigateMatch = handler; }
  setBookmarkActionHandler(handler: (msg: Record<string, unknown>) => void): void { this.onBookmarkAction = handler; }
  setSessionNavigateHandler(handler: (direction: number) => void): void { this.onSessionNavigate = handler; }
  setFileLoadedHandler(handler: (uri: vscode.Uri, loadResult?: LoadResultFirstError) => void): void { this.onFileLoaded = handler; }
  setSessionActionHandler(handler: (action: string, uriStrings: string[], filenames: string[]) => void): void { this.onSessionAction = handler; }
  setBrowseSessionRootHandler(handler: () => Promise<void>): void { this.onBrowseSessionRoot = handler; }
  setClearSessionRootHandler(handler: () => Promise<void>): void { this.onClearSessionRoot = handler; }
  // -- Webview state methods --
  scrollToLine(line: number): void { state.scrollToLineImpl(this, line); }
  setExclusions(patterns: readonly string[]): void { state.setExclusionsImpl(this, patterns); }
  setAnnotation(lineIndex: number, text: string): void { state.setAnnotationImpl(this, lineIndex, text); }
  loadAnnotations(annotations: readonly { lineIndex: number; text: string }[]): void { state.loadAnnotationsImpl(this, annotations); }
  setSplitInfo(currentPart: number, totalParts: number): void { state.setSplitInfoImpl(this, currentPart, totalParts); }
  setSessionNavInfo(hasPrev: boolean, hasNext: boolean, index: number, total: number): void { state.setSessionNavInfoImpl(this, { hasPrev, hasNext, index, total }); }
  getCurrentFileUri(): vscode.Uri | undefined { return this.currentFileUri; }
  updateFooter(text: string): void { state.updateFooterImpl(this, text); }
  setPaused(paused: boolean): void { state.setPausedImpl(this, paused); }
  setFilename(filename: string): void { state.setFilenameImpl(this, filename); }
  setContextLines(count: number): void { state.setContextLinesImpl(this, count); }
  setContextViewLines(count: number): void { state.setContextViewLinesImpl(this, count); }
  setCopyContextLines(count: number): void { state.setCopyContextLinesImpl(this, count); }
  setShowElapsed(show: boolean): void { state.setShowElapsedImpl(this, show); }
  setShowDecorations(show: boolean): void { state.setShowDecorationsImpl(this, show); }
  startReplay(): void { state.postStartReplayImpl(this); }
  private getReplayConfig() { return state.getReplayConfig(); }
  setErrorClassificationSettings(suppressTransientErrors: boolean, breakOnCritical: boolean, levelDetection: string, deemphasizeFrameworkLevels: boolean): void { state.setErrorClassificationSettingsImpl(this, { suppressTransientErrors, breakOnCritical, levelDetection, deemphasizeFrameworkLevels }); }
  applyPreset(name: string): void { state.applyPresetImpl(this, name); }
  setHighlightRules(rules: readonly HighlightRule[]): void {
    this.cachedHighlightRules = serializeHighlightRules(rules);
    state.setHighlightRulesImpl(this, this.cachedHighlightRules);
  }
  setPresets(presets: readonly FilterPreset[]): void {
    this.cachedPresets = presets;
    state.setPresetsImpl(this, presets);
  }
  addLine(data: LineData): void { addLineToBatch(this, data); }
  setCurrentFile(uri: vscode.Uri | undefined): void {
    this.currentFileUri = uri;
    this.postMessage({ type: 'currentLogChanged', currentFileUri: uri?.toString() });
  }
  setScopeContext(ctx: ScopeContext): void { state.setScopeContextImpl(this, ctx); }
  setMinimapShowInfo(show: boolean): void { state.setMinimapShowInfoImpl(this, show); }
  setMinimapShowSqlDensity(show: boolean): void { state.setMinimapShowSqlDensityImpl(this, show); }
  setViewerRepeatThresholds(thresholds: ViewerRepeatThresholds): void {
    state.setViewerRepeatThresholdsImpl(this, thresholds);
  }
  setViewerDbInsightsEnabled(enabled: boolean): void {
    state.setViewerDbInsightsEnabledImpl(this, enabled);
  }
  setViewerDbDetectorToggles(toggles: ViewerDbDetectorToggles): void {
    state.setViewerDbDetectorTogglesImpl(this, toggles);
  }
  setDbBaselineFingerprintSummary(
    entries: Readonly<Record<string, PersistedDriftSqlFingerprintEntryV1>> | null,
  ): void {
    state.setDbBaselineFingerprintSummaryImpl(this, entries);
  }
  setViewerSlowBurstThresholds(thresholds: ViewerSlowBurstThresholds): void {
    state.setViewerSlowBurstThresholdsImpl(this, thresholds);
  }
  setViewerSqlPatternChipSettings(chipMinCount: number, chipMaxChips: number): void {
    state.setViewerSqlPatternChipSettingsImpl(this, chipMinCount, chipMaxChips);
  }
  setMinimapWidth(width: "small" | "medium" | "large"): void { state.setMinimapWidthImpl(this, width); }
  setScrollbarVisible(show: boolean): void { state.setScrollbarVisibleImpl(this, show); }
  setSearchMatchOptionsAlwaysVisible(always: boolean): void { state.setSearchMatchOptionsAlwaysVisibleImpl(this, always); }
  setIconBarPosition(position: "left" | "right"): void { state.setIconBarPositionImpl(this, position); }
  setAutoHidePatterns(patterns: readonly string[]): void { state.setAutoHidePatternsImpl(this, patterns); }
  setSessionInfo(info: Record<string, string> | null): void { state.setSessionInfoImpl(this, info); }
  setHasPerformanceData(has: boolean): void { state.setHasPerformanceDataImpl(this, has); }
  setCodeQualityPayload(payload: unknown): void { state.setCodeQualityPayloadImpl(this, payload); }
  sendFindResults(results: unknown): void { state.sendFindResultsImpl(this, results); }
  setupFindSearch(query: string, options: Record<string, unknown>): void { state.setupFindSearchImpl(this, query, options); }
  findNextMatch(): void { state.findNextMatchImpl(this); }
  sendSessionList(sessions: readonly Record<string, unknown>[], rootInfo?: { label: string; path: string; isDefault: boolean }): void { state.sendSessionListImpl(this, sessions, rootInfo); }
  sendSessionListLoading(folderPath: string): void { state.sendSessionListLoadingImpl(this, folderPath); }
  sendBookmarkList(files: Record<string, unknown>): void { state.sendBookmarkListImpl(this, files); }
  sendDisplayOptions(options: SessionDisplayOptions): void { state.sendDisplayOptionsImpl(this, options); }
  sendIntegrationsAdapters(adapterIds: readonly string[]): void { state.sendIntegrationsAdaptersImpl(this, adapterIds); }
  setSessionActive(active: boolean): void { this.isSessionActive = active; state.setSessionStateImpl(this, active); }

  clear(): void {
    this.stopTailing();
    flushPendingBatch(this);
    this.pendingLines = []; this.currentFileUri = undefined;
    this.postMessage({ type: "clear" });
    state.setSessionInfoImpl(this, null);
    state.setHasPerformanceDataImpl(this, false);
    state.setCodeQualityPayloadImpl(this, null);
  }
  async loadFromFile(uri: vscode.Uri, options?: { tail?: boolean; replay?: boolean }): Promise<void> {
    const gen = ++this.loadGeneration;
    this.pendingLoadUri = uri;
    // Reveal viewer in every window that has the panel (multi-window fix).
    for (const v of this.views) { v.show?.(true); }
    for (let i = 0; i < 20 && this.views.size === 0; i++) { await new Promise<void>(r => setTimeout(r, 50)); }
    if (this.views.size === 0 || gen !== this.loadGeneration) { return; }
    this.stopTailing();
    this.clear();
    this.seenCategories.clear();
    this.currentFileUri = uri;
    const loadResult = await executeLoadContent(this, uri, () => gen === this.loadGeneration);
    if (gen !== this.loadGeneration) { return; }
    this.onFileLoaded?.(uri, loadResult);
    this.pendingLoadUri = undefined;
    if (options?.tail) {
      this.startTailing(uri, loadResult.sessionMidnightMs, loadResult.contentLength);
    }
    if (options?.replay) {
      this.postMessage({ type: "startReplay", replayConfig: this.getReplayConfig() });
    }
  }
  private stopTailing(): void {
    this.tailWatcher?.dispose();
    this.tailWatcher = undefined;
    this.tailUri = undefined;
  }
  private startTailing(uri: vscode.Uri, sessionMidnightMs: number, initialLineCount: number): void {
    this.stopTailing();
    this.tailUri = uri;
    this.tailSessionMidnightMs = sessionMidnightMs;
    this.tailWatcher = createTailWatcher(uri, sessionMidnightMs, initialLineCount, this);
  }
  getTailLastLineCount(): number { return this.tailLastLineCount; }
  setTailLastLineCount(n: number): void { this.tailLastLineCount = n; }
  getTailUpdateInProgress(): boolean { return this.tailUpdateInProgress; }
  setTailUpdateInProgress(v: boolean): void { this.tailUpdateInProgress = v; }
  getView(): vscode.WebviewView | undefined {
    return this.visibleView ?? this.views.values().next().value;
  }
  getSeenCategories(): Set<string> { return this.seenCategories; }
  updateWatchCounts(counts: ReadonlyMap<string, number>): void {
    const obj = Object.fromEntries(counts);
    const total = [...counts.values()].reduce((s, n) => s + n, 0);
    this.postMessage({ type: "updateWatchCounts", counts: obj });
    if (total > this.unreadWatchHits) { this.unreadWatchHits = total; }
    for (const v of this.views) { helpers.updateBadge(v, this.unreadWatchHits); }
  }

  dispose(): void {
    this.stopTailing();
    stopBatchTimer(this);
    this.views.clear();
    this.visibleView = undefined;
    panelHandlers.disposeHandlers();
  }

  handleMessage(msg: Record<string, unknown>): void {
    if (msg.type === 'viewerFocused') {
      if (this.unreadWatchHits > 0) { this.unreadWatchHits = 0; for (const v of this.views) { helpers.updateBadge(v, 0); } }
      return;
    }
    const ctx: ViewerMessageContext = {
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
    dispatchViewerMessage(msg, ctx);
  }

  startBatchTimer(): void { startBatchTimer(this); }
  stopBatchTimer(): void { stopBatchTimer(this); }
  postMessage(message: unknown): void {
    const snapshot = [...this.views];
    for (const v of snapshot) { v.webview.postMessage(message); }
  }

  postToWebview(message: unknown): void {
    this.postMessage(message);
  }
}

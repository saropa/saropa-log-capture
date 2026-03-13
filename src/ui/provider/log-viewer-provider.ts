/**
 * Sidebar log viewer webview host. Implements ViewerTarget so it receives broadcaster
 * calls (addLine, setFilename, setSessionInfo, etc.) and postMessage from the iframe;
 * wires handlers via viewer-handler-wiring and viewer-message-handler.
 */

import * as vscode from "vscode";
import { getConfig } from "../../modules/config/config";
import { LineData } from "../../modules/session/session-manager";
import { HighlightRule } from "../../modules/storage/highlight-rules";
import { FilterPreset } from "../../modules/storage/filter-presets";
import { executeLoadContent, createTailWatcher } from "./log-viewer-provider-load";
import { setupLogViewerWebview } from "./log-viewer-provider-setup";
import { type PendingLine } from "../viewer/viewer-file-loader";
import { SerializedHighlightRule, serializeHighlightRules } from "../viewer-decorations/viewer-highlight-serializer";
import type { SessionDisplayOptions } from "../session/session-display";
import type { ScopeContext } from "../../modules/storage/scope-context";
import type { ViewerTarget } from "../viewer/viewer-target";
import * as helpers from "./viewer-provider-helpers";
import { createThreadDumpState, type ThreadDumpState } from "../viewer/viewer-thread-grouping";
import * as panelHandlers from "../shared/viewer-panel-handlers";
import { dispatchViewerMessage, type ViewerMessageContext } from "./viewer-message-handler";
import { addLineToBatch, startBatchTimer, stopBatchTimer, flushPendingBatch } from "./log-viewer-provider-batch";
import { getViewerKeybindingsFromConfig } from "../viewer/viewer-keybindings";

/**
 * Webview view provider for the sidebar; displays captured debug output with auto-scroll and theme support.
 * Supports multiple VS Code windows: when the panel is opened in another window, resolveWebviewView is
 * called per window. We track all views and broadcast postMessage/loadFromFile to each so clicking a
 * session in any window shows content in that window's viewer.
 */
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
  private onRevealLogFile?: (uriString: string) => void;
  private onAddBookmark?: (lineIndex: number, text: string, fileUri: vscode.Uri | undefined) => void;
  private onFindInFiles?: (query: string, options: Record<string, unknown>) => void;
  private onOpenFindResult?: (uriString: string, query: string, options: Record<string, unknown>) => void;
  private onFindNavigateMatch?: (uriString: string, matchIndex: number) => void;
  private onBookmarkAction?: (msg: Record<string, unknown>) => void;
  private onSessionNavigate?: (direction: number) => void;
  private onFileLoaded?: (uri: vscode.Uri) => void;
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
  /** Remove a view when it is disposed (e.g. panel closed or window closed). Stops batch timer only when the last view is removed. */
  removeView(webviewView: vscode.WebviewView): void {
    this.views.delete(webviewView);
    if (this.visibleView === webviewView) { this.visibleView = undefined; }
    if (this.views.size === 0) { stopBatchTimer(this); }
  }
  /** Mark the view that is currently visible (so getView() and batch use the right one). */
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
  setRevealLogFileHandler(handler: (uriString: string) => void): void { this.onRevealLogFile = handler; }
  setAddBookmarkHandler(handler: (lineIndex: number, text: string, fileUri: vscode.Uri | undefined) => void): void { this.onAddBookmark = handler; }
  setFindInFilesHandler(handler: (query: string, options: Record<string, unknown>) => void): void { this.onFindInFiles = handler; }
  setOpenFindResultHandler(handler: (uriString: string, query: string, options: Record<string, unknown>) => void): void { this.onOpenFindResult = handler; }
  setFindNavigateMatchHandler(handler: (uriString: string, matchIndex: number) => void): void { this.onFindNavigateMatch = handler; }
  setBookmarkActionHandler(handler: (msg: Record<string, unknown>) => void): void { this.onBookmarkAction = handler; }
  setSessionNavigateHandler(handler: (direction: number) => void): void { this.onSessionNavigate = handler; }
  setFileLoadedHandler(handler: (uri: vscode.Uri) => void): void { this.onFileLoaded = handler; }
  setSessionActionHandler(handler: (action: string, uriStrings: string[], filenames: string[]) => void): void { this.onSessionAction = handler; }
  setBrowseSessionRootHandler(handler: () => Promise<void>): void { this.onBrowseSessionRoot = handler; }
  setClearSessionRootHandler(handler: () => Promise<void>): void { this.onClearSessionRoot = handler; }
  // -- Webview state methods --
  scrollToLine(line: number): void { this.postMessage({ type: "scrollToLine", line }); }
  setExclusions(patterns: readonly string[]): void { this.postMessage({ type: "setExclusions", patterns }); }
  setAnnotation(lineIndex: number, text: string): void { this.postMessage({ type: "setAnnotation", lineIndex, text }); }
  loadAnnotations(annotations: readonly { lineIndex: number; text: string }[]): void { this.postMessage({ type: "loadAnnotations", annotations }); }

  setSplitInfo(currentPart: number, totalParts: number): void { this.postMessage({ type: "splitInfo", currentPart, totalParts }); }
  setSessionNavInfo(hasPrev: boolean, hasNext: boolean, index: number, total: number): void { this.postMessage({ type: "sessionNavInfo", hasPrev, hasNext, index, total }); }
  getCurrentFileUri(): vscode.Uri | undefined { return this.currentFileUri; }
  updateFooter(text: string): void { this.postMessage({ type: "updateFooter", text }); }
  setPaused(paused: boolean): void { this.postMessage({ type: "setPaused", paused }); }
  setFilename(filename: string): void {
    this.postMessage({ type: "setFilename", filename });
    const levels = helpers.getSavedLevelFilters(this.context, filename);
    if (levels) { this.postMessage({ type: "restoreLevelFilters", levels }); }
  }
  setContextLines(count: number): void { this.postMessage({ type: "setContextLines", count }); }
  setContextViewLines(count: number): void { this.postMessage({ type: "setContextViewLines", count }); }
  setCopyContextLines(count: number): void { this.postMessage({ type: "setCopyContextLines", count }); }
  setShowElapsed(show: boolean): void { this.postMessage({ type: "setShowElapsed", show }); }
  setShowDecorations(show: boolean): void { this.postMessage({ type: "setShowDecorations", show }); }
  /** Start replay on the currently loaded log (e.g. from Replay command). Sends replay config from settings. */
  startReplay(): void {
    this.postMessage({ type: "startReplay", replayConfig: this.getReplayConfig() });
  }
  /** Replay settings from workspace config for startReplay / loadFromFile(..., { replay: true }). */
  private getReplayConfig(): { defaultMode: string; defaultSpeed: number; minLineDelayMs: number; maxDelayMs: number } {
    const r = getConfig().replay;
    return { defaultMode: r.defaultMode, defaultSpeed: r.defaultSpeed, minLineDelayMs: r.minLineDelayMs, maxDelayMs: r.maxDelayMs };
  }
  setErrorClassificationSettings(suppressTransientErrors: boolean, breakOnCritical: boolean, levelDetection: string, deemphasizeFrameworkLevels: boolean): void { this.postMessage({ type: "errorClassificationSettings", suppressTransientErrors, breakOnCritical, levelDetection, deemphasizeFrameworkLevels }); }
  applyPreset(name: string): void { this.postMessage({ type: "applyPreset", name }); }
  setHighlightRules(rules: readonly HighlightRule[]): void {
    this.cachedHighlightRules = serializeHighlightRules(rules);
    this.postMessage({ type: "setHighlightRules", rules: this.cachedHighlightRules });
  }
  setPresets(presets: readonly FilterPreset[]): void {
    this.cachedPresets = presets;
    const lastUsed = this.context.workspaceState.get<string>("saropaLogCapture.lastUsedPresetName");
    this.postMessage({ type: "setPresets", presets, lastUsedPresetName: lastUsed });
  }
  addLine(data: LineData): void { addLineToBatch(this, data); }

  setCurrentFile(uri: vscode.Uri | undefined): void { this.currentFileUri = uri; }
  setScopeContext(ctx: ScopeContext): void { this.postMessage({ type: "setScopeContext", ...ctx }); }
  setMinimapShowInfo(show: boolean): void { this.postMessage({ type: "minimapShowInfo", show }); }
  setMinimapWidth(width: "small" | "medium" | "large"): void { this.postMessage({ type: "minimapWidth", width }); }
  setIconBarPosition(position: "left" | "right"): void { this.postMessage({ type: "iconBarPosition", position }); }
  setSessionInfo(info: Record<string, string> | null): void { this.postMessage({ type: "setSessionInfo", info }); }
  setHasPerformanceData(has: boolean): void { this.postMessage({ type: "setHasPerformanceData", has }); }

  sendFindResults(results: unknown): void { this.postMessage({ type: "findResults", ...results as Record<string, unknown> }); }
  setupFindSearch(query: string, options: Record<string, unknown>): void { this.postMessage({ type: "setupFindSearch", query, ...options }); }
  findNextMatch(): void { this.postMessage({ type: "findNextMatch" }); }
  sendSessionList(sessions: readonly Record<string, unknown>[], rootInfo?: { label: string; path: string; isDefault: boolean }): void {
    this.postMessage({ type: "sessionList", sessions, ...rootInfo });
  }
  sendSessionListLoading(folderPath: string): void {
    this.postMessage({ type: "sessionListLoading", folderPath });
  }
  sendBookmarkList(files: Record<string, unknown>): void { this.postMessage({ type: "bookmarkList", files }); }
  sendDisplayOptions(options: SessionDisplayOptions): void { this.postMessage({ type: "sessionDisplayOptions", options }); }
  sendIntegrationsAdapters(adapterIds: readonly string[]): void {
    this.postMessage({ type: "integrationsAdapters", adapterIds: [...adapterIds] });
  }
  setSessionActive(active: boolean): void { this.isSessionActive = active; this.postMessage({ type: "sessionState", active }); }

  clear(): void {
    this.stopTailing();
    flushPendingBatch(this);
    this.pendingLines = []; this.currentFileUri = undefined;
    this.postMessage({ type: "clear" }); this.setSessionInfo(null); this.setHasPerformanceData(false);
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
    const { sessionMidnightMs, contentLength } = await executeLoadContent(this, uri, () => gen === this.loadGeneration);
    if (gen !== this.loadGeneration) { return; }
    this.onFileLoaded?.(uri);
    this.pendingLoadUri = undefined;
    if (options?.tail) {
      this.startTailing(uri, sessionMidnightMs, contentLength);
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
    for (const v of [...this.views]) { helpers.updateBadge(v, this.unreadWatchHits); }
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
      if (this.unreadWatchHits > 0) { this.unreadWatchHits = 0; for (const v of [...this.views]) { helpers.updateBadge(v, 0); } }
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
      onRevealLogFile: this.onRevealLogFile, onAddBookmark: this.onAddBookmark,
      onFindInFiles: this.onFindInFiles, onOpenFindResult: this.onOpenFindResult,
      onFindNavigateMatch: this.onFindNavigateMatch, onBookmarkAction: this.onBookmarkAction,
      onSessionNavigate: this.onSessionNavigate, onSessionAction: this.onSessionAction,
      onBrowseSessionRoot: this.onBrowseSessionRoot, onClearSessionRoot: this.onClearSessionRoot,
    };
    dispatchViewerMessage(msg, ctx);
  }

  startBatchTimer(): void { startBatchTimer(this); }
  stopBatchTimer(): void { stopBatchTimer(this); }
  /** Send message to all resolved views (safe if a view is disposed during iteration). */
  postMessage(message: unknown): void {
    const snapshot = [...this.views];
    for (const v of snapshot) { v.webview.postMessage(message); }
  }
}

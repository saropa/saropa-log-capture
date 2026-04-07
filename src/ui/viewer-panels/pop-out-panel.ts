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

import * as vscode from "vscode";
import type { ViewerRepeatThresholds } from "../../modules/db/drift-db-repeat-thresholds";
import type { ViewerSlowBurstThresholds } from "../../modules/db/drift-db-slow-burst-thresholds";
import type { PersistedDriftSqlFingerprintEntryV1 } from "../../modules/db/drift-sql-fingerprint-summary-persist";
import { getNonce, buildViewerHtml, getEffectiveViewerLines } from "../provider/viewer-content";
import { getConfig, viewerDbDetectorTogglesFromConfig } from "../../modules/config/config";
import type { LineData } from "../../modules/session/session-manager";
import type { HighlightRule } from "../../modules/storage/highlight-rules";
import type { FilterPreset } from "../../modules/storage/filter-presets";
import type { ScopeContext } from "../../modules/storage/scope-context";
import { PendingLine } from "../viewer/viewer-file-loader";
import {
  SerializedHighlightRule, serializeHighlightRules,
} from "../viewer-decorations/viewer-highlight-serializer";
import type { SessionDisplayOptions } from "../session/session-display";
import type { ViewerTarget } from "../viewer/viewer-target";
import type { ErrorClassificationSettings, ErrorRateConfig, ViewerDbDetectorToggles } from "../../modules/config/config-types";
import type { ViewerBroadcaster } from "../provider/viewer-broadcaster";
import * as helpers from "../provider/viewer-provider-helpers";
import { addLineToBatch, appendLiveLineToBatch } from "../provider/log-viewer-provider-batch";
import { type ThreadDumpState, createThreadDumpState, flushThreadDump } from "../viewer/viewer-thread-grouping";
import { dispatchViewerMessage } from "../provider/viewer-message-handler";
import { executeLoadContent, type LogViewerLoadTarget } from "../provider/log-viewer-provider-load";
import { queuePopOutViewerConfigMicrotask } from "./pop-out-panel-viewer-config-post";
import { filterDeferredLinesAfterSnapshot } from "./pop-out-panel-deferred-replay";
import {
  postViewerRepeatThresholds, postViewerDbDetectorToggles, postDbBaselineFingerprintSummary,
  postViewerSlowBurstThresholds, postErrorRateConfig, postScopeContext,
} from "./pop-out-panel-viewer-state";
import { startPopOutBatchTimer, stopPopOutBatchTimer } from "./pop-out-panel-batch";
import { buildPopOutMessageContext } from "./pop-out-panel-message-context";

/** Construction options for the pop-out viewer panel. */
export interface PopOutPanelOptions {
  readonly extensionUri: vscode.Uri;
  readonly version: string;
  readonly context: vscode.ExtensionContext;
  readonly broadcaster: ViewerBroadcaster;
  readonly getHydrationUri?: () => vscode.Uri | undefined;
}

/** Pop-out viewer as an editor tab (movable to a floating window). */
export class PopOutPanel implements ViewerTarget, vscode.Disposable {
  private readonly extensionUri: vscode.Uri;
  private readonly version: string;
  private readonly context: vscode.ExtensionContext;
  private readonly broadcaster: ViewerBroadcaster;
  private panel: vscode.WebviewPanel | undefined;
  /** Public for BatchTarget (same as LogViewerProvider). */
  pendingLines: PendingLine[] = [];
  batchTimer: ReturnType<typeof setTimeout> | undefined;
  readonly threadDumpState: ThreadDumpState = createThreadDumpState();
  private readonly seenCategories = new Set<string>();
  private cachedPresets: readonly FilterPreset[] = [];
  private cachedHighlightRules: SerializedHighlightRule[] = [];
  private currentFileUri: vscode.Uri | undefined;
  private isSessionActive = false;

  // Handler callbacks (wired from extension.ts, same pattern as LogViewerProvider).
  private readonly handlers: import("./pop-out-panel-message-context").PopOutHandlerCallbacks = {};

  /** Snapshot URI from the main viewer so the pop-out can load full on-disk history when opened. */
  private readonly getHydrationUri?: () => vscode.Uri | undefined;

  private hydratingFromFile = false;
  private deferredLinesDuringHydrate: LineData[] = [];
  private hydrateGen = 0;

  constructor(opts: PopOutPanelOptions) {
    this.extensionUri = opts.extensionUri;
    this.version = opts.version;
    this.context = opts.context;
    this.broadcaster = opts.broadcaster;
    this.getHydrationUri = opts.getHydrationUri;
  }

  /** Open or reveal the pop-out panel, then move to a new window. */
  async open(): Promise<void> {
    if (this.panel) { this.panel.reveal(); return; }
    // Buffer live lines while we load from disk so the webview shows full history, not only post-open lines.
    this.hydratingFromFile = true;
    this.deferredLinesDuringHydrate = [];
    const audioUri = vscode.Uri.joinPath(this.extensionUri, 'audio');
    const codiconsUri = vscode.Uri.joinPath(this.extensionUri, 'media', 'codicons');
    try {
      this.panel = vscode.window.createWebviewPanel(
        'saropaLogCapture.popOutViewer',
        'Saropa Log Capture',
        vscode.ViewColumn.Active,
        { enableScripts: true, retainContextWhenHidden: true, localResourceRoots: [audioUri, codiconsUri] },
      );
      this.broadcaster.addTarget(this);
      this.setupWebview(audioUri, codiconsUri);
    } catch (e) {
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
  get isOpen(): boolean { return !!this.panel; }

  // -- Handler setters --
  setMarkerHandler(h: () => void): void { this.handlers.onMarkerRequest = h; }
  setTogglePauseHandler(h: () => void): void { this.handlers.onTogglePause = h; }
  setExclusionAddedHandler(h: (p: string) => void): void { this.handlers.onExclusionAdded = h; }
  setExclusionRemovedHandler(h: (p: string) => void): void { this.handlers.onExclusionRemoved = h; }
  setAnnotationPromptHandler(h: (i: number, c: string) => void): void { this.handlers.onAnnotationPrompt = h; }
  setSearchCodebaseHandler(h: (t: string) => void): void { this.handlers.onSearchCodebase = h; }
  setSearchSessionsHandler(h: (t: string) => void): void { this.handlers.onSearchSessions = h; }
  setAnalyzeLineHandler(h: (t: string, i: number, u: vscode.Uri | undefined) => void): void { this.handlers.onAnalyzeLine = h; }
  setAddToWatchHandler(h: (t: string) => void): void { this.handlers.onAddToWatch = h; }
  setLinkClickHandler(h: (p: string, l: number, c: number, s: boolean) => void): void { this.handlers.onLinkClick = h; }
  setPartNavigateHandler(h: (p: number) => void): void { this.handlers.onPartNavigate = h; }
  setSavePresetRequestHandler(h: (f: Record<string, unknown>) => void): void { this.handlers.onSavePresetRequest = h; }
  setSessionListHandler(h: () => void): void { this.handlers.onSessionListRequest = h; }
  setOpenSessionFromPanelHandler(h: (u: string) => void): void { this.handlers.onOpenSessionFromPanel = h; }
  setDisplayOptionsHandler(h: (o: SessionDisplayOptions) => void): void { this.handlers.onDisplayOptionsChange = h; }
  setAddBookmarkHandler(h: (i: number, t: string, u: vscode.Uri | undefined) => void): void { this.handlers.onAddBookmark = h; }
  setBookmarkActionHandler(h: (msg: Record<string, unknown>) => void): void { this.handlers.onBookmarkAction = h; }
  setSessionActionHandler(h: (a: string, uriStrings: string[], filenames: string[]) => void): void { this.handlers.onSessionAction = h; }
  setBrowseSessionRootHandler(h: () => Promise<void>): void { this.handlers.onBrowseSessionRoot = h; }
  setClearSessionRootHandler(h: () => Promise<void>): void { this.handlers.onClearSessionRoot = h; }
  // -- ViewerTarget state methods --
  addLine(data: LineData): void {
    // During hydrate, capture all lines (even if panel not visible yet) so we don't drop or duplicate vs file load.
    if (this.hydratingFromFile) {
      this.deferredLinesDuringHydrate.push(data);
      return;
    }
    addLineToBatch(this, data);
  }

  /** Pre-built line from ViewerBroadcaster (avoids duplicate ANSI/linkify when sidebar + pop-out are both open). */
  appendLiveLineFromBroadcast(line: PendingLine, rawText: string): void {
    appendLiveLineToBatch(this, line, rawText);
  }

  /** Pop-out buffers raw lines while loading snapshot from disk (see ViewerBroadcaster.addLine). */
  isLiveCaptureHydrating(): boolean {
    return this.hydratingFromFile;
  }

  /** Visibility for live batch pipeline (matches sidebar LogViewerProvider.getView). */
  getView(): { readonly visible: boolean } | undefined {
    return this.panel ? { visible: this.panel.visible } : undefined;
  }

  /** BatchTarget / LogViewerLoadTarget compatibility (sidebar uses postMessage naming). */
  getSeenCategories(): Set<string> {
    return this.seenCategories;
  }

  postMessage(message: unknown): void {
    this.post(message);
  }

  clear(): void {
    flushThreadDump(this.threadDumpState, this.pendingLines);
    this.pendingLines = []; this.currentFileUri = undefined;
    this.post({ type: "clear" }); this.setSessionInfo(null); this.setHasPerformanceData(false);
  }
  setHasPerformanceData(has: boolean): void { this.post({ type: "setHasPerformanceData", has }); }
  setPaused(paused: boolean): void { this.post({ type: "setPaused", paused }); }
  setFilename(filename: string): void {
    this.post({ type: "setFilename", filename });
    const levels = helpers.getSavedLevelFilters(this.context, filename);
    if (levels) { this.post({ type: "restoreLevelFilters", levels }); }
  }
  setExclusions(patterns: readonly string[]): void { this.post({ type: "setExclusions", patterns }); }
  setAnnotation(lineIndex: number, text: string): void { this.post({ type: "setAnnotation", lineIndex, text }); }
  loadAnnotations(a: readonly { lineIndex: number; text: string }[]): void { this.post({ type: "loadAnnotations", annotations: a }); }
  setSplitInfo(currentPart: number, totalParts: number): void { this.post({ type: "splitInfo", currentPart, totalParts }); }
  updateFooter(text: string): void { this.post({ type: "updateFooter", text }); }
  setContextLines(count: number): void { this.post({ type: "setContextLines", count }); }
  setContextViewLines(count: number): void { this.post({ type: "setContextViewLines", count }); }
  setCopyContextLines(count: number): void { this.post({ type: "setCopyContextLines", count }); }
  setShowElapsed(show: boolean): void { this.post({ type: "setShowElapsed", show }); }
  setErrorClassificationSettings(settings: ErrorClassificationSettings): void {
    this.post({ type: "errorClassificationSettings", ...settings });
  }
  applyPreset(name: string): void { this.post({ type: "applyPreset", name }); }
  setHighlightRules(rules: readonly HighlightRule[]): void {
    this.cachedHighlightRules = serializeHighlightRules(rules);
    this.post({ type: "setHighlightRules", rules: this.cachedHighlightRules });
  }
  setPresets(presets: readonly FilterPreset[]): void {
    this.cachedPresets = presets;
    const lastUsed = this.context.workspaceState.get<string>("saropaLogCapture.lastUsedPresetName");
    this.post({ type: "setPresets", presets, lastUsedPresetName: lastUsed });
  }
  setCurrentFile(uri: vscode.Uri | undefined): void { this.currentFileUri = uri; }
  setScopeContext(ctx: ScopeContext): void { postScopeContext(this, ctx); }
  setMinimapShowInfo(show: boolean): void { this.post({ type: "minimapShowInfo", show }); }
  setMinimapShowSqlDensity(show: boolean): void { this.post({ type: "minimapShowSqlDensity", show }); }
  setMinimapProportionalLines(show: boolean): void { this.post({ type: "minimapProportionalLines", show }); }
  setMinimapViewportRedOutline(show: boolean): void { this.post({ type: "minimapViewportRedOutline", show }); }
  setMinimapViewportOutsideArrow(show: boolean): void { this.post({ type: "minimapViewportOutsideArrow", show }); }
  setViewerRepeatThresholds(t: ViewerRepeatThresholds): void { postViewerRepeatThresholds(this, t); }
  setViewerDbInsightsEnabled(enabled: boolean): void { this.post({ type: "setViewerDbInsightsEnabled", enabled }); }
  setStaticSqlFromFingerprintEnabled(enabled: boolean): void { this.post({ type: "setStaticSqlFromFingerprintEnabled", enabled }); }
  setViewerDbDetectorToggles(toggles: ViewerDbDetectorToggles): void { postViewerDbDetectorToggles(this, toggles); }
  setDbBaselineFingerprintSummary(entries: Readonly<Record<string, PersistedDriftSqlFingerprintEntryV1>> | null): void { postDbBaselineFingerprintSummary(this, entries); }
  setViewerSlowBurstThresholds(t: ViewerSlowBurstThresholds): void { postViewerSlowBurstThresholds(this, t); }
  setMinimapWidth(width: "xsmall" | "small" | "medium" | "large" | "xlarge"): void { this.post({ type: "minimapWidth", width }); }
  setScrollbarVisible(show: boolean): void { this.post({ type: "scrollbarVisible", show }); }
  setSearchMatchOptionsAlwaysVisible(always: boolean): void { this.post({ type: "searchMatchOptionsAlwaysVisible", always }); }
  setIconBarPosition(position: "left" | "right"): void { this.post({ type: "iconBarPosition", position }); }
  setErrorRateConfig(config: ErrorRateConfig): void { postErrorRateConfig(this, config); }
  setAutoHidePatterns(patterns: readonly string[]): void { this.post({ type: "setAutoHidePatterns", patterns: [...patterns] }); }
  setSessionInfo(info: Record<string, string> | null): void { this.post({ type: "setSessionInfo", info }); }
  sendSessionList(sessions: readonly Record<string, unknown>[], rootInfo?: { label: string; path: string; isDefault: boolean }): void {
    this.post({ type: "sessionList", sessions, ...rootInfo });
  }
  sendSessionListLoading(folderPath: string): void {
    this.post({ type: "sessionListLoading", folderPath });
  }
  sendBookmarkList(files: Record<string, unknown>): void { this.post({ type: "bookmarkList", files }); }
  sendDisplayOptions(options: SessionDisplayOptions): void { this.post({ type: "sessionDisplayOptions", options }); }
  setSessionActive(active: boolean): void { this.isSessionActive = active; this.post({ type: "sessionState", active }); }
  updateWatchCounts(counts: ReadonlyMap<string, number>): void {
    this.post({ type: "updateWatchCounts", counts: Object.fromEntries(counts) });
  }

  dispose(): void {
    this.stopBatchTimer();
    this.panel?.dispose();
    this.panel = undefined;
  }

  // -- Private --
  private setupWebview(audioUri: vscode.Uri, codiconsUri: vscode.Uri): void {
    if (!this.panel) { return; }
    const wv = this.panel.webview;
    const audioWebviewUri = wv.asWebviewUri(audioUri).toString();
    const codiconCssUri = wv.asWebviewUri(vscode.Uri.joinPath(codiconsUri, 'codicon.css')).toString();
    const cfg = getConfig();
    const viewerMaxLines = getEffectiveViewerLines(cfg.maxLines, cfg.viewerMaxLines ?? 0);
    wv.html = buildViewerHtml({
      nonce: getNonce(),
      extensionUri: audioWebviewUri,
      version: this.version,
      cspSource: wv.cspSource,
      codiconCssUri,
      viewerMaxLines,
      viewerPreserveAsciiBoxArt: cfg.viewerPreserveAsciiBoxArt,
      viewerGroupAsciiArt: cfg.viewerGroupAsciiArt,
      viewerRepeatThresholds: cfg.viewerRepeatThresholds,
      viewerDbInsightsEnabled: cfg.viewerDbInsightsEnabled,
      staticSqlFromFingerprintEnabled: cfg.staticSqlFromFingerprintEnabled,
      viewerDbDetectorToggles: viewerDbDetectorTogglesFromConfig(cfg),
      viewerSlowBurstThresholds: cfg.viewerSlowBurstThresholds,

    });
    wv.onDidReceiveMessage((msg: Record<string, unknown>) => this.handleMessage(msg));
    this.startBatchTimer();
    queueMicrotask(() => helpers.sendCachedConfig(this.cachedPresets, this.cachedHighlightRules, (m) => this.post(m)));
    queuePopOutViewerConfigMicrotask((m) => this.post(m), cfg);
    void this.runHydrationFromDisk();
    this.panel.onDidDispose(() => {
      this.stopBatchTimer();
      this.broadcaster.removeTarget(this);
      this.panel = undefined;
    });
  }

  private handleMessage(msg: Record<string, unknown>): void {
    const ctx = buildPopOutMessageContext(
      { currentFileUri: this.currentFileUri, isSessionActive: this.isSessionActive, context: this.context, version: this.version, post: (m) => this.post(m) },
      this.handlers,
    );
    dispatchViewerMessage(msg, ctx);
  }

  getPanel() { return this.panel; }
  private startBatchTimer(): void { startPopOutBatchTimer(this); }
  private stopBatchTimer(): void { stopPopOutBatchTimer(this); }
  private post(message: unknown): void { this.panel?.webview.postMessage(message); }

  postToWebview(message: unknown): void {
    this.post(message);
  }

  /**
   * Load the same log file as the sidebar so the pop-out shows the full capture, not only lines after open.
   * Live lines received during load are deferred and replayed after the snapshot so nothing is dropped.
   */
  private async runHydrationFromDisk(): Promise<void> {
    const gen = ++this.hydrateGen;
    try {
      const uri = this.getHydrationUri?.();
      if (!uri) {
        this.replayDeferredLinesAfterSnapshot(undefined);
        return;
      }
      this.currentFileUri = uri;
      flushThreadDump(this.threadDumpState, this.pendingLines);
      this.pendingLines = [];
      this.seenCategories.clear();
      this.post({ type: "clear" });

      const loadTarget: LogViewerLoadTarget = {
        postMessage: (m) => this.post(m),
        setFilename: (name) => this.setFilename(name),
        setSessionInfo: (info) => this.setSessionInfo(info),
        setHasPerformanceData: (has) => this.setHasPerformanceData(has),
        setCodeQualityPayload: (payload) => { this.post({ type: "setCodeQualityPayload", payload }); },
        getSeenCategories: () => this.seenCategories,
      };
      const result = await executeLoadContent(loadTarget, uri, () => gen === this.hydrateGen && !!this.panel);
      if (gen !== this.hydrateGen || !this.panel) { return; }
      // Live capture uses addLine only; mirror the sidebar (not viewing a static file) after loading the snapshot.
      if (this.isSessionActive) {
        this.post({ type: "setViewingMode", viewing: false });
      }
      this.replayDeferredLinesAfterSnapshot(result.contentLength);
    } finally {
      this.hydratingFromFile = false;
    }
  }

  /** Replay lines that arrived while hydrating; skip ones already present in the file snapshot. */
  private replayDeferredLinesAfterSnapshot(loadedContentLength: number | undefined): void {
    const toReplay = filterDeferredLinesAfterSnapshot(this.deferredLinesDuringHydrate, loadedContentLength);
    this.deferredLinesDuringHydrate = [];
    for (const d of toReplay) {
      addLineToBatch(this, d);
    }
  }
}

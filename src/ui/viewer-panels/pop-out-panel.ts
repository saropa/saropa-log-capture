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
import type { ErrorRateConfig, ViewerDbDetectorToggles } from "../../modules/config/config-types";
import type { ViewerBroadcaster } from "../provider/viewer-broadcaster";
import * as helpers from "../provider/viewer-provider-helpers";
import { addLineToBatch, appendLiveLineToBatch } from "../provider/log-viewer-provider-batch";
import { type ThreadDumpState, createThreadDumpState, flushThreadDump } from "../viewer/viewer-thread-grouping";
import { dispatchViewerMessage, type ViewerMessageContext } from "../provider/viewer-message-handler";
import { executeLoadContent, type LogViewerLoadTarget } from "../provider/log-viewer-provider-load";
import { queuePopOutViewerConfigMicrotask } from "./pop-out-panel-viewer-config-post";
import { filterDeferredLinesAfterSnapshot } from "./pop-out-panel-deferred-replay";

const BATCH_INTERVAL_MS = 200;
const BATCH_INTERVAL_UNDER_LOAD_MS = 500;
const BATCH_BACKLOG_THRESHOLD = 1000;

/** Pop-out viewer as an editor tab (movable to a floating window). */
export class PopOutPanel implements ViewerTarget, vscode.Disposable {
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
  private onAddBookmark?: (lineIndex: number, text: string, fileUri: vscode.Uri | undefined) => void;
  private onBookmarkAction?: (msg: Record<string, unknown>) => void;
  private onSessionAction?: (action: string, uriStrings: string[], filenames: string[]) => void;
  private onBrowseSessionRoot?: () => Promise<void>;
  private onClearSessionRoot?: () => Promise<void>;

  /** Snapshot URI from the main viewer so the pop-out can load full on-disk history when opened. */
  private readonly getHydrationUri?: () => vscode.Uri | undefined;

  private hydratingFromFile = false;
  private deferredLinesDuringHydrate: LineData[] = [];
  private hydrateGen = 0;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly version: string,
    private readonly context: vscode.ExtensionContext,
    private readonly broadcaster: ViewerBroadcaster,
    getHydrationUri?: () => vscode.Uri | undefined,
  ) {
    this.getHydrationUri = getHydrationUri;
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
  setMarkerHandler(h: () => void): void { this.onMarkerRequest = h; }
  setTogglePauseHandler(h: () => void): void { this.onTogglePause = h; }
  setExclusionAddedHandler(h: (p: string) => void): void { this.onExclusionAdded = h; }
  setExclusionRemovedHandler(h: (p: string) => void): void { this.onExclusionRemoved = h; }
  setAnnotationPromptHandler(h: (i: number, c: string) => void): void { this.onAnnotationPrompt = h; }
  setSearchCodebaseHandler(h: (t: string) => void): void { this.onSearchCodebase = h; }
  setSearchSessionsHandler(h: (t: string) => void): void { this.onSearchSessions = h; }
  setAnalyzeLineHandler(h: (t: string, i: number, u: vscode.Uri | undefined) => void): void { this.onAnalyzeLine = h; }
  setAddToWatchHandler(h: (t: string) => void): void { this.onAddToWatch = h; }
  setLinkClickHandler(h: (p: string, l: number, c: number, s: boolean) => void): void { this.onLinkClick = h; }
  setPartNavigateHandler(h: (p: number) => void): void { this.onPartNavigate = h; }
  setSavePresetRequestHandler(h: (f: Record<string, unknown>) => void): void { this.onSavePresetRequest = h; }
  setSessionListHandler(h: () => void): void { this.onSessionListRequest = h; }
  setOpenSessionFromPanelHandler(h: (u: string) => void): void { this.onOpenSessionFromPanel = h; }
  setDisplayOptionsHandler(h: (o: SessionDisplayOptions) => void): void { this.onDisplayOptionsChange = h; }
  setAddBookmarkHandler(h: (i: number, t: string, u: vscode.Uri | undefined) => void): void { this.onAddBookmark = h; }
  setBookmarkActionHandler(h: (msg: Record<string, unknown>) => void): void { this.onBookmarkAction = h; }
  setSessionActionHandler(h: (a: string, uriStrings: string[], filenames: string[]) => void): void { this.onSessionAction = h; }
  setBrowseSessionRootHandler(h: () => Promise<void>): void { this.onBrowseSessionRoot = h; }
  setClearSessionRootHandler(h: () => Promise<void>): void { this.onClearSessionRoot = h; }
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
  setShowDecorations(show: boolean): void { this.post({ type: "setShowDecorations", show }); }
  setErrorClassificationSettings(s: boolean, b: boolean, d: string, fw: boolean, stderrAsErr: boolean): void {
    this.post({
      type: "errorClassificationSettings",
      suppressTransientErrors: s,
      breakOnCritical: b,
      levelDetection: d,
      deemphasizeFrameworkLevels: fw,
      stderrTreatAsError: stderrAsErr,
    });
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
  setScopeContext(ctx: ScopeContext): void { this.post({ type: "setScopeContext", ...ctx }); }
  setMinimapShowInfo(show: boolean): void { this.post({ type: "minimapShowInfo", show }); }
  setMinimapShowSqlDensity(show: boolean): void { this.post({ type: "minimapShowSqlDensity", show }); }
  setMinimapProportionalLines(show: boolean): void { this.post({ type: "minimapProportionalLines", show }); }
  setMinimapViewportRedOutline(show: boolean): void { this.post({ type: "minimapViewportRedOutline", show }); }
  setMinimapViewportOutsideArrow(show: boolean): void { this.post({ type: "minimapViewportOutsideArrow", show }); }
  setViewerRepeatThresholds(thresholds: ViewerRepeatThresholds): void {
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
  setViewerDbInsightsEnabled(enabled: boolean): void {
    this.post({ type: "setViewerDbInsightsEnabled", enabled });
  }
  setStaticSqlFromFingerprintEnabled(enabled: boolean): void {
    this.post({ type: "setStaticSqlFromFingerprintEnabled", enabled });
  }
  setViewerDbDetectorToggles(toggles: ViewerDbDetectorToggles): void {
    this.post({
      type: "setViewerDbDetectorToggles",
      nPlusOneEnabled: toggles.nPlusOneEnabled,
      slowBurstEnabled: toggles.slowBurstEnabled,
      baselineHintsEnabled: toggles.baselineHintsEnabled,
    });
  }
  setDbBaselineFingerprintSummary(
    entries: Readonly<Record<string, PersistedDriftSqlFingerprintEntryV1>> | null,
  ): void {
    this.post({ type: "setDbBaselineFingerprintSummary", fingerprints: entries });
  }
  setViewerSlowBurstThresholds(thresholds: ViewerSlowBurstThresholds): void {
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
  setViewerSqlPatternChipSettings(chipMinCount: number, chipMaxChips: number): void {
    this.post({ type: "setViewerSqlPatternChipSettings", chipMinCount, chipMaxChips });
  }
  setMinimapWidth(width: "small" | "medium" | "large"): void { this.post({ type: "minimapWidth", width }); }
  setScrollbarVisible(show: boolean): void { this.post({ type: "scrollbarVisible", show }); }
  setSearchMatchOptionsAlwaysVisible(always: boolean): void { this.post({ type: "searchMatchOptionsAlwaysVisible", always }); }
  setIconBarPosition(position: "left" | "right"): void { this.post({ type: "iconBarPosition", position }); }
  setErrorRateConfig(config: ErrorRateConfig): void {
    this.post({ type: "setErrorRateConfig", bucketSize: config.bucketSize, showWarnings: config.showWarnings, detectSpikes: config.detectSpikes });
  }
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
      viewerRepeatThresholds: cfg.viewerRepeatThresholds,
      viewerDbInsightsEnabled: cfg.viewerDbInsightsEnabled,
      staticSqlFromFingerprintEnabled: cfg.staticSqlFromFingerprintEnabled,
      viewerDbDetectorToggles: viewerDbDetectorTogglesFromConfig(cfg),
      viewerSlowBurstThresholds: cfg.viewerSlowBurstThresholds,
      viewerSqlPatternChipMinCount: cfg.viewerSqlPatternChipMinCount,
      viewerSqlPatternMaxChips: cfg.viewerSqlPatternMaxChips,
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
    const ctx: ViewerMessageContext = {
      currentFileUri: this.currentFileUri,
      isSessionActive: this.isSessionActive,
      context: this.context,
      extensionVersion: this.version,
      post: (m) => this.post(m),
      load: async () => { /* pop-out does not load files; edit will refresh via sidebar if needed */ },
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
    dispatchViewerMessage(msg, ctx);
  }

  private startBatchTimer(): void {
    this.stopBatchTimer();
    this.scheduleNextBatch();
  }
  private scheduleNextBatch(): void {
    if (!this.panel) { return; }
    const delay = this.pendingLines.length > BATCH_BACKLOG_THRESHOLD ? BATCH_INTERVAL_UNDER_LOAD_MS : BATCH_INTERVAL_MS;
    this.batchTimer = setTimeout(() => {
      this.batchTimer = undefined;
      this.flushBatch();
      this.scheduleNextBatch();
    }, delay);
  }
  private stopBatchTimer(): void {
    if (this.batchTimer !== undefined) {
      clearTimeout(this.batchTimer);
      this.batchTimer = undefined;
    }
  }
  private flushBatch(): void {
    helpers.flushBatch(this.pendingLines, !!this.panel, (m) => this.post(m),
      (lines) => helpers.sendNewCategories(lines, this.seenCategories, (m) => this.post(m)));
  }
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

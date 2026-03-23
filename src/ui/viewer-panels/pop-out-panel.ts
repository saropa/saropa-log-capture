/**
 * Pop-out log viewer panel.
 *
 * Opens the same viewer HTML as an editor-tab WebviewPanel so the user
 * can drag it to a second monitor. Implements ViewerTarget for broadcast
 * compatibility with the sidebar LogViewerProvider.
 */

import * as vscode from "vscode";
import type { ViewerRepeatThresholds } from "../../modules/db/drift-db-repeat-thresholds";
import { ansiToHtml, escapeHtml } from "../../modules/capture/ansi";
import { linkifyHtml, linkifyUrls } from "../../modules/source/source-linker";
import { getNonce, buildViewerHtml, getEffectiveViewerLines } from "../provider/viewer-content";
import { getConfig } from "../../modules/config/config";
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
import type { ViewerBroadcaster } from "../provider/viewer-broadcaster";
import * as helpers from "../provider/viewer-provider-helpers";
import { type ThreadDumpState, createThreadDumpState, processLineForThreadDump, flushThreadDump } from "../viewer/viewer-thread-grouping";
import { dispatchViewerMessage, type ViewerMessageContext } from "../provider/viewer-message-handler";
import { getViewerKeybindingsFromConfig } from "../viewer/viewer-keybindings";

const BATCH_INTERVAL_MS = 200;
const BATCH_INTERVAL_UNDER_LOAD_MS = 500;
const BATCH_BACKLOG_THRESHOLD = 1000;

/** Pop-out viewer as an editor tab (movable to a floating window). */
export class PopOutPanel implements ViewerTarget, vscode.Disposable {
  private panel: vscode.WebviewPanel | undefined;
  private pendingLines: PendingLine[] = [];
  private batchTimer: ReturnType<typeof setTimeout> | undefined;
  private readonly threadDumpState: ThreadDumpState = createThreadDumpState();
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

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly version: string,
    private readonly context: vscode.ExtensionContext,
    private readonly broadcaster: ViewerBroadcaster,
  ) {}

  /** Open or reveal the pop-out panel, then move to a new window. */
  async open(): Promise<void> {
    if (this.panel) { this.panel.reveal(); return; }
    const audioUri = vscode.Uri.joinPath(this.extensionUri, 'audio');
    const codiconsUri = vscode.Uri.joinPath(this.extensionUri, 'media', 'codicons');
    this.panel = vscode.window.createWebviewPanel(
      'saropaLogCapture.popOutViewer',
      'Saropa Log Capture',
      vscode.ViewColumn.Active,
      { enableScripts: true, retainContextWhenHidden: true, localResourceRoots: [audioUri, codiconsUri] },
    );
    this.broadcaster.addTarget(this);
    this.setupWebview(audioUri, codiconsUri);
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
    /* Skip when panel not visible to avoid CPU spike (same as sidebar viewer). */
    if (!this.panel?.visible) { return; }
    let html = data.isMarker ? escapeHtml(data.text) : linkifyUrls(linkifyHtml(ansiToHtml(data.text)));
    if (!data.isMarker) { html = helpers.tryFormatThreadHeader(data.text, html); }
    const fw = helpers.classifyFrame(data.text);
    const qualityPercent = data.isMarker ? undefined : helpers.lookupQuality(data.text, fw);
    const line: PendingLine = {
      text: html, isMarker: data.isMarker, lineCount: data.lineCount,
      category: data.category, timestamp: data.timestamp.getTime(),
      fw, sourcePath: data.sourcePath,
      ...(qualityPercent === undefined ? {} : { qualityPercent }),
    };
    processLineForThreadDump(this.threadDumpState, line, data.text, this.pendingLines);
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
  setErrorClassificationSettings(s: boolean, b: boolean, d: string, fw: boolean): void { this.post({ type: "errorClassificationSettings", suppressTransientErrors: s, breakOnCritical: b, levelDetection: d, deemphasizeFrameworkLevels: fw }); }
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
  setViewerSqlPatternChipSettings(chipMinCount: number, chipMaxChips: number): void {
    this.post({ type: "setViewerSqlPatternChipSettings", chipMinCount, chipMaxChips });
  }
  setMinimapWidth(width: "small" | "medium" | "large"): void { this.post({ type: "minimapWidth", width }); }
  setScrollbarVisible(show: boolean): void { this.post({ type: "scrollbarVisible", show }); }
  setSearchMatchOptionsAlwaysVisible(always: boolean): void { this.post({ type: "searchMatchOptionsAlwaysVisible", always }); }
  setIconBarPosition(position: "left" | "right"): void { this.post({ type: "iconBarPosition", position }); }
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
      viewerRepeatThresholds: cfg.viewerRepeatThresholds,
      viewerDbInsightsEnabled: cfg.viewerDbInsightsEnabled,
      viewerSqlPatternChipMinCount: cfg.viewerSqlPatternChipMinCount,
      viewerSqlPatternMaxChips: cfg.viewerSqlPatternMaxChips,
    });
    wv.onDidReceiveMessage((msg: Record<string, unknown>) => this.handleMessage(msg));
    this.startBatchTimer();
    queueMicrotask(() => helpers.sendCachedConfig(this.cachedPresets, this.cachedHighlightRules, (m) => this.post(m)));
    queueMicrotask(() => this.post({ type: 'setViewerKeybindings', keyToAction: getViewerKeybindingsFromConfig() }));
    queueMicrotask(() => this.post({ type: 'minimapShowSqlDensity', show: getConfig().minimapShowSqlDensity }));
    queueMicrotask(() => this.post({ type: 'setViewerRepeatThresholds', thresholds: getConfig().viewerRepeatThresholds }));
    queueMicrotask(() => this.post({ type: 'setViewerDbInsightsEnabled', enabled: getConfig().viewerDbInsightsEnabled }));
    queueMicrotask(() => this.post({
      type: 'setViewerSqlPatternChipSettings',
      chipMinCount: getConfig().viewerSqlPatternChipMinCount,
      chipMaxChips: getConfig().viewerSqlPatternMaxChips,
    }));
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
}

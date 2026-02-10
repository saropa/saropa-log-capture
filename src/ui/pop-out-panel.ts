/**
 * Pop-out log viewer panel.
 *
 * Opens the same viewer HTML as an editor-tab WebviewPanel so the user
 * can drag it to a second monitor. Implements ViewerTarget for broadcast
 * compatibility with the sidebar LogViewerProvider.
 */

import * as vscode from "vscode";
import { ansiToHtml, escapeHtml } from "../modules/ansi";
import { linkifyHtml, linkifyUrls } from "../modules/source-linker";
import { getNonce, buildViewerHtml } from "./viewer-content";
import type { LineData } from "../modules/session-manager";
import type { HighlightRule } from "../modules/highlight-rules";
import type { FilterPreset } from "../modules/filter-presets";
import type { ScopeContext } from "../modules/scope-context";
import { showBugReport } from "./bug-report-panel";
import { PendingLine } from "./viewer-file-loader";
import {
  SerializedHighlightRule, serializeHighlightRules,
} from "./viewer-highlight-serializer";
import type { SessionDisplayOptions } from "./session-display";
import type { ViewerTarget } from "./viewer-target";
import type { ViewerBroadcaster } from "./viewer-broadcaster";
import * as helpers from "./viewer-provider-helpers";

const BATCH_INTERVAL_MS = 200;

/** Pop-out viewer as an editor tab (movable to a floating window). */
export class PopOutPanel implements ViewerTarget, vscode.Disposable {
  private panel: vscode.WebviewPanel | undefined;
  private pendingLines: PendingLine[] = [];
  private batchTimer: ReturnType<typeof setInterval> | undefined;
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
  private onSessionAction?: (action: string, uriString: string, filename: string) => void;

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
  setSessionActionHandler(h: (a: string, u: string, f: string) => void): void { this.onSessionAction = h; }
  // -- ViewerTarget state methods --
  addLine(data: LineData): void {
    if (!this.panel) { return; }
    let html = data.isMarker ? escapeHtml(data.text) : linkifyUrls(linkifyHtml(ansiToHtml(data.text)));
    if (!data.isMarker) { html = helpers.tryFormatThreadHeader(data.text, html); }
    this.pendingLines.push({
      text: html, isMarker: data.isMarker, lineCount: data.lineCount,
      category: data.category, timestamp: data.timestamp.getTime(),
      fw: helpers.classifyFrame(data.text), sourcePath: data.sourcePath,
    });
  }

  clear(): void { this.pendingLines = []; this.currentFileUri = undefined; this.post({ type: "clear" }); this.setSessionInfo(null); }
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
    this.post({ type: "setPresets", presets });
  }
  setCurrentFile(uri: vscode.Uri | undefined): void { this.currentFileUri = uri; }
  setScopeContext(ctx: ScopeContext): void { this.post({ type: "setScopeContext", ...ctx }); }
  setIconBarPosition(position: "left" | "right"): void { this.post({ type: "iconBarPosition", position }); }
  setSessionInfo(info: Record<string, string> | null): void { this.post({ type: "setSessionInfo", info }); }
  sendSessionList(sessions: readonly Record<string, unknown>[]): void { this.post({ type: "sessionList", sessions }); }
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
    wv.html = buildViewerHtml({ nonce: getNonce(), extensionUri: audioWebviewUri, version: this.version, cspSource: wv.cspSource, codiconCssUri });
    wv.onDidReceiveMessage((msg: Record<string, unknown>) => this.handleMessage(msg));
    this.startBatchTimer();
    queueMicrotask(() => helpers.sendCachedConfig(this.cachedPresets, this.cachedHighlightRules, (m) => this.post(m)));
    this.panel.onDidDispose(() => {
      this.stopBatchTimer();
      this.broadcaster.removeTarget(this);
      this.panel = undefined;
    });
  }

  private handleMessage(msg: Record<string, unknown>): void {
    switch (msg.type) {
      case "insertMarker": this.onMarkerRequest?.(); break;
      case "togglePause": this.onTogglePause?.(); break;
      case "copyToClipboard": vscode.env.clipboard.writeText(String(msg.text ?? "")); break;
      case "exclusionAdded":
      case "addToExclusion": this.onExclusionAdded?.(String(msg.pattern ?? msg.text ?? "")); break;
      case "exclusionRemoved": this.onExclusionRemoved?.(String(msg.pattern ?? "")); break;
      case "openSettings": void vscode.commands.executeCommand("workbench.action.openSettings", String(msg.setting ?? "")); break;
      case "searchCodebase": this.onSearchCodebase?.(String(msg.text ?? "")); break;
      case "searchSessions": this.onSearchSessions?.(String(msg.text ?? "")); break;
      case "analyzeLine": this.onAnalyzeLine?.(String(msg.text ?? ""), Number(msg.lineIndex ?? -1), this.currentFileUri); break;
      case "generateReport":
        if (this.currentFileUri) { showBugReport(String(msg.text ?? ""), Number(msg.lineIndex ?? 0), this.currentFileUri).catch(() => {}); }
        break;
      case "addToWatch": this.onAddToWatch?.(String(msg.text ?? "")); break;
      case "promptAnnotation": this.onAnnotationPrompt?.(Number(msg.lineIndex ?? 0), String(msg.current ?? "")); break;
      case "addBookmark": this.onAddBookmark?.(Number(msg.lineIndex ?? 0), String(msg.text ?? ""), this.currentFileUri); break;
      case "linkClicked":
        this.onLinkClick?.(String(msg.path ?? ""), Number(msg.line ?? 1), Number(msg.col ?? 1), Boolean(msg.splitEditor));
        break;
      case "openUrl": vscode.env.openExternal(vscode.Uri.parse(String(msg.url ?? ""))).then(undefined, () => {}); break;
      case "navigatePart": this.onPartNavigate?.(Number(msg.part ?? 1)); break;
      case "savePresetRequest": this.onSavePresetRequest?.((msg.filters as Record<string, unknown>) ?? {}); break;
      case "setCaptureAll":
        vscode.workspace.getConfiguration("saropaLogCapture")
          .update("captureAll", Boolean(msg.value), vscode.ConfigurationTarget.Workspace);
        break;
      case "editLine":
        helpers.handleEditLine(this.currentFileUri, this.isSessionActive, {
          lineIndex: Number(msg.lineIndex ?? 0), newText: String(msg.newText ?? ""),
          timestamp: Number(msg.timestamp ?? 0), loadFromFile: () => Promise.resolve(),
        }).catch((err: Error) => { vscode.window.showErrorMessage(`Failed to edit line: ${err.message}`); });
        break;
      case "exportLogs":
        helpers.handleExportLogs(String(msg.text ?? ""), (msg.options as Record<string, unknown>) ?? {})
          .catch((err: Error) => { vscode.window.showErrorMessage(`Failed to export logs: ${err.message}`); });
        break;
      case "saveLevelFilters":
        helpers.saveLevelFilters(this.context, String(msg.filename ?? ""), (msg.levels as string[]) ?? []);
        break;
      case "requestBookmarks": case "deleteBookmark": case "deleteFileBookmarks":
      case "deleteAllBookmarks": case "editBookmarkNote": case "openBookmark": this.onBookmarkAction?.(msg); break;
      case "requestSessionList": this.onSessionListRequest?.(); break;
      case "openSessionFromPanel": this.onOpenSessionFromPanel?.(String(msg.uriString ?? "")); break;
      case "sessionAction": this.onSessionAction?.(String(msg.action ?? ""), String(msg.uriString ?? ""), String(msg.filename ?? "")); break;
      case "setSessionDisplayOptions": this.onDisplayOptionsChange?.((msg.options as SessionDisplayOptions)); break;
      case "scriptError":
        for (const e of (msg.errors as { message: string }[]) ?? []) { console.warn("[SLC PopOut]", e.message); }
        break;
    }
  }

  private startBatchTimer(): void {
    helpers.stopBatchTimer(this.batchTimer);
    this.batchTimer = helpers.startBatchTimer(BATCH_INTERVAL_MS, () => this.flushBatch(), () => this.stopBatchTimer());
  }
  private stopBatchTimer(): void { helpers.stopBatchTimer(this.batchTimer); this.batchTimer = undefined; }
  private flushBatch(): void {
    helpers.flushBatch(this.pendingLines, !!this.panel, (m) => this.post(m),
      (lines) => helpers.sendNewCategories(lines, this.seenCategories, (m) => this.post(m)));
  }
  private post(message: unknown): void { this.panel?.webview.postMessage(message); }
}

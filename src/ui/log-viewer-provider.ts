import * as vscode from "vscode";
import { ansiToHtml, escapeHtml } from "../modules/ansi";
import { linkifyHtml } from "../modules/source-linker";
import { getNonce, buildViewerHtml } from "./viewer-content";
import { LineData } from "../modules/session-manager";
import { HighlightRule } from "../modules/highlight-rules";
import { FilterPreset } from "../modules/filter-presets";
import {
  PendingLine, findHeaderEnd, sendFileLines, parseHeaderFields,
  computeSessionMidnight,
} from "./viewer-file-loader";
import {
  SerializedHighlightRule, serializeHighlightRules,
} from "./viewer-highlight-serializer";
import type { SessionDisplayOptions } from "./session-display";
import type { ViewerTarget } from "./viewer-target";
import * as helpers from "./viewer-provider-helpers";

const BATCH_INTERVAL_MS = 200;

/**
 * Provides a webview-based sidebar panel that displays captured
 * debug output in real time with auto-scroll and theme support.
 */
export class LogViewerProvider
  implements vscode.WebviewViewProvider, ViewerTarget, vscode.Disposable
{
  private view: vscode.WebviewView | undefined;
  private pendingLines: PendingLine[] = [];
  private batchTimer: ReturnType<typeof setInterval> | undefined;
  private onMarkerRequest?: () => void;
  private onLinkClick?: (path: string, line: number, col: number, split: boolean) => void;
  private onTogglePause?: () => void;
  private onExclusionAdded?: (pattern: string) => void;
  private onExclusionRemoved?: (pattern: string) => void;
  private onAnnotationPrompt?: (lineIndex: number, current: string) => void;
  private onSearchCodebase?: (text: string) => void;
  private onSearchSessions?: (text: string) => void;
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
  private readonly seenCategories = new Set<string>();
  private unreadWatchHits = 0;
  private cachedPresets: readonly FilterPreset[] = [];
  private cachedHighlightRules: SerializedHighlightRule[] = [];
  private currentFileUri: vscode.Uri | undefined;
  private isSessionActive = false;
  private pendingLoadUri: vscode.Uri | undefined;
  private loadGeneration = 0;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly version: string,
    private readonly context: vscode.ExtensionContext,
  ) {}

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;
    const audioUri = vscode.Uri.joinPath(this.extensionUri, 'audio');
    const codiconsUri = vscode.Uri.joinPath(this.extensionUri, 'media', 'codicons');
    webviewView.webview.options = { enableScripts: true, localResourceRoots: [audioUri, codiconsUri] };
    const audioWebviewUri = webviewView.webview.asWebviewUri(audioUri).toString();
    const codiconCssUri = webviewView.webview.asWebviewUri(
      vscode.Uri.joinPath(codiconsUri, 'codicon.css'),
    ).toString();
    const cspSource = webviewView.webview.cspSource;
    webviewView.webview.html = buildViewerHtml(getNonce(), audioWebviewUri, this.version, cspSource, codiconCssUri);
    webviewView.webview.onDidReceiveMessage((msg: Record<string, unknown>) =>
      this.handleMessage(msg),
    );
    this.startBatchTimer();
    queueMicrotask(() => helpers.sendCachedConfig(this.cachedPresets, this.cachedHighlightRules, (msg) => this.postMessage(msg)));
    if (this.pendingLoadUri) { queueMicrotask(() => { void this.loadFromFile(this.pendingLoadUri!); }); }
    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) {
        this.unreadWatchHits = 0;
        helpers.updateBadge(this.view, this.unreadWatchHits);
      }
    });
    webviewView.onDidDispose(() => {
      this.stopBatchTimer();
      this.view = undefined;
    });
  }

  // -- Handler setters (one callback per webview action) --
  setMarkerHandler(handler: () => void): void { this.onMarkerRequest = handler; }
  setTogglePauseHandler(handler: () => void): void { this.onTogglePause = handler; }
  setExclusionAddedHandler(handler: (pattern: string) => void): void { this.onExclusionAdded = handler; }
  setExclusionRemovedHandler(handler: (pattern: string) => void): void { this.onExclusionRemoved = handler; }
  setAnnotationPromptHandler(handler: (lineIndex: number, current: string) => void): void { this.onAnnotationPrompt = handler; }
  setSearchCodebaseHandler(handler: (text: string) => void): void { this.onSearchCodebase = handler; }
  setSearchSessionsHandler(handler: (text: string) => void): void { this.onSearchSessions = handler; }
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

  // -- Webview state methods --

  scrollToLine(line: number): void { this.postMessage({ type: "scrollToLine", line }); }
  setExclusions(patterns: readonly string[]): void { this.postMessage({ type: "setExclusions", patterns }); }
  setAnnotation(lineIndex: number, text: string): void { this.postMessage({ type: "setAnnotation", lineIndex, text }); }
  loadAnnotations(annotations: readonly { lineIndex: number; text: string }[]): void { this.postMessage({ type: "loadAnnotations", annotations }); }

  setSplitInfo(currentPart: number, totalParts: number): void { this.postMessage({ type: "splitInfo", currentPart, totalParts }); }
  updateFooter(text: string): void { this.postMessage({ type: "updateFooter", text }); }
  setPaused(paused: boolean): void { this.postMessage({ type: "setPaused", paused }); }
  setFilename(filename: string): void {
    this.postMessage({ type: "setFilename", filename });
    const levels = helpers.getSavedLevelFilters(this.context, filename);
    if (levels) { this.postMessage({ type: "restoreLevelFilters", levels }); }
  }
  setContextLines(count: number): void { this.postMessage({ type: "setContextLines", count }); }
  setContextViewLines(count: number): void { this.postMessage({ type: "setContextViewLines", count }); }
  setShowElapsed(show: boolean): void { this.postMessage({ type: "setShowElapsed", show }); }

  setShowDecorations(show: boolean): void { this.postMessage({ type: "setShowDecorations", show }); }
  setErrorClassificationSettings(suppressTransientErrors: boolean, breakOnCritical: boolean): void { this.postMessage({ type: "errorClassificationSettings", suppressTransientErrors, breakOnCritical }); }

  applyPreset(name: string): void { this.postMessage({ type: "applyPreset", name }); }
  setHighlightRules(rules: readonly HighlightRule[]): void {
    this.cachedHighlightRules = serializeHighlightRules(rules);
    this.postMessage({ type: "setHighlightRules", rules: this.cachedHighlightRules });
  }
  setPresets(presets: readonly FilterPreset[]): void {
    this.cachedPresets = presets;
    this.postMessage({ type: "setPresets", presets });
  }
  addLine(data: LineData): void {
    const html = data.isMarker ? escapeHtml(data.text) : linkifyHtml(ansiToHtml(data.text));
    this.pendingLines.push({
      text: html,
      isMarker: data.isMarker,
      lineCount: data.lineCount,
      category: data.category,
      timestamp: data.timestamp.getTime(),
      fw: helpers.classifyFrame(data.text),
    });
  }

  setCurrentFile(uri: vscode.Uri | undefined): void { this.currentFileUri = uri; }
  setSessionInfo(info: Record<string, string> | null): void { this.postMessage({ type: "setSessionInfo", info }); }

  sendFindResults(results: unknown): void { this.postMessage({ type: "findResults", ...results as Record<string, unknown> }); }
  setupFindSearch(query: string, options: Record<string, unknown>): void { this.postMessage({ type: "setupFindSearch", query, ...options }); }
  findNextMatch(): void { this.postMessage({ type: "findNextMatch" }); }
  sendSessionList(sessions: readonly Record<string, unknown>[]): void { this.postMessage({ type: "sessionList", sessions }); }
  sendDisplayOptions(options: SessionDisplayOptions): void { this.postMessage({ type: "sessionDisplayOptions", options }); }
  setSessionActive(active: boolean): void { this.isSessionActive = active; this.postMessage({ type: "sessionState", active }); }

  clear(): void { this.pendingLines = []; this.currentFileUri = undefined; this.postMessage({ type: "clear" }); this.setSessionInfo(null); }

  async loadFromFile(uri: vscode.Uri): Promise<void> {
    const gen = ++this.loadGeneration; this.pendingLoadUri = uri;
    this.view?.show?.(true);
    for (let i = 0; i < 20 && !this.view; i++) { await new Promise<void>(r => setTimeout(r, 50)); }
    if (!this.view || gen !== this.loadGeneration) { return; }
    this.clear(); this.seenCategories.clear(); this.currentFileUri = uri;
    const raw = await vscode.workspace.fs.readFile(uri);
    if (gen !== this.loadGeneration) { return; }
    const text = Buffer.from(raw).toString("utf-8"), rawLines = text.split(/\r?\n/);
    this.postMessage({ type: "setViewingMode", viewing: true }); this.setFilename(uri.path.split("/").pop() ?? "");
    const fields = parseHeaderFields(rawLines);
    if (Object.keys(fields).length > 0) { this.setSessionInfo(fields); }
    const post = (msg: unknown): void => { if (gen === this.loadGeneration) { this.postMessage(msg); } };
    const ctx = { classifyFrame: (t: string) => helpers.classifyFrame(t), sessionMidnightMs: computeSessionMidnight(fields['Date'] ?? '') };
    const hasTimestamps = await sendFileLines(rawLines.slice(findHeaderEnd(rawLines)), ctx, post, this.seenCategories);
    if (gen !== this.loadGeneration) { return; }
    this.postMessage({ type: "setTimestampAvailability", available: hasTimestamps });
    this.postMessage({ type: "loadComplete" }); this.pendingLoadUri = undefined;
  }
  updateWatchCounts(counts: ReadonlyMap<string, number>): void {
    const obj = Object.fromEntries(counts);
    const total = [...counts.values()].reduce((s, n) => s + n, 0);
    this.postMessage({ type: "updateWatchCounts", counts: obj });
    if (total > this.unreadWatchHits) { this.unreadWatchHits = total; helpers.updateBadge(this.view, this.unreadWatchHits); }
  }

  dispose(): void { this.stopBatchTimer(); }

  // -- Private methods --

  private handleMessage(msg: Record<string, unknown>): void {
    switch (msg.type) {
      case "insertMarker": this.onMarkerRequest?.(); break;
      case "togglePause": this.onTogglePause?.(); break;
      case "copyToClipboard": vscode.env.clipboard.writeText(String(msg.text ?? "")); break;
      case "copySourcePath":
        helpers.copySourcePath(String(msg.path ?? ""), String(msg.mode ?? "relative"));
        break;
      case "exclusionAdded":
      case "addToExclusion": this.onExclusionAdded?.(String(msg.pattern ?? msg.text ?? "")); break;
      case "exclusionRemoved": this.onExclusionRemoved?.(String(msg.pattern ?? "")); break;
      case "openSettings": void vscode.commands.executeCommand("workbench.action.openSettings", String(msg.setting ?? "")); break;
      case "searchCodebase": this.onSearchCodebase?.(String(msg.text ?? "")); break;
      case "searchSessions": this.onSearchSessions?.(String(msg.text ?? "")); break;
      case "addToWatch": this.onAddToWatch?.(String(msg.text ?? "")); break;
      case "promptAnnotation":
        this.onAnnotationPrompt?.(Number(msg.lineIndex ?? 0), String(msg.current ?? ""));
        break;
      case "addBookmark": this.onAddBookmark?.(Number(msg.lineIndex ?? 0), String(msg.text ?? ""), this.currentFileUri); break;
      case "linkClicked":
        this.onLinkClick?.(String(msg.path ?? ""), Number(msg.line ?? 1), Number(msg.col ?? 1), Boolean(msg.splitEditor));
        break;
      case "navigatePart": this.onPartNavigate?.(Number(msg.part ?? 1)); break;
      case "savePresetRequest":
        this.onSavePresetRequest?.((msg.filters as Record<string, unknown>) ?? {});
        break;
      case "setCaptureAll":
        vscode.workspace.getConfiguration("saropaLogCapture")
          .update("captureAll", Boolean(msg.value), vscode.ConfigurationTarget.Workspace);
        break;
      case "editLine":
        helpers.handleEditLine(this.currentFileUri, this.isSessionActive, Number(msg.lineIndex ?? 0),
          String(msg.newText ?? ""), Number(msg.timestamp ?? 0), (uri) => this.loadFromFile(uri))
          .catch((err) => { vscode.window.showErrorMessage(`Failed to edit line: ${err.message}`); });
        break;
      case "exportLogs":
        helpers.handleExportLogs(String(msg.text ?? ""), (msg.options as Record<string, unknown>) ?? {})
          .catch((err) => { vscode.window.showErrorMessage(`Failed to export logs: ${err.message}`); });
        break;
      case "saveLevelFilters":
        helpers.saveLevelFilters(this.context, String(msg.filename ?? ""), (msg.levels as string[]) ?? []);
        break;
      case "requestFindInFiles":
        this.onFindInFiles?.(String(msg.query ?? ""), { caseSensitive: msg.caseSensitive, wholeWord: msg.wholeWord, useRegex: msg.useRegex });
        break;
      case "openFindResult":
        this.onOpenFindResult?.(String(msg.uriString ?? ""), String(msg.query ?? ""), { caseSensitive: msg.caseSensitive, wholeWord: msg.wholeWord, useRegex: msg.useRegex });
        break;
      case "findNavigateMatch":
        this.onFindNavigateMatch?.(String(msg.uriString ?? ""), Number(msg.matchIndex ?? 0));
        break;
      case "requestSessionList": this.onSessionListRequest?.(); break;
      case "openSessionFromPanel": this.onOpenSessionFromPanel?.(String(msg.uriString ?? "")); break;
      case "popOutViewer": this.onPopOutRequest?.(); break;
      case "revealLogFile":
        if (this.currentFileUri && this.onRevealLogFile) { Promise.resolve(this.onRevealLogFile(this.currentFileUri.toString())).catch(() => {}); }
        break;
      case "setSessionDisplayOptions": this.onDisplayOptionsChange?.((msg.options as SessionDisplayOptions)); break;
      case "promptGoToLine":
        vscode.window.showInputBox({ prompt: "Go to line number", validateInput: (v) => /^\d+$/.test(v) ? null : "Enter a number" })
          .then((v) => { if (v) { this.postMessage({ type: "scrollToLine", line: parseInt(v, 10) }); } });
        break;
      case "scriptError":
        ((msg.errors as { message: string }[]) ?? []).forEach(e => console.warn("[SLC Webview]", e.message));
        break;
    }
  }

  private startBatchTimer(): void {
    helpers.stopBatchTimer(this.batchTimer);
    this.batchTimer = helpers.startBatchTimer(BATCH_INTERVAL_MS, () => this.flushBatch(), () => this.stopBatchTimer());
  }

  private stopBatchTimer(): void { helpers.stopBatchTimer(this.batchTimer); this.batchTimer = undefined; }

  private flushBatch(): void {
    helpers.flushBatch(
      this.pendingLines,
      !!this.view,
      (msg) => this.postMessage(msg),
      (lines) => helpers.sendNewCategories(lines, this.seenCategories, (msg) => this.postMessage(msg))
    );
  }

  private postMessage(message: unknown): void { this.view?.webview.postMessage(message); }
}

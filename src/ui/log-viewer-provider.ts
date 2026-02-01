import * as vscode from "vscode";
import { ansiToHtml, escapeHtml } from "../modules/ansi";
import { linkifyHtml } from "../modules/source-linker";
import { getNonce, buildViewerHtml } from "./viewer-content";
import { LineData } from "../modules/session-manager";
import { HighlightRule } from "../modules/highlight-rules";
import { FilterPreset } from "../modules/filter-presets";
import {
  PendingLine, findHeaderEnd, sendFileLines,
} from "./viewer-file-loader";
import {
  SerializedHighlightRule, serializeHighlightRules,
} from "./viewer-highlight-serializer";
import * as helpers from "./viewer-provider-helpers";

const BATCH_INTERVAL_MS = 200;

/**
 * Provides a webview-based sidebar panel that displays captured
 * debug output in real time with auto-scroll and theme support.
 */
export class LogViewerProvider
  implements vscode.WebviewViewProvider, vscode.Disposable
{
  private view: vscode.WebviewView | undefined;
  private pendingLines: PendingLine[] = [];
  private batchTimer: ReturnType<typeof setInterval> | undefined;
  private onMarkerRequest?: () => void;
  private onLinkClick?: (path: string, line: number, col: number, split: boolean) => void;
  private onTogglePause?: () => void;
  private onExclusionAdded?: (pattern: string) => void;
  private onAnnotationPrompt?: (lineIndex: number, current: string) => void;
  private onSearchCodebase?: (text: string) => void;
  private onSearchSessions?: (text: string) => void;
  private onAddToWatch?: (text: string) => void;
  private onPartNavigate?: (part: number) => void;
  private onSavePresetRequest?: (filters: Record<string, unknown>) => void;
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
  ) {}

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;
    const audioUri = vscode.Uri.joinPath(this.extensionUri, 'audio');
    webviewView.webview.options = { enableScripts: true, localResourceRoots: [audioUri] };
    const audioWebviewUri = webviewView.webview.asWebviewUri(audioUri).toString();
    webviewView.webview.html = buildViewerHtml(getNonce(), audioWebviewUri, this.version);
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

  // -- Handler setters --

  /** Set a callback for marker insertion requests. */
  setMarkerHandler(handler: () => void): void { this.onMarkerRequest = handler; }

  /** Set a callback for pause toggle requests. */
  setTogglePauseHandler(handler: () => void): void { this.onTogglePause = handler; }

  /** Set a callback for exclusion rule additions. */
  setExclusionAddedHandler(handler: (pattern: string) => void): void { this.onExclusionAdded = handler; }

  /** Set a callback for annotation prompts. */
  setAnnotationPromptHandler(handler: (lineIndex: number, current: string) => void): void { this.onAnnotationPrompt = handler; }

  /** Set a callback for codebase search requests. */
  setSearchCodebaseHandler(handler: (text: string) => void): void { this.onSearchCodebase = handler; }

  /** Set a callback for session search requests. */
  setSearchSessionsHandler(handler: (text: string) => void): void { this.onSearchSessions = handler; }

  /** Set a callback for watch list additions. */
  setAddToWatchHandler(handler: (text: string) => void): void { this.onAddToWatch = handler; }

  /** Set a callback for source navigation. */
  setLinkClickHandler(handler: (path: string, line: number, col: number, split: boolean) => void): void {
    this.onLinkClick = handler;
  }

  /** Set a callback for split part navigation. */
  setPartNavigateHandler(handler: (part: number) => void): void { this.onPartNavigate = handler; }

  /** Set a callback for saving current filters as a preset. */
  setSavePresetRequestHandler(handler: (filters: Record<string, unknown>) => void): void {
    this.onSavePresetRequest = handler;
  }

  // -- Webview state methods --

  /** Push exclusion patterns to the webview. */
  setExclusions(patterns: readonly string[]): void { this.postMessage({ type: "setExclusions", patterns }); }

  /** Send annotation text to the webview for a specific line. */
  setAnnotation(lineIndex: number, text: string): void { this.postMessage({ type: "setAnnotation", lineIndex, text }); }

  /** Load all annotations into the webview. */
  loadAnnotations(annotations: readonly { lineIndex: number; text: string }[]): void {
    this.postMessage({ type: "loadAnnotations", annotations });
  }

  /** Update the split breadcrumb in the viewer. */
  setSplitInfo(currentPart: number, totalParts: number): void {
    this.postMessage({ type: "splitInfo", currentPart, totalParts });
  }

  /** Update the footer status text. */
  updateFooter(text: string): void { this.postMessage({ type: "updateFooter", text }); }

  /** Update the pause/resume indicator. */
  setPaused(paused: boolean): void { this.postMessage({ type: "setPaused", paused }); }

  /** Set the active log filename in the footer. */
  setFilename(filename: string): void { this.postMessage({ type: "setFilename", filename }); }

  /** Set context lines for level filtering. */
  setContextLines(count: number): void { this.postMessage({ type: "setContextLines", count }); }

  /** Set context lines for the context view modal. */
  setContextViewLines(count: number): void { this.postMessage({ type: "setContextViewLines", count }); }

  /** Toggle elapsed time display. */
  setShowElapsed(show: boolean): void { this.postMessage({ type: "setShowElapsed", show }); }

  /** Toggle line decoration prefix display. */
  setShowDecorations(show: boolean): void { this.postMessage({ type: "setShowDecorations", show }); }
  /** Send error classification settings. */
  setErrorClassificationSettings(suppressTransientErrors: boolean, breakOnCritical: boolean): void { this.postMessage({ type: "errorClassificationSettings", suppressTransientErrors, breakOnCritical }); }

  /** Apply a preset by name. */
  applyPreset(name: string): void { this.postMessage({ type: "applyPreset", name }); }

  /** Send highlight rules to the webview (serialized for postMessage). */
  setHighlightRules(rules: readonly HighlightRule[]): void {
    this.cachedHighlightRules = serializeHighlightRules(rules);
    this.postMessage({ type: "setHighlightRules", rules: this.cachedHighlightRules });
  }

  /** Send filter presets to the webview dropdown. */
  setPresets(presets: readonly FilterPreset[]): void {
    this.cachedPresets = presets;
    this.postMessage({ type: "setPresets", presets });
  }

  /** Queue a log line for batched delivery to the webview. */
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

  /** Set the current log file URI (for live sessions). */
  setCurrentFile(uri: vscode.Uri | undefined): void {
    this.currentFileUri = uri;
  }

  /** Set whether a debug session is currently active. */
  setSessionActive(active: boolean): void { this.isSessionActive = active; this.postMessage({ type: "sessionState", active }); }

  /** Send a clear message to the webview. */
  clear(): void { this.pendingLines = []; this.currentFileUri = undefined; this.postMessage({ type: "clear" }); }

  /** Load a historical log file into the viewer. */
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
    const post = (msg: unknown): void => { if (gen === this.loadGeneration) { this.postMessage(msg); } };
    await sendFileLines(rawLines.slice(findHeaderEnd(rawLines)), (t) => helpers.classifyFrame(t), post, this.seenCategories);
    if (gen === this.loadGeneration) { this.pendingLoadUri = undefined; }
  }
  /** Send keyword watch hit counts to the webview footer and update badge. */
  updateWatchCounts(counts: ReadonlyMap<string, number>): void {
    const obj: Record<string, number> = {};
    let total = 0;
    for (const [label, count] of counts) {
      obj[label] = count;
      total += count;
    }
    this.postMessage({ type: "updateWatchCounts", counts: obj });
    if (total > this.unreadWatchHits) {
      this.unreadWatchHits = total;
      helpers.updateBadge(this.view, this.unreadWatchHits);
    }
  }

  dispose(): void { this.stopBatchTimer(); }

  // -- Private methods --

  private handleMessage(msg: Record<string, unknown>): void {
    switch (msg.type) {
      case "insertMarker": this.onMarkerRequest?.(); break;
      case "togglePause": this.onTogglePause?.(); break;
      case "copyToClipboard": vscode.env.clipboard.writeText(String(msg.text ?? "")); break;
      case "exclusionAdded":
      case "addToExclusion": this.onExclusionAdded?.(String(msg.pattern ?? msg.text ?? "")); break;
      case "searchCodebase": this.onSearchCodebase?.(String(msg.text ?? "")); break;
      case "searchSessions": this.onSearchSessions?.(String(msg.text ?? "")); break;
      case "addToWatch": this.onAddToWatch?.(String(msg.text ?? "")); break;
      case "promptAnnotation":
        this.onAnnotationPrompt?.(Number(msg.lineIndex ?? 0), String(msg.current ?? ""));
        break;
      case "linkClicked":
        this.onLinkClick?.(String(msg.path ?? ""), Number(msg.line ?? 1), Number(msg.col ?? 1), Boolean(msg.splitEditor));
        break;
      case "requestSourcePreview":
        helpers.handleSourcePreview(String(msg.path ?? ""), Number(msg.line ?? 1), (m) => this.postMessage(m));
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
        helpers.handleEditLine(
          this.currentFileUri,
          this.isSessionActive,
          Number(msg.lineIndex ?? 0),
          String(msg.newText ?? ""),
          Number(msg.timestamp ?? 0),
          (uri) => this.loadFromFile(uri)
        ).catch((err) => {
          vscode.window.showErrorMessage(`Failed to edit line: ${err.message}`);
        });
        break;
      case "exportLogs":
        helpers.handleExportLogs(
          String(msg.text ?? ""),
          (msg.options as Record<string, unknown>) ?? {},
        ).catch((err) => {
          vscode.window.showErrorMessage(`Failed to export logs: ${err.message}`);
        });
        break;
      case "scriptError":
        for (const e of (msg.errors as { message: string }[]) ?? []) {
          console.warn("[SLC Webview]", e.message);
        }
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
      this.view,
      (msg) => this.postMessage(msg),
      (lines) => helpers.sendNewCategories(lines, this.seenCategories, (msg) => this.postMessage(msg))
    );
  }

  private postMessage(message: unknown): void { this.view?.webview.postMessage(message); }
}

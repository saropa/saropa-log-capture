/**
 * Webview setup for LogViewerProvider. Extracted to keep log-viewer-provider.ts under the line limit.
 */

import * as vscode from "vscode";
import { getNonce, buildViewerHtml, getEffectiveViewerLines } from "./viewer-content";
import { getConfig } from "../../modules/config/config";
import { DRIFT_ADVISOR_EXTENSION_ID } from "./drift-advisor-integration";
import * as helpers from "./viewer-provider-helpers";
import { getViewerKeybindingsFromConfig } from "../viewer/viewer-keybindings";

export interface LogViewerSetupTarget {
  getExtensionUri(): vscode.Uri;
  getVersion(): string;
  getContext(): vscode.ExtensionContext;
  startBatchTimer(): void;
  postMessage(msg: unknown): void;
  getCachedPresets(): readonly unknown[];
  getCachedHighlightRules(): unknown[];
  getPendingLoadUri(): vscode.Uri | undefined;
  loadFromFile(uri: vscode.Uri, options?: { tail?: boolean }): Promise<void>;
  sendIntegrationsAdapters(adapterIds: readonly string[]): void;
  setView(view: vscode.WebviewView | undefined): void;
  removeView(webviewView: vscode.WebviewView): void;
  setVisibleView(webviewView: vscode.WebviewView | undefined): void;
  stopBatchTimer(): void;
  getView(): vscode.WebviewView | undefined;
  getUnreadWatchHits(): number;
  setUnreadWatchHits(n: number): void;
  handleMessage(msg: Record<string, unknown>): void;
}

export function setupLogViewerWebview(target: LogViewerSetupTarget, webviewView: vscode.WebviewView): void {
  const extUri = target.getExtensionUri();
  const audioUri = vscode.Uri.joinPath(extUri, 'audio');
  const codiconsUri = vscode.Uri.joinPath(extUri, 'media', 'codicons');
  webviewView.webview.options = { enableScripts: true, localResourceRoots: [audioUri, codiconsUri] };
  const audioWebviewUri = webviewView.webview.asWebviewUri(audioUri).toString();
  const codiconCssUri = webviewView.webview.asWebviewUri(vscode.Uri.joinPath(codiconsUri, 'codicon.css')).toString();
  const cfg = getConfig();
  const viewerMaxLines = getEffectiveViewerLines(cfg.maxLines, cfg.viewerMaxLines ?? 0);
  webviewView.webview.html = buildViewerHtml({
    nonce: getNonce(),
    extensionUri: audioWebviewUri,
    version: target.getVersion(),
    cspSource: webviewView.webview.cspSource,
    codiconCssUri,
    viewerMaxLines,
    viewerRepeatThresholds: cfg.viewerRepeatThresholds,
    viewerDbInsightsEnabled: cfg.viewerDbInsightsEnabled,
    viewerSqlPatternChipMinCount: cfg.viewerSqlPatternChipMinCount,
    viewerSqlPatternMaxChips: cfg.viewerSqlPatternMaxChips,
  });
  webviewView.webview.onDidReceiveMessage((msg: Record<string, unknown>) => target.handleMessage(msg));
  target.startBatchTimer();
  queueMicrotask(() => helpers.sendCachedConfig(target.getCachedPresets(), target.getCachedHighlightRules(), (msg) => target.postMessage(msg), target.getContext().workspaceState.get<string>("saropaLogCapture.lastUsedPresetName")));
  queueMicrotask(() => target.sendIntegrationsAdapters(getConfig().integrationsAdapters));
  queueMicrotask(() => target.postMessage({ type: 'setDriftAdvisorAvailable', available: !!vscode.extensions.getExtension(DRIFT_ADVISOR_EXTENSION_ID) }));
  queueMicrotask(() => target.postMessage({ type: 'captureEnabled', enabled: getConfig().enabled }));
  queueMicrotask(() => target.postMessage({ type: 'minimapShowSqlDensity', show: getConfig().minimapShowSqlDensity }));
  queueMicrotask(() => target.postMessage({
    type: 'setViewerRepeatThresholds',
    thresholds: getConfig().viewerRepeatThresholds,
  }));
  queueMicrotask(() => target.postMessage({
    type: 'setViewerDbInsightsEnabled',
    enabled: getConfig().viewerDbInsightsEnabled,
  }));
  queueMicrotask(() => target.postMessage({
    type: 'setViewerSqlPatternChipSettings',
    chipMinCount: getConfig().viewerSqlPatternChipMinCount,
    chipMaxChips: getConfig().viewerSqlPatternMaxChips,
  }));
  queueMicrotask(() => target.postMessage({ type: 'setViewerKeybindings', keyToAction: getViewerKeybindingsFromConfig() }));
  const pending = target.getPendingLoadUri();
  if (pending) { queueMicrotask(() => { void target.loadFromFile(pending); }); }
  webviewView.onDidChangeVisibility(() => {
    if (webviewView.visible) {
      target.setVisibleView(webviewView);
      target.setUnreadWatchHits(0);
      helpers.updateBadge(webviewView, target.getUnreadWatchHits());
    }
  });
  webviewView.onDidDispose(() => {
    target.removeView(webviewView);
  });
}

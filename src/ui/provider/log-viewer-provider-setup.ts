/**
 * Webview setup for LogViewerProvider. Extracted to keep log-viewer-provider.ts under the line limit.
 */

import * as vscode from "vscode";
import { getNonce, buildViewerHtml, getEffectiveViewerLines } from "./viewer-content";
import { getConfig, viewerDbDetectorTogglesFromConfig, errorRateConfigFromConfig } from "../../modules/config/config";
import { DRIFT_ADVISOR_EXTENSION_ID } from "./drift-advisor-integration";
import * as helpers from "./viewer-provider-helpers";
import { getViewerKeybindingsFromConfig } from "../viewer/viewer-keybindings";
import { getLearningWebviewOptions } from "../../modules/learning/learning-webview-options";
import { getRootCauseHintViewerStrings } from "../../modules/root-cause-hints/root-cause-hint-l10n-host";
import { mergeIntegrationAdaptersForWebview } from "../../modules/integrations/integration-adapter-constants";

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
  onBecameVisible(): void;
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
    viewerPreserveAsciiBoxArt: cfg.viewerPreserveAsciiBoxArt,
    viewerGroupAsciiArt: cfg.viewerGroupAsciiArt,
    viewerDetectAsciiArt: cfg.viewerDetectAsciiArt,
    viewerRepeatThresholds: cfg.viewerRepeatThresholds,
    viewerDbSignalsEnabled: cfg.viewerDbSignalsEnabled,
    staticSqlFromFingerprintEnabled: cfg.staticSqlFromFingerprintEnabled,
    viewerDbDetectorToggles: viewerDbDetectorTogglesFromConfig(cfg),
    viewerSlowBurstThresholds: cfg.viewerSlowBurstThresholds,
    signalSlowOpThresholdMs: cfg.signalSlowOpThresholdMs,
  });
  webviewView.webview.onDidReceiveMessage((msg: Record<string, unknown>) => target.handleMessage(msg));
  target.startBatchTimer();
  queueMicrotask(() => helpers.sendCachedConfig(target.getCachedPresets(), target.getCachedHighlightRules(), (msg) => target.postMessage(msg), target.getContext().workspaceState.get<string>("saropaLogCapture.lastUsedPresetName")));
  queueMicrotask(() => {
    const c = getConfig();
    const aiOn = vscode.workspace.getConfiguration("saropaLogCapture.ai").get<boolean>("enabled", false);
    target.sendIntegrationsAdapters(mergeIntegrationAdaptersForWebview(c.integrationsAdapters, aiOn));
  });
  queueMicrotask(() => target.postMessage({ type: 'setDriftAdvisorAvailable', available: !!vscode.extensions.getExtension(DRIFT_ADVISOR_EXTENSION_ID) }));
  queueMicrotask(() => target.postMessage({ type: 'captureEnabled', enabled: getConfig().enabled }));
  queueMicrotask(() => target.postMessage({ type: 'minimapShowSqlDensity', show: getConfig().minimapShowSqlDensity }));
  queueMicrotask(() => target.postMessage({ type: 'minimapProportionalLines', show: getConfig().minimapProportionalLines }));
  queueMicrotask(() => target.postMessage({ type: 'minimapViewportRedOutline', show: getConfig().minimapViewportRedOutline }));
  queueMicrotask(() => target.postMessage({ type: 'minimapViewportOutsideArrow', show: getConfig().minimapViewportOutsideArrow }));
  queueMicrotask(() => target.postMessage({
    type: 'setViewerRepeatThresholds',
    thresholds: getConfig().viewerRepeatThresholds,
  }));
  queueMicrotask(() => target.postMessage({
    type: 'setViewerDbInsightsEnabled',
    enabled: getConfig().viewerDbSignalsEnabled,
  }));
  queueMicrotask(() => target.postMessage({
    type: 'setStaticSqlFromFingerprintEnabled',
    enabled: getConfig().staticSqlFromFingerprintEnabled,
  }));
  queueMicrotask(() => target.postMessage({
    type: 'setViewerSlowBurstThresholds',
    thresholds: getConfig().viewerSlowBurstThresholds,
  }));
  queueMicrotask(() => target.postMessage({
    type: 'setViewerDbDetectorToggles',
    ...viewerDbDetectorTogglesFromConfig(getConfig()),
  }));

  queueMicrotask(() => {
    const erCfg = errorRateConfigFromConfig(getConfig());
    target.postMessage({ type: 'setErrorRateConfig', bucketSize: erCfg.bucketSize, showWarnings: erCfg.showWarnings, detectSpikes: erCfg.detectSpikes });
  });
  queueMicrotask(() => target.postMessage({ type: 'setViewerKeybindings', keyToAction: getViewerKeybindingsFromConfig() }));
  queueMicrotask(() => target.postMessage(getLearningWebviewOptions()));
  queueMicrotask(() => target.postMessage({ type: 'setRootCauseHintL10n', strings: getRootCauseHintViewerStrings() }));
  queueMicrotask(() => {
    const c = getConfig();
    target.postMessage({
      type: 'errorClassificationSettings',
      suppressTransientErrors: c.suppressTransientErrors,
      breakOnCritical: c.breakOnCritical,
      levelDetection: c.levelDetection,
      stderrTreatAsError: c.stderrTreatAsError,
      severityKeywords: c.severityKeywords,
    });
  });
  const pending = target.getPendingLoadUri();
  if (pending) { queueMicrotask(() => { void target.loadFromFile(pending); }); }
  else if (webviewView.visible) { queueMicrotask(() => target.onBecameVisible()); }
  webviewView.onDidChangeVisibility(() => {
    if (webviewView.visible) {
      target.setVisibleView(webviewView);
      target.setUnreadWatchHits(0);
      helpers.updateBadge(webviewView, target.getUnreadWatchHits());
      target.onBecameVisible();
    }
  });
  webviewView.onDidDispose(() => {
    target.removeView(webviewView);
  });
}

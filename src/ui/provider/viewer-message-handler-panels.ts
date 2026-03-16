/**
 * Panel and settings message handlers extracted from viewer-message-handler.ts
 * to keep the main handler under the line limit.
 */

import * as vscode from "vscode";
import * as panelHandlers from '../shared/viewer-panel-handlers';
import { loadAndPostAboutContent } from "../viewer-panels/about-content-loader";

/** Clamp numeric param to safe integer range for line/part indices (0 .. 10M). */
const MAX_SAFE_INDEX = 10_000_000;
export function safeLineIndex(v: unknown, fallback: number): number {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > MAX_SAFE_INDEX) { return fallback; }
  return Math.floor(n);
}

interface PanelMessageContext {
    readonly currentFileUri: vscode.Uri | undefined;
    readonly context: vscode.ExtensionContext;
    readonly extensionVersion?: string;
    readonly post: (msg: unknown) => void;
}

/**
 * Handle panel-related messages (crashlytics, performance, settings, about).
 * Returns true if the message was handled.
 */
export function dispatchPanelMessage(msg: Record<string, unknown>, ctx: PanelMessageContext): boolean {
    switch (msg.type) {
      case "scriptError":
        ((msg.errors as { message: string }[]) ?? []).forEach(e => console.warn("[SLC Webview]", e.message));
        return true;
      case "requestCrashlyticsData": case "crashlyticsCheckAgain": panelHandlers.handleCrashlyticsRequest(ctx.post).catch(() => {}); return true;
      case "fetchCrashDetail": panelHandlers.handleCrashDetail(String(msg.issueId ?? ''), ctx.post).catch(() => {}); return true;
      case "crashlyticsCloseIssue": case "crashlyticsMuteIssue": panelHandlers.handleCrashlyticsAction(String(msg.issueId ?? ''), msg.type === "crashlyticsCloseIssue" ? 'CLOSED' : 'MUTED', ctx.post).catch(() => {}); return true;
      case "crashlyticsRunGcloudAuth": panelHandlers.handleGcloudAuth(ctx.post); return true;
      case "crashlyticsBrowseGoogleServices": panelHandlers.handleBrowseGoogleServices(ctx.post).catch(() => {}); return true;
      case "crashlyticsOpenGoogleServicesJson": panelHandlers.handleOpenGoogleServicesJson().catch(() => {}); return true;
      case "openGcloudInstall": panelHandlers.handleOpenGcloudInstall(); return true;
      case "crashlyticsShowOutput": panelHandlers.handleCrashlyticsShowOutput(); return true;
      case "crashlyticsPanelOpened": panelHandlers.startCrashlyticsAutoRefresh(ctx.post); return true;
      case "crashlyticsPanelClosed": panelHandlers.stopCrashlyticsAutoRefresh(); return true;
      case "requestRecurringErrors": panelHandlers.handleRecurringRequest(ctx.post).catch(() => {}); return true;
      case "requestPerformanceData": panelHandlers.handlePerformanceRequest(ctx.post, ctx.currentFileUri).catch(() => {}); return true;
      case "setRecurringErrorStatus": panelHandlers.handleSetErrorStatus(String(msg.hash ?? ''), String(msg.status ?? 'open'), ctx.post).catch(() => {}); return true;
      case "openInsights": vscode.commands.executeCommand('saropaLogCapture.showInsights'); return true;
      case "exportInsightsSummary": vscode.commands.executeCommand('saropaLogCapture.exportInsightsSummary'); return true;
      case "requestAboutContent":
        void loadAndPostAboutContent(ctx.context.extensionUri, ctx.extensionVersion, ctx.context.extension.id, ctx.post);
        return true;
      case "resetAllSettings":
        void vscode.commands.executeCommand('saropaLogCapture.resetAllSettings');
        return true;
      case "setCaptureEnabled": {
        const cfg = vscode.workspace.getConfiguration('saropaLogCapture');
        const enabled = msg.enabled === true;
        void cfg.update('enabled', enabled, vscode.ConfigurationTarget.Workspace).then(() => {
          ctx.post({ type: 'captureEnabled', enabled });
        });
        return true;
      }
      case "setIntegrationsAdapters": {
        const raw = msg.adapterIds;
        const adapterIds = Array.isArray(raw)
          ? (raw as unknown[]).filter((x): x is string => typeof x === 'string')
          : [];
        const cfg = vscode.workspace.getConfiguration('saropaLogCapture');
        void cfg.update('integrations.adapters', adapterIds, vscode.ConfigurationTarget.Workspace)
          .then(() => {
            ctx.post({ type: 'integrationsAdapters', adapterIds });
            void import('../../modules/integrations/integration-prep.js').then((m) => m.runIntegrationPrepCheck(adapterIds));
          });
        return true;
      }
      case "showIntegrationContext":
        panelHandlers.handleIntegrationContextRequest(
          ctx.currentFileUri,
          safeLineIndex(msg.lineIndex, 0),
          msg.timestamp as number | undefined,
          ctx.post,
        ).catch(() => {});
        return true;
      case "openFullIntegrationContext":
        panelHandlers.handleIntegrationContextDocument(
          ctx.currentFileUri,
          safeLineIndex(msg.lineIndex, 0),
        ).catch(() => {});
        return true;
      default:
        return false;
    }
}

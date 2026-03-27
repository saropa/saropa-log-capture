/**
 * Panel and settings message handlers extracted from viewer-message-handler.ts
 * to keep the main handler under the line limit.
 */

import * as vscode from "vscode";
import {
  EXPLAIN_WITH_AI_ADAPTER_ID,
  mergeIntegrationAdaptersForWebview,
  stripUiOnlyIntegrationAdapterIds,
} from "../../modules/integrations/integration-adapter-constants";
import { DRIFT_ADVISOR_EXTENSION_ID, DRIFT_ADVISOR_OPEN_COMMAND } from "./drift-advisor-integration";
import * as panelHandlers from '../shared/viewer-panel-handlers';
import { loadAndPostAboutContent } from "../viewer-panels/about-content-loader";
import { handleErrorHoverRequest } from '../shared/handlers/error-hover-handler';
import { showAnalysis } from '../analysis/analysis-panel';
import { handleCodeQualityForFrameRequest } from '../shared/handlers/code-quality-handlers';
import { fetchDriftViewerHealth } from '../../modules/integrations/drift-viewer-health';

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
      case "requestInsightData": panelHandlers.handleInsightDataRequest(ctx.post, ctx.currentFileUri).catch(() => {}); return true;
      case "requestPerformanceData": panelHandlers.handlePerformanceRequest(ctx.post, ctx.currentFileUri).catch(() => {}); return true;
      case "setRecurringErrorStatus": panelHandlers.handleSetErrorStatus(String(msg.hash ?? ''), String(msg.status ?? 'open'), ctx.post).catch(() => {}); return true;
      case "openInsights": ctx.post({ type: 'openInsight', tab: 'recurring' }); return true;
      case "addInsightItemToCase":
        vscode.commands.executeCommand('saropaLogCapture.addInsightItemToCase', msg.payload);
        return true;
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
        const aiEnabled = adapterIds.includes(EXPLAIN_WITH_AI_ADAPTER_ID);
        const sessionOnly = stripUiOnlyIntegrationAdapterIds(adapterIds);
        const cfg = vscode.workspace.getConfiguration('saropaLogCapture');
        const aiCfg = vscode.workspace.getConfiguration('saropaLogCapture.ai');
        void Promise.all([
          cfg.update('integrations.adapters', sessionOnly, vscode.ConfigurationTarget.Workspace),
          aiCfg.update('enabled', aiEnabled, vscode.ConfigurationTarget.Workspace),
        ]).then(() => {
          const merged = mergeIntegrationAdaptersForWebview(sessionOnly, aiEnabled);
          ctx.post({ type: 'integrationsAdapters', adapterIds: merged });
          ctx.post({ type: 'setDriftAdvisorAvailable', available: !!vscode.extensions.getExtension(DRIFT_ADVISOR_EXTENSION_ID) });
          void import('../../modules/integrations/integration-prep.js').then((m) => m.runIntegrationPrepCheck(sessionOnly));
        });
        return true;
      }
      case "showIntegrationContext":
        panelHandlers.handleIntegrationContextRequest(
          ctx.currentFileUri,
          safeLineIndex(msg.lineIndex, 0),
          ctx.post,
          {
            timestamp: msg.timestamp as number | undefined,
            hasDatabaseLine: msg.hasDatabaseLine === true,
            lineText: typeof msg.lineText === 'string' ? msg.lineText : undefined,
          },
        ).catch(() => {});
        return true;
      case "openFullIntegrationContext":
        panelHandlers.handleIntegrationContextDocument(
          ctx.currentFileUri,
          safeLineIndex(msg.lineIndex, 0),
        ).catch(() => {});
        return true;
      case "requestErrorHoverData":
        handleErrorHoverRequest(String(msg.text ?? ''), safeLineIndex(msg.lineIndex, 0), ctx.post).catch(() => {});
        return true;
      case "openErrorAnalysis":
        showAnalysis(String(msg.text ?? ''), safeLineIndex(msg.lineIndex, 0), ctx.currentFileUri).catch(() => {});
        return true;
      case "showCodeQualityForFrame":
        handleCodeQualityForFrameRequest(
          ctx.currentFileUri,
          safeLineIndex(msg.lineIndex, 0),
          String(msg.lineText ?? msg.text ?? ''),
          ctx.post,
        ).catch(() => {});
        return true;
      case "openQualityReport":
        void vscode.commands.executeCommand('saropaLogCapture.openQualityReport');
        return true;
      case "openDriftAdvisor":
        void vscode.commands.executeCommand(DRIFT_ADVISOR_OPEN_COMMAND).then(undefined, () => {});
        return true;
      case "checkDriftViewerHealth": {
        const baseUrl = String((msg as { baseUrl?: unknown }).baseUrl ?? "").trim();
        if (!baseUrl || !/^https?:\/\//i.test(baseUrl)) {
          return true;
        }
        void fetchDriftViewerHealth(baseUrl).then((r) => {
          ctx.post({
            type: "driftViewerHealth",
            baseUrl,
            ok: r.ok,
            version: r.version,
            error: r.error,
          });
        });
        return true;
      }
      case "showRelatedQueries":
        panelHandlers.handleRelatedQueriesRequest(
          ctx.currentFileUri,
          safeLineIndex(msg.lineIndex, 0),
          ctx.post,
          {
            timestamp: msg.timestamp as number | undefined,
            lineText: typeof msg.lineText === 'string' ? msg.lineText : undefined,
          },
        ).catch(() => {});
        return true;
      default:
        return false;
    }
}

/**
 * Panel and settings message handlers extracted from viewer-message-handler.ts
 * to keep the main handler under the line limit.
 */

import * as vscode from "vscode";
import {
  ADB_LOGCAT_ADAPTER_ID,
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
import { handleGitHistoryForLine } from '../shared/handlers/git-history-handler';
import { handleProjectStateRequest } from '../shared/handlers/project-state-handler';
import { handleChangelogSinceForVersion } from '../shared/handlers/changelog-since-handler';
import { fetchDriftViewerHealth } from '../../modules/integrations/drift-viewer-health';
import { fetchDriftDbIssues } from '../../modules/integrations/drift-advisor-issues-fetch';
import { getDriftLintViolations } from '../../modules/misc/drift-lint-violations';
import { getSuiteDeepLinkAvailability, runSiblingDeepLink } from '../../modules/diagnostics/suite-deeplink';
import { readSuiteMirrorsForPanel } from '../../modules/diagnostics/suite-mirror-read';
import { buildSuiteSuggestions } from '../../modules/diagnostics/suite-suggestions-html';
import { logExtensionError } from '../../modules/misc/extension-logger';

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
        ((msg.errors as { message: string; source?: string; line?: number; col?: number; stack?: string }[]) ?? []).forEach(e => {
          const loc = e.line ? ` (line ${e.line}, col ${e.col ?? 0})` : '';
          logExtensionError('Webview', `${e.message}${loc}`);
          if (e.stack) { logExtensionError('Webview', `Stack: ${e.stack}`); }
        });
        return true;
      case "requestCrashlyticsData": panelHandlers.handleCrashlyticsRequest(ctx.post).catch(() => {}); return true;
      case "crashlyticsCheckAgain": panelHandlers.handleCrashlyticsRequest(ctx.post, true).catch(() => {}); return true;
      case "crashlyticsValidate": panelHandlers.handleCrashlyticsValidate(ctx.post).catch(() => {}); return true;
      case "fetchCrashlyticsDetail": panelHandlers.handleCrashlyticsDetail(String(msg.issueId ?? ''), (msg.meta as Record<string, unknown>) ?? {}, ctx.post, String(msg.consoleUrl ?? '')).catch(() => {}); return true;
      case "fetchCrashlyticsFilterIndex": panelHandlers.handleCrashlyticsFilterIndex(ctx.post).catch(() => {}); return true;
      case "fetchCrashlyticsTrends": panelHandlers.handleCrashlyticsTrends(ctx.post).catch(() => {}); return true;
      case "crashlyticsArchiveIssue": panelHandlers.handleCrashlyticsArchive(String(msg.issueId ?? ''), String(msg.title ?? ''), msg.archived === true, ctx.post).catch(() => {}); return true;
      case "crashlyticsOpenFrame": panelHandlers.openCrashFrame(String(msg.file ?? ''), Number(msg.line ?? 0)).catch(() => {}); return true;
      case "crashlyticsCreateIssue": panelHandlers.handleCrashlyticsCreateIssue(String(msg.title ?? 'Issue'), String(msg.body ?? '')).catch(() => {}); return true;
      case "crashlyticsOpenLogLine": panelHandlers.openLogLine(String(msg.uri ?? ''), Number(msg.line ?? 0), Number(msg.col ?? 0)).catch(() => {}); return true;
      case "crashlyticsRunGcloudAuth": panelHandlers.handleGcloudAuth(ctx.post); return true;
      case "crashlyticsBrowseGoogleServices": panelHandlers.handleBrowseGoogleServices(ctx.post).catch(() => {}); return true;
      case "crashlyticsOpenGoogleServicesJson": panelHandlers.handleOpenGoogleServicesJson().catch(() => {}); return true;
      case "openGcloudInstall": panelHandlers.handleOpenGcloudInstall(); return true;
      case "crashlyticsShowOutput": panelHandlers.handleCrashlyticsShowOutput(); return true;
      case "crashlyticsPanelOpened": panelHandlers.startCrashlyticsAutoRefresh(ctx.post); return true;
      case "crashlyticsPanelClosed": panelHandlers.stopCrashlyticsAutoRefresh(); return true;
      case "requestSignalData": panelHandlers.handleSignalDataRequest(ctx.post, ctx.currentFileUri).catch(() => {}); return true;
      case "openTroubleDetail":
        panelHandlers.handleTroubleDetail(
          ctx.currentFileUri,
          safeLineIndex(msg.sourceLineNo, 0),
          typeof msg.plainText === 'string' ? msg.plainText : '',
          typeof msg.level === 'string' ? msg.level : 'info',
          ctx.post,
        ).catch(() => {});
        return true;
      case "copyTroubleReport":
        panelHandlers.handleCopyTroubleReport(
          ctx.currentFileUri,
          safeLineIndex(msg.sourceLineNo, 0),
          typeof msg.plainText === 'string' ? msg.plainText : '',
          typeof msg.level === 'string' ? msg.level : 'info',
        ).catch(() => {});
        return true;
      case "requestPerformanceData": panelHandlers.handlePerformanceRequest(ctx.post, ctx.currentFileUri).catch(() => {}); return true;
      case "setRecurringErrorStatus": panelHandlers.handleSetErrorStatus(String(msg.hash ?? ''), String(msg.status ?? 'open'), ctx.post, ctx.currentFileUri).catch(() => {}); return true;
      /* Fu4 (plan 052): Mute-with-reason. Distinct from setRecurringErrorStatus because it prompts
         for a free-text reason via InputBox, then mutes AND feeds the reason into the existing
         noise-learning system as a labeled training example. Cancel from the prompt aborts the mute. */
      case "muteSignalWithReason": panelHandlers.handleMuteSignalWithReason(String(msg.hash ?? ''), String(msg.label ?? ''), ctx.post, ctx.currentFileUri).catch(() => {}); return true;
      /* Plan 053-A: filter-suggestion accept/reject. Accept updates workspace exclusions and
         marks the suggestion accepted; reject only marks the suggestion rejected. Both re-send
         signalData so the panel re-renders without the now-actioned row. */
      case "acceptFilterSuggestion": panelHandlers.handleAcceptFilterSuggestion(String(msg.id ?? ''), String(msg.pattern ?? ''), ctx.post, ctx.currentFileUri).catch(() => {}); return true;
      case "rejectFilterSuggestion": panelHandlers.handleRejectFilterSuggestion(String(msg.id ?? ''), ctx.post, ctx.currentFileUri).catch(() => {}); return true;
      case "openSignals": ctx.post({ type: 'openSignalPanel', tab: 'recurring' }); return true;
      case "addSignalItemToCollection":
        vscode.commands.executeCommand('saropaLogCapture.addSignalItemToCollection', msg.payload);
        return true;
      case "exportSignalsSummary": vscode.commands.executeCommand('saropaLogCapture.exportSignalsSummary'); return true;
      case "requestProjectStateData":
        handleProjectStateRequest(ctx.post).catch(() => {});
        return true;
      case "requestAboutContent":
        void loadAndPostAboutContent(ctx.context, ctx.extensionVersion, ctx.post);
        return true;
      case "resetAllSettings":
        void vscode.commands.executeCommand('saropaLogCapture.resetAllSettings');
        return true;
      case "openSeverityKeywordsSettings":
        void vscode.commands.executeCommand('workbench.action.openSettings', 'saropaLogCapture.severityKeywords');
        return true;
      case "setCaptureEnabled": {
        const cfg = vscode.workspace.getConfiguration('saropaLogCapture');
        const enabled = msg.enabled === true;
        void cfg.update('enabled', enabled, vscode.ConfigurationTarget.Workspace).then(() => {
          ctx.post({ type: 'captureEnabled', enabled });
        });
        return true;
      }
      case "setDiagnosticCapture": {
        // Per-line fate trace (plan 102) — write to Workspace so the running session picks it up;
        // echo back so the Options checkbox reflects the persisted value.
        const cfg = vscode.workspace.getConfiguration('saropaLogCapture');
        const enabled = msg.enabled === true;
        void cfg.update('diagnosticCapture', enabled, vscode.ConfigurationTarget.Workspace).then(() => {
          ctx.post({ type: 'diagnosticCapture', enabled });
        });
        return true;
      }
      case "setIntegrationsAdapters": {
        const raw = msg.adapterIds;
        const adapterIds = Array.isArray(raw)
          ? (raw as unknown[]).filter((x): x is string => typeof x === 'string')
          : [];
        const aiEnabled = adapterIds.includes(EXPLAIN_WITH_AI_ADAPTER_ID);
        // adbLogcat's checkbox binds to its own boolean, not the adapters array — route it there and
        // keep it out of the persisted session-adapter list (see integration-adapter-constants).
        const adbLogcatEnabled = adapterIds.includes(ADB_LOGCAT_ADAPTER_ID);
        const cfg = vscode.workspace.getConfiguration('saropaLogCapture');
        // The checkbox controls integrations.adbLogcat.enabled, not array membership. But a power user
        // can hand-add 'adbLogcat' to integrations.adapters to force logcat on a NON-Dart session; that
        // explicit entry must survive a UI toggle of any OTHER checkbox. Preserve it while the box stays
        // on; a genuine uncheck (adbLogcatEnabled false) drops it AND sets enabled false, which is the
        // authoritative off.
        const currentAdapters = cfg.get<string[]>('integrations.adapters', []);
        const adbWasExplicit = Array.isArray(currentAdapters) && currentAdapters.includes(ADB_LOGCAT_ADAPTER_ID);
        let sessionOnly = stripUiOnlyIntegrationAdapterIds(adapterIds).filter((id) => id !== ADB_LOGCAT_ADAPTER_ID);
        if (adbLogcatEnabled && adbWasExplicit) { sessionOnly = [...sessionOnly, ADB_LOGCAT_ADAPTER_ID]; }
        const aiCfg = vscode.workspace.getConfiguration('saropaLogCapture.ai');
        void Promise.all([
          cfg.update('integrations.adapters', sessionOnly, vscode.ConfigurationTarget.Workspace),
          cfg.update('integrations.adbLogcat.enabled', adbLogcatEnabled, vscode.ConfigurationTarget.Workspace),
          aiCfg.update('enabled', aiEnabled, vscode.ConfigurationTarget.Workspace),
        ]).then(() => {
          const merged = mergeIntegrationAdaptersForWebview(sessionOnly, aiEnabled, adbLogcatEnabled);
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
      case "showGitHistoryForLine":
        handleGitHistoryForLine(
          safeLineIndex(msg.lineIndex, 0),
          String(msg.lineText ?? msg.text ?? ''),
          ctx.post,
        ).catch(() => {});
        return true;
      case "showChangelogSince":
        handleChangelogSinceForVersion(
          safeLineIndex(msg.lineIndex, 0),
          String(msg.version ?? ''),
          ctx.post,
        ).catch(() => {});
        return true;
      case "openQualityReport":
        void vscode.commands.executeCommand('saropaLogCapture.openQualityReport');
        return true;
      case "openLintRule":
        // Open VS Code settings filtered to the lint rule name so the user can
        // find the saropa_lints rule configuration and documentation
        void vscode.commands.executeCommand('workbench.action.openSettings', String(msg.rule ?? ''));
        return true;
      case "openDriftAdvisor":
        void vscode.commands.executeCommand(DRIFT_ADVISOR_OPEN_COMMAND).then(undefined, () => {});
        return true;
      case "requestSuiteDeepLinkAvailability":
        // R5: tell the SQL panel which sibling deep-link buttons are safe to show (never a dead action).
        void getSuiteDeepLinkAvailability().then((a) => ctx.post({ type: "suiteDeepLinkAvailability", ...a }));
        return true;
      case "runSiblingDeepLink":
        // R5: a SQL/diagnostic row button asked to jump into Drift Advisor / Saropa Lints. The id is
        // allowlisted inside runSiblingDeepLink; args are the documented payload for that command.
        void runSiblingDeepLink(String(msg.command ?? ''), msg.args);
        return true;
      case "requestSuiteMirrorDiagnostics":
        // R2 render: typed Diagnostic[] from the sibling offline mirrors, used as the fallback source
        // for the panel's Database / Static-code sections when their live source is unavailable.
        void readSuiteMirrorsForPanel().then((m) =>
          ctx.post({ type: "suiteMirrorDiagnostics", advisor: m.advisor, lints: m.lints }));
        return true;
      case "requestSuiteSuggestions": {
        // Integrations screen + icon-bar badge: the suggested-integrations block (detected from the
        // project's packages). The Options screen is a configuration surface, so companion-tool
        // diagnostics are deliberately NOT rendered here (owner ruling 2026-07-09) — those belong to
        // the tools' own UIs and the signal report's ecosystem section.
        void buildSuiteSuggestions().then((suggestions) =>
          ctx.post({
            type: "suiteSuggestions",
            count: suggestions.count,
            suggestionsHtml: suggestions.html,
          }));
        return true;
      }
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
      case "fetchDriftDbIssues": {
        // DB_18 Phase 2: SQL History dashboard asks for the Drift server's merged issues list
        // (index suggestions + anomalies). Best-effort — an unreachable server posts ok=false.
        const baseUrl = String((msg as { baseUrl?: unknown }).baseUrl ?? "").trim();
        if (!baseUrl || !/^https?:\/\//i.test(baseUrl)) {
          return true;
        }
        void fetchDriftDbIssues(baseUrl).then((r) => {
          ctx.post({ type: "driftDbIssues", baseUrl, ok: r.ok, issues: r.issues, error: r.error });
        });
        return true;
      }
      case "fetchDriftLintViolations": {
        // DB_18 Phase 3: Drift static-code rule findings from Saropa Lints (source-level), plus the
        // "Drift pack is off" signal when the project uses Drift but has no Drift-rule findings.
        const wsRoot = vscode.workspace.workspaceFolders?.[0]?.uri;
        if (!wsRoot) {
          return true;
        }
        const usesDrift = !!(msg as { usesDrift?: unknown }).usesDrift;
        void getDriftLintViolations(wsRoot, usesDrift)
          .then((r) => {
            ctx.post({
              type: "driftLintViolations",
              hasExport: r.hasExport,
              violations: r.violations,
              suggestEnablePack: r.suggestEnablePack,
              tier: r.tier,
            });
          })
          // Signal failure so the panel can show its lint error state instead of a spinner that never
          // resolves — without this catch a thrown scan left the "Checking…" line up indefinitely.
          .catch((e: unknown) => {
            ctx.post({
              type: "driftLintViolations",
              error: e instanceof Error ? e.message : String(e),
            });
          });
        return true;
      }
      case "enableDriftLintPack": {
        // Open a terminal pre-filled with the documented CLI; sendText(false) types it WITHOUT running
        // so the user reviews before it mutates analysis_options.yaml. No surprise file changes.
        const term = vscode.window.createTerminal("Saropa Lints");
        term.show();
        term.sendText("dart run saropa_lints:init --tier recommended --enable-pack drift", false);
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
      case "showRelatedRequests":
        panelHandlers.handleRelatedRequestsRequest(
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

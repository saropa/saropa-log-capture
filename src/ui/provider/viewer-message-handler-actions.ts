/**
 * Viewer message handlers for copy, settings, keybindings, search, edit, session, etc.
 * Extracted to keep viewer-message-handler.ts under the line limit.
 *
 * Structure: dispatchViewerActionMessage delegates to two switch-based handlers
 * (handleCopyAndSettingsActions, handleSessionAndUiActions) to keep per-function
 * cognitive complexity and case count within Sonar limits. Message string fields
 * are read via msgStr() to avoid object stringification ([object Object]). Async
 * side effects use .then(undefined, () => {}) instead of void for Sonar compliance.
 *
 * Clipboard: `copyToClipboard` uses clipTextFromMsg() so non-string webview payloads do not
 * become silent empty writes; empty text surfaces a warning; success/error use status bar / dialog.
 */

import * as vscode from "vscode";
import { t } from "../../l10n";
import * as helpers from "./viewer-provider-helpers";
import { showBugReport } from '../panels/bug-report-panel';
import { safeLineIndex } from './viewer-message-handler-panels';
import { createBugReportFile } from '../../modules/bug-report/report-file-writer';
import { buildAIContext } from '../../modules/ai/ai-context-builder';
import { explainError } from '../../modules/ai/ai-explain';
import { showAIExplanationPanel } from '../panels/ai-explain-panel';
import { setViewerKeybinding, getViewerKeybindingsFromConfig, getViewerActionLabel } from '../viewer/viewer-keybindings';
import type { ViewerMessageContext } from './viewer-message-types';
import { runFindStaticSourcesForSqlFingerprint } from './viewer-message-handler-static-sql';
import { getAiEnabledConfigurationTarget } from '../../modules/ai/ai-enable-scope';
import { showAiExplainRunFailure } from '../../modules/ai/ai-explain-ui';
import { SAROPA_BOOL_SETTING_BY_MSG_TYPE } from "./viewer-workspace-bool-message-map";
import { handleSessionAndUiActions } from './viewer-message-handler-session-ui';
import { dispatchRootCauseMessage } from './viewer-message-handler-root-cause';

export { SAROPA_BOOL_SETTING_BY_MSG_TYPE };
export { getLastSignalBundle, getLastSignalHypotheses } from './viewer-message-handler-root-cause';

/** Coerce message field to string; never stringify objects (avoids '[object Object]'). */
function msgStr(m: Record<string, unknown>, key: string, fallback = ""): string {
  const v = m[key];
  return typeof v === "string" ? v : fallback;
}

/** Clipboard payload from webview: accept only primitives as text (structured clone edge cases). */
function clipTextFromMsg(m: Record<string, unknown>): string {
  const v = m.text;
  if (typeof v === "string") { return v; }
  if (v === null || v === undefined) { return ""; }
  if (typeof v === "number" || typeof v === "boolean") { return String(v); }
  return "";
}

function applyAddAutoHidePattern(msg: Record<string, unknown>): void {
  const pattern = msgStr(msg, "pattern").trim();
  if (!pattern) { return; }
  const cfg = vscode.workspace.getConfiguration("saropaLogCapture");
  const current = cfg.get<string[]>("autoHidePatterns") ?? [];
  if (!current.some(p => p.toLowerCase() === pattern.toLowerCase())) {
    cfg.update("autoHidePatterns", [...current, pattern], vscode.ConfigurationTarget.Workspace).then(undefined, () => {});
  }
}

function applyRemoveAutoHidePattern(msg: Record<string, unknown>): void {
  const pattern = msgStr(msg, "pattern").trim();
  if (!pattern) { return; }
  const cfg = vscode.workspace.getConfiguration("saropaLogCapture");
  const current = cfg.get<string[]>("autoHidePatterns") ?? [];
  const lower = pattern.toLowerCase();
  const updated = current.filter(p => p.toLowerCase() !== lower);
  if (updated.length !== current.length) {
    cfg.update("autoHidePatterns", updated, vscode.ConfigurationTarget.Workspace).then(undefined, () => {});
  }
}

function runCopyWithSource(msg: Record<string, unknown>): void {
  const text = clipTextFromMsg(msg).trim();
  const rawRefs = msg.sourceRefs;
  const sourceRefs = Array.isArray(rawRefs)
    ? (rawRefs as unknown[]).map((r) => {
        const o = r as Record<string, unknown>;
        return { path: msgStr(o, "path"), line: Number(o.line) || 1 };
      }).filter((r) => r.path.length > 0)
    : [];
  helpers.buildCopyWithSource(text, sourceRefs)
    .then((out) => { vscode.env.clipboard.writeText(out).then(undefined, () => {}); })
    .catch(() => { vscode.env.clipboard.writeText(text || "").then(undefined, () => {}); });
}

function runExplainWithAi(msg: Record<string, unknown>, ctx: ViewerMessageContext): void {
  const uri = ctx.currentFileUri;
  const text = msgStr(msg, "text").trim();
  const lineIdx = safeLineIndex(msg.lineIndex, 0);
  if (!uri || !text) { return; }
  const aiCfg = vscode.workspace.getConfiguration("saropaLogCapture.ai");
  if (!aiCfg.get<boolean>("enabled", false)) {
    const enableLabel = t("action.enable");
    vscode.window.showInformationMessage(t("msg.aiExplainDisabled"), enableLabel).then(async (choice) => {
      if (choice === enableLabel) {
        await aiCfg.update("enabled", true, getAiEnabledConfigurationTarget());
        runExplainWithAi(msg, ctx);
      }
    }, () => {});
    return;
  }
  vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: t("msg.aiExplainProgress"), cancellable: false },
    async () => {
      let builtContext: Awaited<ReturnType<typeof buildAIContext>> | undefined;
      try {
        const contextLines = Math.max(0, Math.min(50, aiCfg.get<number>("contextLines", 10)));
        const lineTimestampMs = typeof msg.timestamp === "number" ? msg.timestamp : undefined;
        const includeIntegrationData = aiCfg.get<boolean>("includeIntegrationData", true);
        const cacheExplanations = aiCfg.get<boolean>("cacheExplanations", true);
        const lineEndIndex = typeof msg.lineEndIndex === "number" && msg.lineEndIndex >= lineIdx ? msg.lineEndIndex : undefined;
        builtContext = await buildAIContext(uri, lineIdx, text, { contextLines, lineTimestampMs, includeIntegrationData, lineEndIndex });
        const result = await explainError(builtContext, { useCache: cacheExplanations });
        const explanation = result.explanation;
        const suffix = result.cached ? t("panel.aiExplainCached") : "";
        const toShow = (explanation.length > 500 ? explanation.slice(0, 497) + "…" : explanation) + suffix;
        const choice = await vscode.window.showInformationMessage(toShow, "Copy", "Show details");
        if (choice === "Copy") { vscode.env.clipboard.writeText(explanation).then(undefined, () => {}); }
        if (choice === "Show details") { showAIExplanationPanel(builtContext, result); }
      } catch (err) {
        if (builtContext) {
          await showAiExplainRunFailure(builtContext, err);
        } else {
          const message = err instanceof Error ? err.message : String(err);
          vscode.window.showErrorMessage(t("msg.aiExplainError", message)).then(undefined, () => {});
        }
      }
    },
  );
}

function runCreateReportFile(msg: Record<string, unknown>, ctx: ViewerMessageContext): void {
  if (!ctx.currentFileUri) { return; }
  createBugReportFile({
    selectedText: msgStr(msg, "selectedText"),
    selectedLineStart: safeLineIndex(msg.selectedLineStart, 0),
    selectedLineEnd: safeLineIndex(msg.selectedLineEnd, 0),
    sessionInfo: (msg.sessionInfo as Record<string, string>) ?? {},
    fullDecoratedOutput: msgStr(msg, "fullDecoratedOutput"),
    fullOutputLineCount: typeof msg.fullOutputLineCount === "number" ? msg.fullOutputLineCount : 0,
    fileUri: ctx.currentFileUri,
    errorText: msgStr(msg, "text"),
    lineIndex: safeLineIndex(msg.lineIndex, 0),
    extensionContext: ctx.context,
  }).catch(() => {});
}

function handleCopyAndSettingsActions(type: string, msg: Record<string, unknown>, ctx: ViewerMessageContext): boolean {
  switch (type) {
    case "insertMarker": ctx.onMarkerRequest?.(); return true;
    case "togglePause": ctx.onTogglePause?.(); return true;
    case "copyToClipboard": {
      const text = clipTextFromMsg(msg);
      if (text.length === 0) {
        vscode.window.showWarningMessage(t("msg.logCopyEmpty")).then(undefined, () => {});
        return true;
      }
      void vscode.env.clipboard.writeText(text).then(
        () => { vscode.window.setStatusBarMessage(t("msg.logCopyStatus", text.length), 2500); },
        (err) => {
          const detail = err instanceof Error ? err.message : String(err);
          vscode.window.showErrorMessage(t("msg.logCopyFailed", detail)).then(undefined, () => {});
        },
      );
      return true;
    }
    case "copyAllFiltered": {
      const text = clipTextFromMsg(msg);
      const lineCount = typeof msg.lineCount === "number" ? msg.lineCount : 0;
      if (text.length === 0 || lineCount === 0) {
        vscode.window.showWarningMessage(t("msg.logCopyEmpty")).then(undefined, () => {});
        return true;
      }
      void vscode.env.clipboard.writeText(text).then(
        () => { vscode.window.showInformationMessage(t("msg.logCopyAllFiltered", lineCount)).then(undefined, () => {}); },
        (err) => {
          const detail = err instanceof Error ? err.message : String(err);
          vscode.window.showErrorMessage(t("msg.logCopyFailed", detail)).then(undefined, () => {});
        },
      );
      return true;
    }
    case "copyWithSource": runCopyWithSource(msg); return true;
    case "presetApplied":
      if (msg.name) { ctx.context.workspaceState.update("saropaLogCapture.lastUsedPresetName", msgStr(msg, "name")).then(undefined, () => {}); }
      return true;
    case "copySourcePath":
      helpers.copySourcePath(msgStr(msg, "path"), msgStr(msg, "mode", "relative"));
      return true;
    case "exclusionAdded":
    case "addToExclusion": {
      const pat = msgStr(msg, "pattern") || msgStr(msg, "text");
      ctx.onExclusionAdded?.(pat);
      return true;
    }
    case "exclusionRemoved": ctx.onExclusionRemoved?.(msgStr(msg, "pattern")); return true;
    case "addAutoHidePattern": applyAddAutoHidePattern(msg); return true;
    case "removeAutoHidePattern": applyRemoveAutoHidePattern(msg); return true;
    case "openSettings": vscode.commands.executeCommand("workbench.action.openSettings", msgStr(msg, "setting")).then(undefined, () => {}); return true;
    case "openKeybindings":
      vscode.commands.executeCommand("workbench.action.openGlobalKeybindings", msgStr(msg, "search", "Saropa Log Capture")).then(undefined, () => {});
      return true;
    case "startRecordViewerKey": {
      const actionId = msgStr(msg, "actionId");
      ctx.post({ type: 'viewerKeybindingRecordMode', active: true, actionId });
      const label = getViewerActionLabel(actionId);
      vscode.window.setStatusBarMessage(`Saropa: Press a key for ${label} (Escape to cancel)`, 5000);
      return true;
    }
    case "viewerKeybindingRecordCancelled":
      ctx.post({ type: 'viewerKeybindingRecordMode', active: false });
      return true;
    case "viewerKeybindingRecorded": {
      const actionId = msgStr(msg, "actionId");
      const key = msgStr(msg, "key").trim();
      if (actionId && key) {
        setViewerKeybinding(actionId, key).then(() => {
          const keyToAction = getViewerKeybindingsFromConfig();
          ctx.post({ type: 'setViewerKeybindings', keyToAction });
          ctx.post({ type: 'viewerKeybindingRecordMode', active: false });
        }).catch(() => {
          ctx.post({ type: 'viewerKeybindingRecordMode', active: false });
        });
      } else {
        ctx.post({ type: 'viewerKeybindingRecordMode', active: false });
      }
      return true;
    }
    case "searchCodebase": ctx.onSearchCodebase?.(msgStr(msg, "text")); return true;
    case "searchSessions": ctx.onSearchSessions?.(msgStr(msg, "text")); return true;
    case "analyzeLine": ctx.onAnalyzeLine?.(msgStr(msg, "text"), safeLineIndex(msg.lineIndex, -1), ctx.currentFileUri); return true;
    case "generateReport":
      if (ctx.currentFileUri) { showBugReport(msgStr(msg, "text"), safeLineIndex(msg.lineIndex, 0), ctx.currentFileUri, ctx.context).catch(() => {}); }
      return true;
    case "createReportFile": runCreateReportFile(msg, ctx); return true;
    case "explainWithAi": runExplainWithAi(msg, ctx); return true;
    case "findStaticSourcesForSqlFingerprint":
      void runFindStaticSourcesForSqlFingerprint(msgStr(msg, "fingerprint"));
      return true;
    default:
      return false;
  }
}


/**
 * Handle action messages (copy, settings, keybindings, search, edit, session, etc.).
 * Returns true if the message was handled.
 */
export function dispatchViewerActionMessage(msg: Record<string, unknown>, ctx: ViewerMessageContext): boolean {
  const type = msg.type as string;
  if (dispatchRootCauseMessage(type, msg, ctx)) { return true; }
  if (handleCopyAndSettingsActions(type, msg, ctx)) { return true; }
  if (handleSessionAndUiActions(type, msg, ctx)) { return true; }
  return false;
}

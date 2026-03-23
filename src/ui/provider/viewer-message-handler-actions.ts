/**
 * Viewer message handlers for copy, settings, keybindings, search, edit, session, etc.
 * Extracted to keep viewer-message-handler.ts under the line limit.
 *
 * Structure: dispatchViewerActionMessage delegates to two switch-based handlers
 * (handleCopyAndSettingsActions, handleSessionAndUiActions) to keep per-function
 * cognitive complexity and case count within Sonar limits. Message string fields
 * are read via msgStr() to avoid object stringification ([object Object]). Async
 * side effects use .then(undefined, () => {}) instead of void for Sonar compliance.
 */

import * as vscode from "vscode";
import { t } from "../../l10n";
import * as helpers from "./viewer-provider-helpers";
import { showBugReport } from '../panels/bug-report-panel';
import { safeLineIndex } from './viewer-message-handler-panels';
import { createBugReportFile } from '../../modules/bug-report/report-file-writer';
import type { SessionDisplayOptions } from '../session/session-display';
import { logExtensionWarn } from '../../modules/misc/extension-logger';
import { buildAIContext } from '../../modules/ai/ai-context-builder';
import { explainError } from '../../modules/ai/ai-explain';
import { showAIExplanationPanel } from '../panels/ai-explain-panel';
import { setViewerKeybinding, getViewerKeybindingsFromConfig, getViewerActionLabel } from '../viewer/viewer-keybindings';
import type { ViewerMessageContext } from './viewer-message-types';
import { getInteractionTracker } from '../../modules/learning/learning-runtime';
import { runExplainRootCauseHypotheses } from './viewer-message-handler-root-cause-ai';
import { runFindStaticSourcesForSqlFingerprint } from './viewer-message-handler-static-sql';

function isAllowedExternalUrl(url: string): boolean {
  const trimmed = url.trim();
  if (trimmed.length === 0 || trimmed.length > 2048) { return false; }
  return /^https?:\/\//i.test(trimmed) || /^vscode:\/\//i.test(trimmed);
}

/** Coerce message field to string; never stringify objects (avoids '[object Object]'). */
function msgStr(m: Record<string, unknown>, key: string, fallback = ""): string {
  const v = m[key];
  return typeof v === "string" ? v : fallback;
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
  const text = msgStr(msg, "text").trim();
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
    vscode.window.showInformationMessage(t("msg.aiExplainDisabled")).then(undefined, () => {});
    return;
  }
  vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: t("msg.aiExplainProgress"), cancellable: false },
    async () => {
      try {
        const contextLines = Math.max(0, Math.min(50, aiCfg.get<number>("contextLines", 10)));
        const lineTimestampMs = typeof msg.timestamp === "number" ? msg.timestamp : undefined;
        const includeIntegrationData = aiCfg.get<boolean>("includeIntegrationData", true);
        const cacheExplanations = aiCfg.get<boolean>("cacheExplanations", true);
        const lineEndIndex = typeof msg.lineEndIndex === "number" && msg.lineEndIndex >= lineIdx ? msg.lineEndIndex : undefined;
        const context = await buildAIContext(uri, lineIdx, text, { contextLines, lineTimestampMs, includeIntegrationData, lineEndIndex });
        const result = await explainError(context, { useCache: cacheExplanations });
        const explanation = result.explanation;
        const suffix = result.cached ? t("panel.aiExplainCached") : "";
        const toShow = (explanation.length > 500 ? explanation.slice(0, 497) + "…" : explanation) + suffix;
        const choice = await vscode.window.showInformationMessage(toShow, "Copy", "Show details");
        if (choice === "Copy") { vscode.env.clipboard.writeText(explanation).then(undefined, () => {}); }
        if (choice === "Show details") { showAIExplanationPanel(context, result); }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(t("msg.aiExplainError", message)).then(undefined, () => {});
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
    case "copyToClipboard": vscode.env.clipboard.writeText(msgStr(msg, "text")); return true;
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
    case "explainRootCauseHypotheses": runExplainRootCauseHypotheses(msg, ctx); return true;
    case "explainRootCauseHypothesesEmpty":
      vscode.window.showInformationMessage(t("msg.explainRootCauseHypothesesEmpty")).then(undefined, () => {});
      return true;
    case "findStaticSourcesForSqlFingerprint":
      void runFindStaticSourcesForSqlFingerprint(msgStr(msg, "fingerprint"));
      return true;
    default:
      return false;
  }
}

function runOpenUrl(msg: Record<string, unknown>): void {
  const url = msgStr(msg, "url");
  if (isAllowedExternalUrl(url)) {
    vscode.env.openExternal(vscode.Uri.parse(url)).then(undefined, () => {});
  } else {
    logExtensionWarn('viewerMessage', 'openUrl rejected: invalid or disallowed scheme');
  }
}

function runSessionAction(msg: Record<string, unknown>, ctx: ViewerMessageContext): void {
  const uriStrings = Array.isArray(msg.uriStrings) ? (msg.uriStrings as string[]) : [msgStr(msg, "uriString")];
  const filenames = Array.isArray(msg.filenames) ? (msg.filenames as string[]) : [msgStr(msg, "filename")];
  ctx.onSessionAction?.(msgStr(msg, "action"), uriStrings, filenames);
}

function handleSessionAndUiActions(type: string, msg: Record<string, unknown>, ctx: ViewerMessageContext): boolean {
  switch (type) {
    case "addToWatch": ctx.onAddToWatch?.(msgStr(msg, "text")); return true;
    case "promptAnnotation":
      ctx.onAnnotationPrompt?.(safeLineIndex(msg.lineIndex, 0), msgStr(msg, "current"));
      return true;
    case "addBookmark": {
      const bm = msgStr(msg, "text").trim();
      if (bm) {
        getInteractionTracker()?.track({ type: "explicit-keep", lineText: bm, lineLevel: "" });
      }
      ctx.onAddBookmark?.(safeLineIndex(msg.lineIndex, 0), msgStr(msg, "text"), ctx.currentFileUri);
      return true;
    }
    case "linkClicked":
      ctx.onLinkClick?.(msgStr(msg, "path"), Number(msg.line ?? 1), Number(msg.col ?? 1), Boolean(msg.splitEditor));
      return true;
    case "openUrl": runOpenUrl(msg); return true;
    case "navigatePart": ctx.onPartNavigate?.(Math.max(1, safeLineIndex(msg.part, 1))); return true;
    case "navigateSession": { const d = Number(msg.direction); ctx.onSessionNavigate?.(d < 0 ? -1 : 1); return true; }
    case "savePresetRequest":
      ctx.onSavePresetRequest?.((msg.filters as Record<string, unknown>) ?? {});
      return true;
    case "setCaptureAll":
      vscode.workspace.getConfiguration("saropaLogCapture")
        .update("captureAll", Boolean(msg.value), vscode.ConfigurationTarget.Workspace);
      return true;
    case "setMinimapSqlDensity":
      vscode.workspace.getConfiguration("saropaLogCapture")
        .update("minimapShowSqlDensity", Boolean(msg.value), vscode.ConfigurationTarget.Workspace);
      return true;
    case "editLine":
      helpers.handleEditLine(ctx.currentFileUri, ctx.isSessionActive, {
        lineIndex: safeLineIndex(msg.lineIndex, 0), newText: msgStr(msg, "newText"),
        timestamp: Number(msg.timestamp ?? 0), loadFromFile: ctx.load,
      }).catch((err: Error) => { vscode.window.showErrorMessage(t('msg.failedEditLine', err.message)); });
      return true;
    case "exportLogs":
      helpers.handleExportLogs(msgStr(msg, "text"), (msg.options as Record<string, unknown>) ?? {})
        .catch((err: Error) => { vscode.window.showErrorMessage(t('msg.failedExportLogs', err.message)); });
      return true;
    case "saveLevelFilters":
      helpers.saveLevelFilters(ctx.context, msgStr(msg, "filename"), (msg.levels as string[]) ?? []);
      return true;
    case "requestFindInFiles":
      ctx.onFindInFiles?.(msgStr(msg, "query"), { caseSensitive: msg.caseSensitive, wholeWord: msg.wholeWord, useRegex: msg.useRegex });
      return true;
    case "openFindResult":
      ctx.onOpenFindResult?.(msgStr(msg, "uriString"), msgStr(msg, "query"), { caseSensitive: msg.caseSensitive, wholeWord: msg.wholeWord, useRegex: msg.useRegex });
      return true;
    case "findNavigateMatch":
      ctx.onFindNavigateMatch?.(msgStr(msg, "uriString"), safeLineIndex(msg.matchIndex, 0));
      return true;
    case "requestBookmarks": case "deleteBookmark": case "deleteFileBookmarks": case "deleteAllBookmarks": case "editBookmarkNote": case "openBookmark": ctx.onBookmarkAction?.(msg); return true;
    case "requestSessionList": ctx.onSessionListRequest?.(); return true;
    case "runCommand":
      vscode.commands.executeCommand(msgStr(msg, "command"), ...(Array.isArray(msg.args) ? msg.args : [])).then(undefined, () => {});
      return true;
    case "browseSessionRoot": ctx.onBrowseSessionRoot?.()?.then(undefined, () => {}); return true;
    case "clearSessionRoot": ctx.onClearSessionRoot?.()?.then(undefined, () => {}); return true;
    case "openSessionFromPanel": ctx.onOpenSessionFromPanel?.(msgStr(msg, "uriString")); return true;
    case "sessionAction": runSessionAction(msg, ctx); return true;
    case "popOutViewer": ctx.onPopOutRequest?.(); return true;
    case "openInsightTab": ctx.onOpenInsightTabRequest?.(); return true;
    case "revealLogFile":
      if (ctx.currentFileUri && ctx.onRevealLogFile) { Promise.resolve(ctx.onRevealLogFile(ctx.currentFileUri.toString())).catch(() => {}); }
      return true;
    // Hold-to-copy path: show status bar confirmation so users get visible feedback.
    case "copyCurrentFilePath":
      if (ctx.currentFileUri) {
        vscode.env.clipboard.writeText(ctx.currentFileUri.fsPath).then(
          () => { vscode.window.setStatusBarMessage(t('msg.filePathCopied'), 2000); },
          () => {},
        );
      }
      return true;
    // Reveal current file in OS so the containing folder opens (not the parent folder).
    case "openCurrentFileFolder":
      if (ctx.currentFileUri) {
        vscode.commands.executeCommand('revealFileInOS', ctx.currentFileUri).then(() => {}, () => {});
      }
      return true;
    case "setSessionDisplayOptions": ctx.onDisplayOptionsChange?.((msg.options as SessionDisplayOptions)); return true;
    case "promptGoToLine":
      vscode.window.showInputBox({
          prompt: t('prompt.goToLine'),
          validateInput: (v) => /^\d+$/.test(v) ? null : t('prompt.goToLineValidate'),
        })
        .then((v) => { if (v) { ctx.post({ type: "scrollToLine", line: Number.parseInt(v, 10) }); } });
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
  if (handleCopyAndSettingsActions(type, msg, ctx)) { return true; }
  if (handleSessionAndUiActions(type, msg, ctx)) { return true; }
  return false;
}

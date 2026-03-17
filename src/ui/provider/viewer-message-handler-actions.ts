/**
 * Viewer message handlers for copy, settings, keybindings, search, edit, session, etc.
 * Extracted to keep viewer-message-handler.ts under the line limit.
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

function isAllowedExternalUrl(url: string): boolean {
  const trimmed = url.trim();
  if (trimmed.length === 0 || trimmed.length > 2048) { return false; }
  return /^https?:\/\//i.test(trimmed) || /^vscode:\/\//i.test(trimmed);
}

/**
 * Handle action messages (copy, settings, keybindings, search, edit, session, etc.).
 * Returns true if the message was handled.
 */
export function dispatchViewerActionMessage(msg: Record<string, unknown>, ctx: ViewerMessageContext): boolean {
  const type = msg.type as string;
  switch (type) {
    case "insertMarker": ctx.onMarkerRequest?.(); return true;
    case "togglePause": ctx.onTogglePause?.(); return true;
    case "copyToClipboard": vscode.env.clipboard.writeText(String(msg.text ?? "")); return true;
    case "copyWithSource": {
      const text = String(msg.text ?? "").trim();
      const rawRefs = msg.sourceRefs;
      const sourceRefs = Array.isArray(rawRefs)
        ? (rawRefs as unknown[]).map((r) => {
            const o = r as Record<string, unknown>;
            return { path: String(o.path ?? ""), line: Number(o.line) || 1 };
          }).filter((r) => r.path.length > 0)
        : [];
      void helpers.buildCopyWithSource(text, sourceRefs)
        .then((out) => { void vscode.env.clipboard.writeText(out); })
        .catch(() => { void vscode.env.clipboard.writeText(text || ""); });
      return true;
    }
    case "presetApplied":
      if (msg.name) { void ctx.context.workspaceState.update("saropaLogCapture.lastUsedPresetName", String(msg.name)); }
      return true;
    case "copySourcePath":
      helpers.copySourcePath(String(msg.path ?? ""), String(msg.mode ?? "relative"));
      return true;
    case "exclusionAdded": case "addToExclusion": ctx.onExclusionAdded?.(String(msg.pattern ?? msg.text ?? "")); return true;
    case "exclusionRemoved": ctx.onExclusionRemoved?.(String(msg.pattern ?? "")); return true;
    case "addAutoHidePattern": {
      const pattern = String(msg.pattern ?? "").trim();
      if (pattern) {
        const cfg = vscode.workspace.getConfiguration("saropaLogCapture");
        const current = cfg.get<string[]>("autoHidePatterns") ?? [];
        if (!current.some(p => p.toLowerCase() === pattern.toLowerCase())) {
          void cfg.update("autoHidePatterns", [...current, pattern], vscode.ConfigurationTarget.Workspace);
        }
      }
      return true;
    }
    case "removeAutoHidePattern": {
      const pattern = String(msg.pattern ?? "").trim();
      if (pattern) {
        const cfg = vscode.workspace.getConfiguration("saropaLogCapture");
        const current = cfg.get<string[]>("autoHidePatterns") ?? [];
        const lower = pattern.toLowerCase();
        const updated = current.filter(p => p.toLowerCase() !== lower);
        if (updated.length !== current.length) {
          void cfg.update("autoHidePatterns", updated, vscode.ConfigurationTarget.Workspace);
        }
      }
      return true;
    }
    case "openSettings": void vscode.commands.executeCommand("workbench.action.openSettings", String(msg.setting ?? "")); return true;
    case "openKeybindings":
      void vscode.commands.executeCommand("workbench.action.openGlobalKeybindings", String(msg.search ?? "Saropa Log Capture"));
      return true;
    case "startRecordViewerKey": {
      const actionId = String(msg.actionId ?? '');
      ctx.post({ type: 'viewerKeybindingRecordMode', active: true, actionId });
      const label = getViewerActionLabel(actionId);
      void vscode.window.setStatusBarMessage(`Saropa: Press a key for ${label} (Escape to cancel)`, 5000);
      return true;
    }
    case "viewerKeybindingRecordCancelled":
      ctx.post({ type: 'viewerKeybindingRecordMode', active: false });
      return true;
    case "viewerKeybindingRecorded": {
      const actionId = String(msg.actionId ?? '');
      const key = String(msg.key ?? '').trim();
      if (actionId && key) {
        void setViewerKeybinding(actionId, key).then(() => {
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
    case "searchCodebase": ctx.onSearchCodebase?.(String(msg.text ?? "")); return true;
    case "searchSessions": ctx.onSearchSessions?.(String(msg.text ?? "")); return true;
    case "analyzeLine": ctx.onAnalyzeLine?.(String(msg.text ?? ""), safeLineIndex(msg.lineIndex, -1), ctx.currentFileUri); return true;
    case "generateReport":
      if (ctx.currentFileUri) { showBugReport(String(msg.text ?? ""), safeLineIndex(msg.lineIndex, 0), ctx.currentFileUri, ctx.context).catch(() => {}); }
      return true;
    case "createReportFile":
      if (ctx.currentFileUri) {
        createBugReportFile({
          selectedText: String(msg.selectedText ?? ""),
          selectedLineStart: safeLineIndex(msg.selectedLineStart, 0),
          selectedLineEnd: safeLineIndex(msg.selectedLineEnd, 0),
          sessionInfo: (msg.sessionInfo as Record<string, string>) ?? {},
          fullDecoratedOutput: String(msg.fullDecoratedOutput ?? ""),
          fullOutputLineCount: typeof msg.fullOutputLineCount === "number" ? msg.fullOutputLineCount : 0,
          fileUri: ctx.currentFileUri,
          errorText: String(msg.text ?? ""),
          lineIndex: safeLineIndex(msg.lineIndex, 0),
          extensionContext: ctx.context,
        }).catch(() => {});
      }
      return true;
    case "explainWithAi": {
      const uri = ctx.currentFileUri;
      const text = String(msg.text ?? "").trim();
      const lineIdx = safeLineIndex(msg.lineIndex, 0);
      if (!uri || !text) { return true; }
      const aiCfg = vscode.workspace.getConfiguration("saropaLogCapture.ai");
      if (!aiCfg.get<boolean>("enabled", false)) {
        void vscode.window.showInformationMessage(t("msg.aiExplainDisabled"));
        return true;
      }
      void vscode.window.withProgress(
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
            if (choice === "Copy") { void vscode.env.clipboard.writeText(explanation); }
            if (choice === "Show details") { showAIExplanationPanel(context, result); }
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            void vscode.window.showErrorMessage(t("msg.aiExplainError", message));
          }
        },
      );
      return true;
    }
    case "addToWatch": ctx.onAddToWatch?.(String(msg.text ?? "")); return true;
    case "promptAnnotation":
      ctx.onAnnotationPrompt?.(safeLineIndex(msg.lineIndex, 0), String(msg.current ?? ""));
      return true;
    case "addBookmark": ctx.onAddBookmark?.(safeLineIndex(msg.lineIndex, 0), String(msg.text ?? ""), ctx.currentFileUri); return true;
    case "linkClicked":
      ctx.onLinkClick?.(String(msg.path ?? ""), Number(msg.line ?? 1), Number(msg.col ?? 1), Boolean(msg.splitEditor));
      return true;
    case "openUrl": {
      const url = String(msg.url ?? "");
      if (isAllowedExternalUrl(url)) {
        vscode.env.openExternal(vscode.Uri.parse(url)).then(undefined, () => {});
      } else {
        logExtensionWarn('viewerMessage', 'openUrl rejected: invalid or disallowed scheme');
      }
      return true;
    }
    case "navigatePart": ctx.onPartNavigate?.(Math.max(1, safeLineIndex(msg.part, 1))); return true;
    case "navigateSession": { const d = Number(msg.direction); ctx.onSessionNavigate?.(d < 0 ? -1 : 1); return true; }
    case "savePresetRequest":
      ctx.onSavePresetRequest?.((msg.filters as Record<string, unknown>) ?? {});
      return true;
    case "setCaptureAll":
      vscode.workspace.getConfiguration("saropaLogCapture")
        .update("captureAll", Boolean(msg.value), vscode.ConfigurationTarget.Workspace);
      return true;
    case "editLine":
      helpers.handleEditLine(ctx.currentFileUri, ctx.isSessionActive, {
        lineIndex: safeLineIndex(msg.lineIndex, 0), newText: String(msg.newText ?? ""),
        timestamp: Number(msg.timestamp ?? 0), loadFromFile: ctx.load,
      }).catch((err: Error) => { vscode.window.showErrorMessage(t('msg.failedEditLine', err.message)); });
      return true;
    case "exportLogs":
      helpers.handleExportLogs(String(msg.text ?? ""), (msg.options as Record<string, unknown>) ?? {})
        .catch((err: Error) => { vscode.window.showErrorMessage(t('msg.failedExportLogs', err.message)); });
      return true;
    case "saveLevelFilters":
      helpers.saveLevelFilters(ctx.context, String(msg.filename ?? ""), (msg.levels as string[]) ?? []);
      return true;
    case "requestFindInFiles":
      ctx.onFindInFiles?.(String(msg.query ?? ""), { caseSensitive: msg.caseSensitive, wholeWord: msg.wholeWord, useRegex: msg.useRegex });
      return true;
    case "openFindResult":
      ctx.onOpenFindResult?.(String(msg.uriString ?? ""), String(msg.query ?? ""), { caseSensitive: msg.caseSensitive, wholeWord: msg.wholeWord, useRegex: msg.useRegex });
      return true;
    case "findNavigateMatch":
      ctx.onFindNavigateMatch?.(String(msg.uriString ?? ""), safeLineIndex(msg.matchIndex, 0));
      return true;
    case "requestBookmarks": case "deleteBookmark": case "deleteFileBookmarks": case "deleteAllBookmarks": case "editBookmarkNote": case "openBookmark": ctx.onBookmarkAction?.(msg); return true;
    case "requestSessionList": ctx.onSessionListRequest?.(); return true;
    case "runCommand":
      void vscode.commands.executeCommand(String(msg.command ?? ""), ...(Array.isArray(msg.args) ? msg.args : []));
      return true;
    case "browseSessionRoot": void ctx.onBrowseSessionRoot?.(); return true;
    case "clearSessionRoot": void ctx.onClearSessionRoot?.(); return true;
    case "openSessionFromPanel": ctx.onOpenSessionFromPanel?.(String(msg.uriString ?? "")); return true;
    case "sessionAction": {
      const uriStrings = Array.isArray(msg.uriStrings) ? (msg.uriStrings as string[]) : [String(msg.uriString ?? "")];
      const filenames = Array.isArray(msg.filenames) ? (msg.filenames as string[]) : [String(msg.filename ?? "")];
      ctx.onSessionAction?.(String(msg.action ?? ""), uriStrings, filenames);
      return true;
    }
    case "popOutViewer": ctx.onPopOutRequest?.(); return true;
    case "revealLogFile":
      if (ctx.currentFileUri && ctx.onRevealLogFile) { Promise.resolve(ctx.onRevealLogFile(ctx.currentFileUri.toString())).catch(() => {}); }
      return true;
    case "copyCurrentFilePath":
      if (ctx.currentFileUri) { vscode.env.clipboard.writeText(ctx.currentFileUri.fsPath).then(() => {}, () => {}); }
      return true;
    case "openCurrentFileFolder":
      if (ctx.currentFileUri) {
        const parentUri = vscode.Uri.joinPath(ctx.currentFileUri, '..');
        vscode.commands.executeCommand('revealFileInOS', parentUri).then(() => {}, () => {});
      }
      return true;
    case "setSessionDisplayOptions": ctx.onDisplayOptionsChange?.((msg.options as SessionDisplayOptions)); return true;
    case "promptGoToLine":
      vscode.window.showInputBox({
          prompt: t('prompt.goToLine'),
          validateInput: (v) => /^\d+$/.test(v) ? null : t('prompt.goToLineValidate'),
        })
        .then((v) => { if (v) { ctx.post({ type: "scrollToLine", line: parseInt(v, 10) }); } });
      return true;
    default:
      return false;
  }
}

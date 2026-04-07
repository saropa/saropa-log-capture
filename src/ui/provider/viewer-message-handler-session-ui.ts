/**
 * Session and UI message handlers for the viewer.
 * Handles workspace toggles, navigation, editing, export, bookmarks, session panel, etc.
 * Extracted from viewer-message-handler-actions.ts to keep files under the line limit.
 */

import * as vscode from "vscode";
import { t } from "../../l10n";
import * as helpers from "./viewer-provider-helpers";
import { safeLineIndex } from './viewer-message-handler-panels';
import type { SessionDisplayOptions } from '../session/session-display';
import { logExtensionWarn } from '../../modules/misc/extension-logger';
import type { ViewerMessageContext } from './viewer-message-types';
import { handleQuickExportLogs } from './viewer-quick-export';
import { getInteractionTracker } from '../../modules/learning/learning-runtime';
import { SAROPA_BOOL_SETTING_BY_MSG_TYPE } from "./viewer-workspace-bool-message-map";

/** Coerce message field to string; never stringify objects (avoids '[object Object]'). */
function msgStr(m: Record<string, unknown>, key: string, fallback = ""): string {
  const v = m[key];
  return typeof v === "string" ? v : fallback;
}

function runOpenUrl(msg: Record<string, unknown>): void {
  const url = msgStr(msg, "url");
  if (isAllowedExternalUrl(url)) {
    vscode.env.openExternal(vscode.Uri.parse(url)).then(undefined, () => {});
  } else {
    logExtensionWarn('viewerMessage', 'openUrl rejected: invalid or disallowed scheme');
  }
}

function isAllowedExternalUrl(url: string): boolean {
  const trimmed = url.trim();
  if (trimmed.length === 0 || trimmed.length > 2048) { return false; }
  return /^https?:\/\//i.test(trimmed) || /^vscode:\/\//i.test(trimmed);
}

function runSessionAction(msg: Record<string, unknown>, ctx: ViewerMessageContext): void {
  const uriStrings = Array.isArray(msg.uriStrings) ? (msg.uriStrings as string[]) : [msgStr(msg, "uriString")];
  const filenames = Array.isArray(msg.filenames) ? (msg.filenames as string[]) : [msgStr(msg, "filename")];
  ctx.onSessionAction?.(msgStr(msg, "action"), uriStrings, filenames);
}

/**
 * Handle session and UI action messages (workspace toggles, navigation, editing, export, bookmarks, etc.).
 * Returns true if the message was handled.
 */
export function handleSessionAndUiActions(type: string, msg: Record<string, unknown>, ctx: ViewerMessageContext): boolean {
  const boolKey = SAROPA_BOOL_SETTING_BY_MSG_TYPE[type];
  if (boolKey) {
    vscode.workspace.getConfiguration("saropaLogCapture")
      .update(boolKey, Boolean(msg.value), vscode.ConfigurationTarget.Workspace);
    return true;
  }
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
    case "setMinimapWidth": {
      const w = msgStr(msg, "value");
      const allowed = new Set(["xsmall", "small", "medium", "large", "xlarge"]);
      if (!allowed.has(w)) { return true; }
      vscode.workspace.getConfiguration("saropaLogCapture")
        .update("minimapWidth", w, vscode.ConfigurationTarget.Workspace);
      return true;
    }
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
    case "quickExportLogs":
      handleQuickExportLogs(
        Array.isArray(msg.lines) ? (msg.lines as string[]) : [],
        (msg.metadata ?? {}) as unknown as Parameters<typeof handleQuickExportLogs>[1],
      ).catch((err: Error) => { vscode.window.showErrorMessage(t('msg.failedExportLogs', err.message)); });
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
    case "openSidecarFile": {
      const sidecar = msgStr(msg, "filename");
      if (sidecar && ctx.currentFileUri && !sidecar.includes('/') && !sidecar.includes('\\')) {
        vscode.window.showTextDocument(vscode.Uri.joinPath(ctx.currentFileUri, '..', sidecar), { preview: true, viewColumn: vscode.ViewColumn.Beside }).then(undefined, () => {});
      }
      return true;
    }
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

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
import { showKeyboardShortcutsPanel } from '../panels/keyboard-shortcuts-panel';
import { handleOpenSessionForSignalType } from '../shared/handlers/recurring-handlers';
import { SAROPA_BOOL_SETTING_BY_MSG_TYPE } from "./viewer-workspace-bool-message-map";
import { handleLogFileAction } from "./viewer-log-file-actions";

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

/* Reveal an arbitrary absolute path (from the session header — e.g. main.dart,
   cwd) in the OS file explorer. Validates the path before invoking the
   built-in 'revealFileInOS' command so a hostile webview payload cannot
   coerce a path traversal. */
function runRevealPath(msg: Record<string, unknown>): void {
  const path = msgStr(msg, "path").trim();
  if (path.length === 0 || path.length > 2048) {
    logExtensionWarn('viewerMessage', 'revealPath rejected: empty or too long');
    return;
  }
  vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(path)).then(undefined, () => {});
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
  /* Minimap drag-to-resize: persist custom pixel width to workspace state */
  if (type === "setMinimapCustomPx") {
    const px = typeof msg.value === "number" ? msg.value : 0;
    ctx.context.workspaceState.update("saropaLogCapture.minimapCustomPx", px > 0 ? px : undefined)
      .then(undefined, () => {});
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
    case "revealPath": runRevealPath(msg); return true;
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
    case "exportSessionListJson": ctx.onExportSessionListJson?.()?.then(undefined, () => {}); return true;
    case "openSessionFromPanel": ctx.onOpenSessionFromPanel?.(msgStr(msg, "uriString")); return true;
    case "sqlHistoryCrossLogJump": {
      /* DB_17: SQL History panel row jump where the fingerprint's first occurrence is in
         a sidebar log other than the active one. Load that log first (if needed), then
         post `scrollToLine` so the webview scrolls to the persisted physical line index. */
      const targetUri = msgStr(msg, "uriString");
      const lineRaw = msg.line;
      const line = typeof lineRaw === "number" && isFinite(lineRaw) ? Math.max(0, Math.floor(lineRaw)) : 0;
      if (!targetUri) { return true; }
      (async () => {
        const currentUri = ctx.currentFileUri?.toString();
        if (targetUri !== currentUri) {
          await Promise.resolve(ctx.onOpenSessionFromPanel?.(targetUri));
        }
        /* Webview line numbers are 1-based; persisted firstOccurrenceLine is 0-based. */
        ctx.post({ type: 'scrollToLine', line: line + 1 });
      })().catch(() => {});
      return true;
    }
    case "openSessionForSignalType": {
      /* Resolve to a specific session (fingerprint preferred), then ask the webview to scroll to
         the matching line. If the resolved session is already loaded we skip the load and post
         scrollToSignal directly — otherwise the user would see no visible feedback. */
      const fingerprint = msgStr(msg, "fingerprint");
      const label = msgStr(msg, "label");
      const detail = msgStr(msg, "detail");
      const signalType = msgStr(msg, "signalType");
      handleOpenSessionForSignalType(signalType, fingerprint || undefined).then(async uri => {
        if (!uri) { return; }
        const currentUri = ctx.currentFileUri?.toString();
        if (uri !== currentUri) {
          /* onOpenSessionFromPanel is typed `void` but the activation handler returns Promise<void>.
             Wrap in Promise.resolve so we wait for the load to settle before posting the scroll. */
          await Promise.resolve(ctx.onOpenSessionFromPanel?.(uri));
        }
        ctx.post({ type: 'scrollToSignal', fingerprint, label, detail });
      }).catch(() => {});
      return true;
    }
    case "sessionAction": runSessionAction(msg, ctx); return true;
    case "popOutViewer": ctx.onPopOutRequest?.(); return true;
    case "openSignalTab": ctx.onOpenSignalTabRequest?.(); return true;
    case "revealLogFile":
      if (ctx.currentFileUri && ctx.onRevealLogFile) { Promise.resolve(ctx.onRevealLogFile(ctx.currentFileUri.toString())).catch(() => {}); }
      return true;
    case "openLogFileInEditor":
    case "openLogFileBeside":
    case "openCurrentFileFolder":
    case "revealLogFileInExplorer":
    case "openLogFileFolderInTerminal":
    case "copyCurrentFilePath":
    case "copyCurrentFileName":
    case "copyCurrentFileRelativePath":
      /* All log-file modal actions: centralized to avoid silent no-ops when
         currentFileUri is unset, and to give visible toast feedback on copy. */
      return handleLogFileAction(type, ctx);
    case "showKeyboardShortcuts":
      showKeyboardShortcutsPanel();
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

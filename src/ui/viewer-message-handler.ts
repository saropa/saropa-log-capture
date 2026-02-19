/** Dispatches incoming webview messages for the log viewer. */

import * as vscode from 'vscode';
import * as helpers from './viewer-provider-helpers';
import * as panelHandlers from './viewer-panel-handlers';
import { showBugReport } from './bug-report-panel';
import type { SessionDisplayOptions } from './session-display';

export interface ViewerMessageContext {
    readonly currentFileUri: vscode.Uri | undefined;
    readonly isSessionActive: boolean;
    readonly context: vscode.ExtensionContext;
    readonly post: (msg: unknown) => void;
    readonly load: (uri: vscode.Uri) => Promise<void>;
    readonly onMarkerRequest?: () => void;
    readonly onTogglePause?: () => void;
    readonly onExclusionAdded?: (p: string) => void;
    readonly onExclusionRemoved?: (p: string) => void;
    readonly onAnnotationPrompt?: (i: number, c: string) => void;
    readonly onSearchCodebase?: (t: string) => void;
    readonly onSearchSessions?: (t: string) => void;
    readonly onAnalyzeLine?: (t: string, i: number, u: vscode.Uri | undefined) => void;
    readonly onAddToWatch?: (t: string) => void;
    readonly onLinkClick?: (p: string, l: number, c: number, s: boolean) => void;
    readonly onPartNavigate?: (p: number) => void;
    readonly onSavePresetRequest?: (f: Record<string, unknown>) => void;
    readonly onSessionListRequest?: () => void;
    readonly onOpenSessionFromPanel?: (u: string) => void;
    readonly onDisplayOptionsChange?: (o: SessionDisplayOptions) => void;
    readonly onPopOutRequest?: () => void;
    readonly onRevealLogFile?: (u: string) => void;
    readonly onAddBookmark?: (i: number, t: string, u: vscode.Uri | undefined) => void;
    readonly onFindInFiles?: (q: string, o: Record<string, unknown>) => void;
    readonly onOpenFindResult?: (u: string, q: string, o: Record<string, unknown>) => void;
    readonly onFindNavigateMatch?: (u: string, i: number) => void;
    readonly onBookmarkAction?: (m: Record<string, unknown>) => void;
    readonly onSessionNavigate?: (d: number) => void;
    readonly onSessionAction?: (a: string, u: string, f: string) => void;
}

/** Route a webview message to the appropriate handler. */
export function dispatchViewerMessage(msg: Record<string, unknown>, ctx: ViewerMessageContext): void {
    switch (msg.type) {
      case "insertMarker": ctx.onMarkerRequest?.(); break;
      case "togglePause": ctx.onTogglePause?.(); break;
      case "copyToClipboard": vscode.env.clipboard.writeText(String(msg.text ?? "")); break;
      case "copySourcePath":
        helpers.copySourcePath(String(msg.path ?? ""), String(msg.mode ?? "relative"));
        break;
      case "exclusionAdded": case "addToExclusion": ctx.onExclusionAdded?.(String(msg.pattern ?? msg.text ?? "")); break;
      case "exclusionRemoved": ctx.onExclusionRemoved?.(String(msg.pattern ?? "")); break;
      case "openSettings": void vscode.commands.executeCommand("workbench.action.openSettings", String(msg.setting ?? "")); break;
      case "searchCodebase": ctx.onSearchCodebase?.(String(msg.text ?? "")); break;
      case "searchSessions": ctx.onSearchSessions?.(String(msg.text ?? "")); break;
      case "analyzeLine": ctx.onAnalyzeLine?.(String(msg.text ?? ""), Number(msg.lineIndex ?? -1), ctx.currentFileUri); break;
      case "generateReport":
        if (ctx.currentFileUri) { showBugReport(String(msg.text ?? ""), Number(msg.lineIndex ?? 0), ctx.currentFileUri).catch(() => {}); }
        break;
      case "addToWatch": ctx.onAddToWatch?.(String(msg.text ?? "")); break;
      case "promptAnnotation":
        ctx.onAnnotationPrompt?.(Number(msg.lineIndex ?? 0), String(msg.current ?? ""));
        break;
      case "addBookmark": ctx.onAddBookmark?.(Number(msg.lineIndex ?? 0), String(msg.text ?? ""), ctx.currentFileUri); break;
      case "linkClicked":
        ctx.onLinkClick?.(String(msg.path ?? ""), Number(msg.line ?? 1), Number(msg.col ?? 1), Boolean(msg.splitEditor));
        break;
      case "openUrl": vscode.env.openExternal(vscode.Uri.parse(String(msg.url ?? ""))).then(undefined, () => {}); break;
      case "navigatePart": ctx.onPartNavigate?.(Number(msg.part ?? 1)); break;
      case "navigateSession": ctx.onSessionNavigate?.(Number(msg.direction ?? 0)); break;
      case "savePresetRequest":
        ctx.onSavePresetRequest?.((msg.filters as Record<string, unknown>) ?? {});
        break;
      case "setCaptureAll":
        vscode.workspace.getConfiguration("saropaLogCapture")
          .update("captureAll", Boolean(msg.value), vscode.ConfigurationTarget.Workspace);
        break;
      case "editLine":
        helpers.handleEditLine(ctx.currentFileUri, ctx.isSessionActive, {
          lineIndex: Number(msg.lineIndex ?? 0), newText: String(msg.newText ?? ""),
          timestamp: Number(msg.timestamp ?? 0), loadFromFile: ctx.load,
        }).catch((err) => { vscode.window.showErrorMessage(`Failed to edit line: ${err.message}`); });
        break;
      case "exportLogs":
        helpers.handleExportLogs(String(msg.text ?? ""), (msg.options as Record<string, unknown>) ?? {})
          .catch((err) => { vscode.window.showErrorMessage(`Failed to export logs: ${err.message}`); });
        break;
      case "saveLevelFilters":
        helpers.saveLevelFilters(ctx.context, String(msg.filename ?? ""), (msg.levels as string[]) ?? []);
        break;
      case "requestFindInFiles":
        ctx.onFindInFiles?.(String(msg.query ?? ""), { caseSensitive: msg.caseSensitive, wholeWord: msg.wholeWord, useRegex: msg.useRegex });
        break;
      case "openFindResult":
        ctx.onOpenFindResult?.(String(msg.uriString ?? ""), String(msg.query ?? ""), { caseSensitive: msg.caseSensitive, wholeWord: msg.wholeWord, useRegex: msg.useRegex });
        break;
      case "findNavigateMatch":
        ctx.onFindNavigateMatch?.(String(msg.uriString ?? ""), Number(msg.matchIndex ?? 0));
        break;
      case "requestBookmarks": case "deleteBookmark": case "deleteFileBookmarks": case "deleteAllBookmarks": case "editBookmarkNote": case "openBookmark": ctx.onBookmarkAction?.(msg); break;
      case "requestSessionList": ctx.onSessionListRequest?.(); break;
      case "openSessionFromPanel": ctx.onOpenSessionFromPanel?.(String(msg.uriString ?? "")); break;
      case "sessionAction": ctx.onSessionAction?.(String(msg.action ?? ""), String(msg.uriString ?? ""), String(msg.filename ?? "")); break;
      case "popOutViewer": ctx.onPopOutRequest?.(); break;
      case "revealLogFile":
        if (ctx.currentFileUri && ctx.onRevealLogFile) { Promise.resolve(ctx.onRevealLogFile(ctx.currentFileUri.toString())).catch(() => {}); }
        break;
      case "setSessionDisplayOptions": ctx.onDisplayOptionsChange?.((msg.options as SessionDisplayOptions)); break;
      case "promptGoToLine":
        vscode.window.showInputBox({ prompt: "Go to line number", validateInput: (v) => /^\d+$/.test(v) ? null : "Enter a number" })
          .then((v) => { if (v) { ctx.post({ type: "scrollToLine", line: parseInt(v, 10) }); } });
        break;
      case "scriptError":
        ((msg.errors as { message: string }[]) ?? []).forEach(e => console.warn("[SLC Webview]", e.message));
        break;
      case "requestCrashlyticsData": case "crashlyticsCheckAgain": panelHandlers.handleCrashlyticsRequest(ctx.post).catch(() => {}); break;
      case "fetchCrashDetail": panelHandlers.handleCrashDetail(String(msg.issueId ?? ''), ctx.post).catch(() => {}); break;
      case "crashlyticsCloseIssue": case "crashlyticsMuteIssue": panelHandlers.handleCrashlyticsAction(String(msg.issueId ?? ''), msg.type === "crashlyticsCloseIssue" ? 'CLOSED' : 'MUTED', ctx.post).catch(() => {}); break;
      case "crashlyticsRunGcloudAuth": panelHandlers.handleGcloudAuth(ctx.post); break;
      case "crashlyticsBrowseGoogleServices": panelHandlers.handleBrowseGoogleServices(ctx.post).catch(() => {}); break;
      case "openGcloudInstall": panelHandlers.handleOpenGcloudInstall(); break;
      case "crashlyticsPanelOpened": panelHandlers.startCrashlyticsAutoRefresh(ctx.post); break;
      case "crashlyticsPanelClosed": panelHandlers.stopCrashlyticsAutoRefresh(); break;
      case "requestRecurringErrors": panelHandlers.handleRecurringRequest(ctx.post).catch(() => {}); break;
      case "setRecurringErrorStatus": panelHandlers.handleSetErrorStatus(String(msg.hash ?? ''), String(msg.status ?? 'open'), ctx.post).catch(() => {}); break;
      case "openInsights": vscode.commands.executeCommand('saropaLogCapture.showInsights'); break;
    }
}

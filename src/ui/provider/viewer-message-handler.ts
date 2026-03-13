/**
 * Dispatches incoming webview postMessage to extension handlers. Each message type
 * (copyToClipboard, editLine, navigateSession, etc.) is routed via ViewerMessageContext
 * callbacks set by LogViewerProvider. Called from the provider's onDidReceiveMessage.
 */

import * as vscode from "vscode";
import { t } from "../../l10n";
import * as helpers from "./viewer-provider-helpers";
import { loadAndPostAboutContent } from "../viewer-panels/about-content-loader";
import * as panelHandlers from '../shared/viewer-panel-handlers';
import { showBugReport } from '../panels/bug-report-panel';
import type { SessionDisplayOptions } from '../session/session-display';
import { logExtensionWarn } from '../../modules/misc/extension-logger';
import { assertDefined } from '../../modules/misc/assert';
import { InvestigationStore } from '../../modules/investigation/investigation-store';
import { showInvestigationPanel } from '../investigation/investigation-panel';

export interface ViewerMessageContext {
    readonly currentFileUri: vscode.Uri | undefined;
    readonly isSessionActive: boolean;
    readonly context: vscode.ExtensionContext;
    readonly extensionVersion?: string;
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
    readonly onBrowseSessionRoot?: () => Promise<void>;
    readonly onClearSessionRoot?: () => Promise<void>;
}

/**
 * Route a webview message to the appropriate handler.
 * @param msg - Incoming message with at least `type`; payload fields vary by type.
 * @param ctx - Callbacks and state (current file, post, load, etc.) for handling the message.
 */
/** Clamp numeric param to safe integer range for line/part indices (0 .. 10M). */
const MAX_SAFE_INDEX = 10_000_000;
function safeLineIndex(v: unknown, fallback: number): number {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > MAX_SAFE_INDEX) {return fallback;}
  return Math.floor(n);
}

/** Only allow http, https, or vscode URIs for openUrl to avoid javascript: etc. */
function isAllowedExternalUrl(url: string): boolean {
  const trimmed = url.trim();
  if (trimmed.length === 0 || trimmed.length > 2048) {return false;}
  return /^https?:\/\//i.test(trimmed) || /^vscode:\/\//i.test(trimmed);
}

export function dispatchViewerMessage(msg: Record<string, unknown>, ctx: ViewerMessageContext): void {
    // Require context so misuse fails fast with a clear error.
    assertDefined(ctx, 'ctx');
    if (!msg || typeof msg !== 'object' || typeof msg.type !== 'string') {
        logExtensionWarn('viewerMessage', 'Ignoring message with missing or invalid type');
        return;
    }
    switch (msg.type) {
      case "insertMarker": ctx.onMarkerRequest?.(); break;
      case "togglePause": ctx.onTogglePause?.(); break;
      case "copyToClipboard": vscode.env.clipboard.writeText(String(msg.text ?? "")); break;
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
        break;
      }
      case "presetApplied":
        if (msg.name) { void ctx.context.workspaceState.update("saropaLogCapture.lastUsedPresetName", String(msg.name)); }
        break;
      case "copySourcePath":
        helpers.copySourcePath(String(msg.path ?? ""), String(msg.mode ?? "relative"));
        break;
      case "exclusionAdded": case "addToExclusion": ctx.onExclusionAdded?.(String(msg.pattern ?? msg.text ?? "")); break;
      case "exclusionRemoved": ctx.onExclusionRemoved?.(String(msg.pattern ?? "")); break;
      case "openSettings": void vscode.commands.executeCommand("workbench.action.openSettings", String(msg.setting ?? "")); break;
      case "searchCodebase": ctx.onSearchCodebase?.(String(msg.text ?? "")); break;
      case "searchSessions": ctx.onSearchSessions?.(String(msg.text ?? "")); break;
      case "analyzeLine": ctx.onAnalyzeLine?.(String(msg.text ?? ""), safeLineIndex(msg.lineIndex, -1), ctx.currentFileUri); break;
      case "generateReport":
        if (ctx.currentFileUri) { showBugReport(String(msg.text ?? ""), safeLineIndex(msg.lineIndex, 0), ctx.currentFileUri, ctx.context).catch(() => {}); }
        break;
      case "addToWatch": ctx.onAddToWatch?.(String(msg.text ?? "")); break;
      case "promptAnnotation":
        ctx.onAnnotationPrompt?.(safeLineIndex(msg.lineIndex, 0), String(msg.current ?? ""));
        break;
      case "addBookmark": ctx.onAddBookmark?.(safeLineIndex(msg.lineIndex, 0), String(msg.text ?? ""), ctx.currentFileUri); break;
      case "linkClicked":
        ctx.onLinkClick?.(String(msg.path ?? ""), Number(msg.line ?? 1), Number(msg.col ?? 1), Boolean(msg.splitEditor));
        break;
      case "openUrl": {
        const url = String(msg.url ?? "");
        if (isAllowedExternalUrl(url)) {
          vscode.env.openExternal(vscode.Uri.parse(url)).then(undefined, () => {});
        } else {
          logExtensionWarn('viewerMessage', 'openUrl rejected: invalid or disallowed scheme');
        }
        break;
      }
      case "navigatePart": ctx.onPartNavigate?.(Math.max(1, safeLineIndex(msg.part, 1))); break;
      case "navigateSession": { const d = Number(msg.direction); ctx.onSessionNavigate?.(d < 0 ? -1 : 1); break; }
      case "savePresetRequest":
        ctx.onSavePresetRequest?.((msg.filters as Record<string, unknown>) ?? {});
        break;
      case "setCaptureAll":
        vscode.workspace.getConfiguration("saropaLogCapture")
          .update("captureAll", Boolean(msg.value), vscode.ConfigurationTarget.Workspace);
        break;
      case "editLine":
        helpers.handleEditLine(ctx.currentFileUri, ctx.isSessionActive, {
          lineIndex: safeLineIndex(msg.lineIndex, 0), newText: String(msg.newText ?? ""),
          timestamp: Number(msg.timestamp ?? 0), loadFromFile: ctx.load,
        }).catch((err: Error) => { vscode.window.showErrorMessage(t('msg.failedEditLine', err.message)); });
        break;
      case "exportLogs":
        helpers.handleExportLogs(String(msg.text ?? ""), (msg.options as Record<string, unknown>) ?? {})
          .catch((err: Error) => { vscode.window.showErrorMessage(t('msg.failedExportLogs', err.message)); });
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
        ctx.onFindNavigateMatch?.(String(msg.uriString ?? ""), safeLineIndex(msg.matchIndex, 0));
        break;
      case "requestBookmarks": case "deleteBookmark": case "deleteFileBookmarks": case "deleteAllBookmarks": case "editBookmarkNote": case "openBookmark": ctx.onBookmarkAction?.(msg); break;
      case "requestSessionList": ctx.onSessionListRequest?.(); break;
      case "requestInvestigations":
        void (async () => {
          const store = new InvestigationStore(ctx.context);
          const investigations = await store.listInvestigations();
          const activeId = await store.getActiveInvestigationId();
          ctx.post({
            type: "investigationsList",
            investigations: investigations.map((inv) => ({
              id: inv.id,
              name: inv.name,
              sourceCount: inv.sources.length,
              isActive: inv.id === activeId,
            })),
            activeId: activeId ?? undefined,
          });
        })();
        break;
      case "openInvestigationById":
        void (async () => {
          const id = String(msg.id ?? "");
          if (!id) { return; }
          const store = new InvestigationStore(ctx.context);
          await store.setActiveInvestigationId(id);
          await showInvestigationPanel(store);
        })();
        break;
      case "runCommand":
        void vscode.commands.executeCommand(String(msg.command ?? ""), ...(Array.isArray(msg.args) ? msg.args : []));
        break;
      case "browseSessionRoot": void ctx.onBrowseSessionRoot?.(); break;
      case "clearSessionRoot": void ctx.onClearSessionRoot?.(); break;
      case "openSessionFromPanel": ctx.onOpenSessionFromPanel?.(String(msg.uriString ?? "")); break;
      case "sessionAction": ctx.onSessionAction?.(String(msg.action ?? ""), String(msg.uriString ?? ""), String(msg.filename ?? "")); break;
      case "popOutViewer": ctx.onPopOutRequest?.(); break;
      case "revealLogFile":
        if (ctx.currentFileUri && ctx.onRevealLogFile) { Promise.resolve(ctx.onRevealLogFile(ctx.currentFileUri.toString())).catch(() => {}); }
        break;
      case "copyCurrentFilePath":
        if (ctx.currentFileUri) { vscode.env.clipboard.writeText(ctx.currentFileUri.fsPath).then(() => {}, () => {}); }
        break;
      case "openCurrentFileFolder":
        if (ctx.currentFileUri) {
          const parentUri = vscode.Uri.joinPath(ctx.currentFileUri, '..');
          vscode.commands.executeCommand('revealFileInOS', parentUri).then(() => {}, () => {});
        }
        break;
      case "setSessionDisplayOptions": ctx.onDisplayOptionsChange?.((msg.options as SessionDisplayOptions)); break;
      case "promptGoToLine":
        vscode.window.showInputBox({
            prompt: t('prompt.goToLine'),
            validateInput: (v) => /^\d+$/.test(v) ? null : t('prompt.goToLineValidate'),
          })
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
      case "crashlyticsOpenGoogleServicesJson": panelHandlers.handleOpenGoogleServicesJson().catch(() => {}); break;
      case "openGcloudInstall": panelHandlers.handleOpenGcloudInstall(); break;
      case "crashlyticsPanelOpened": panelHandlers.startCrashlyticsAutoRefresh(ctx.post); break;
      case "crashlyticsPanelClosed": panelHandlers.stopCrashlyticsAutoRefresh(); break;
      case "requestRecurringErrors": panelHandlers.handleRecurringRequest(ctx.post).catch(() => {}); break;
      case "requestPerformanceData": panelHandlers.handlePerformanceRequest(ctx.post, ctx.currentFileUri).catch(() => {}); break;
      case "setRecurringErrorStatus": panelHandlers.handleSetErrorStatus(String(msg.hash ?? ''), String(msg.status ?? 'open'), ctx.post).catch(() => {}); break;
      case "openInsights": vscode.commands.executeCommand('saropaLogCapture.showInsights'); break;
      case "requestAboutContent":
        void loadAndPostAboutContent(ctx.context.extensionUri, ctx.extensionVersion, ctx.context.extension.id, ctx.post);
        break;
      case "resetAllSettings":
        /* Host shows modal confirmation; no webview feedback needed. */
        void vscode.commands.executeCommand('saropaLogCapture.resetAllSettings');
        break;
      case "setIntegrationsAdapters":
        /* Options panel toggled an integration; persist, run prep checks, then echo back. */
        {
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
        }
        break;
      case "showIntegrationContext":
        panelHandlers.handleIntegrationContextRequest(
          ctx.currentFileUri,
          safeLineIndex(msg.lineIndex, 0),
          msg.timestamp as number | undefined,
          ctx.post,
        ).catch(() => {});
        break;
      case "openFullIntegrationContext":
        panelHandlers.handleIntegrationContextDocument(
          ctx.currentFileUri,
          safeLineIndex(msg.lineIndex, 0),
        ).catch(() => {});
        break;
    }
}

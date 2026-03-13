/**
 * Shared handler wiring for viewer targets.
 *
 * Wires the same webview → extension callbacks on both the sidebar
 * LogViewerProvider and the pop-out PopOutPanel, avoiding duplication
 * in extension.ts.
 */

import * as vscode from "vscode";
import { t } from "../../l10n";
import type { SessionManagerImpl } from "../../modules/session/session-manager";
import type { SessionHistoryProvider } from "../session/session-history-provider";
import type { ViewerBroadcaster } from "./viewer-broadcaster";
import { getLogDirectoryUri } from "../../modules/config/config";
import { showSearchQuickPick } from "../../modules/search/log-search-ui";
import { openLogAtLine } from "../../modules/search/log-search";
import { showAnalysis } from "../analysis/analysis-panel";
import { loadPresets, promptSavePreset } from "../../modules/storage/filter-presets";
import { buildSessionListPayload, openSourceFile } from "./viewer-provider-helpers";
import type { BookmarkStore } from "../../modules/storage/bookmark-store";
import { wireBookmarkHandlers } from "./viewer-handler-bookmarks";
import { handleSessionAction } from "./viewer-handler-sessions";

/** Workspace state: Project Logs panel root folder override (URI string). */
export const SESSION_PANEL_ROOT_KEY = "sessionPanelRootFolder";
/** Workspace state: last folder used in browse dialog so defaultUri is never system default. */
const SESSION_PANEL_LAST_BROWSE_KEY = "sessionPanelLastBrowseFolder";

/** Object with handler setters common to both viewer targets. */
interface HandlerTarget {
  setMarkerHandler(h: () => void): void;
  setLinkClickHandler(h: (p: string, l: number, c: number, s: boolean) => void): void;
  setTogglePauseHandler(h: () => void): void;
  setExclusionAddedHandler(h: (p: string) => void): void;
  setExclusionRemovedHandler(h: (p: string) => void): void;
  setAnnotationPromptHandler(h: (i: number, c: string) => void): void;
  setSearchCodebaseHandler(h: (t: string) => void): void;
  setSearchSessionsHandler(h: (t: string) => void): void;
  setAnalyzeLineHandler(h: (t: string, i: number, u: vscode.Uri | undefined) => void): void;
  setAddToWatchHandler(h: (t: string) => void): void;
  setSavePresetRequestHandler(h: (f: Record<string, unknown>) => void): void;
  setSessionListHandler(h: () => void): void;
  setSessionActionHandler(h: (action: string, uriString: string, filename: string) => void): void;
  setAddBookmarkHandler(h: (lineIndex: number, text: string, fileUri: vscode.Uri | undefined) => void): void;
  setBookmarkActionHandler(h: (msg: Record<string, unknown>) => void): void;
  setBrowseSessionRootHandler?(h: () => Promise<void>): void;
  setClearSessionRootHandler?(h: () => Promise<void>): void;
}

/** Dependencies needed by the shared handler wiring. */
export interface HandlerDeps {
  readonly sessionManager: SessionManagerImpl;
  readonly broadcaster: ViewerBroadcaster;
  readonly historyProvider: SessionHistoryProvider;
  readonly bookmarkStore: BookmarkStore;
  readonly context: vscode.ExtensionContext;
  readonly onOpenBookmark?: (fileUri: string, lineIndex: number) => void;
  /** Open a session and start replay (focus viewer + load with replay option). */
  readonly openSessionForReplay?: (uri: vscode.Uri) => Promise<void>;
}

/** Wire common webview→extension handlers on a viewer target. */
export function wireSharedHandlers(target: HandlerTarget, deps: HandlerDeps): void {
  const { sessionManager, broadcaster, historyProvider } = deps;

  // --- Marker, link click, pause ---
  target.setMarkerHandler(() => sessionManager.insertMarker());
  target.setLinkClickHandler((f, l, c, s) => openSourceFile(f, l, c, s));
  target.setTogglePauseHandler(() => {
    const p = sessionManager.togglePause();
    if (p !== undefined) { broadcaster.setPaused(p); }
  });

  wireExclusionHandlers(target, broadcaster);
  wireContentHandlers(target, sessionManager, broadcaster, historyProvider);

  // --- Session list, browse/clear root, session actions ---
  wireSessionListHandlers(target, deps);
  wireBookmarkHandlers(target, {
    sessionManager, broadcaster,
    bookmarkStore: deps.bookmarkStore,
    onOpenBookmark: deps.onOpenBookmark,
  });
}

function wireExclusionHandlers(target: HandlerTarget, broadcaster: ViewerBroadcaster): void {
  target.setExclusionAddedHandler(async (pattern) => {
    const cfg = vscode.workspace.getConfiguration('saropaLogCapture');
    const cur = cfg.get<string[]>('exclusions', []);
    if (!cur.includes(pattern)) {
      await cfg.update('exclusions', [...cur, pattern], vscode.ConfigurationTarget.Workspace);
    }
  });
  target.setExclusionRemovedHandler(async (pattern) => {
    const cfg = vscode.workspace.getConfiguration('saropaLogCapture');
    const cur = cfg.get<string[]>('exclusions', []);
    const updated = cur.filter(p => p !== pattern);
    if (updated.length !== cur.length) {
      await cfg.update('exclusions', updated, vscode.ConfigurationTarget.Workspace);
      broadcaster.setExclusions(updated);
    }
  });
}

function wireContentHandlers(
  target: HandlerTarget,
  sessionManager: SessionManagerImpl,
  broadcaster: ViewerBroadcaster,
  historyProvider: SessionHistoryProvider,
): void {
  target.setAnnotationPromptHandler(async (lineIndex, current) => {
    const text = await vscode.window.showInputBox({
      prompt: t('prompt.annotateLine', String(lineIndex + 1)),
      value: current,
    });
    if (text === undefined) { return; }
    broadcaster.setAnnotation(lineIndex, text);
    const session = sessionManager.getActiveSession();
    if (session) {
      await historyProvider.getMetaStore().addAnnotation(session.fileUri, {
        lineIndex, text, timestamp: new Date().toISOString(),
      });
    }
  });
  target.setSavePresetRequestHandler(async (filters) => {
    const preset = await promptSavePreset(filters as {
      categories?: string[]; levels?: string[]; searchPattern?: string; exclusionsEnabled?: boolean;
    });
    if (preset) { broadcaster.setPresets(loadPresets()); }
  });
  target.setSearchCodebaseHandler(async (text) => {
    await vscode.commands.executeCommand('workbench.action.findInFiles', { query: text });
  });
  target.setSearchSessionsHandler(async (text) => {
    const m = await showSearchQuickPick(text);
    if (m) { await openLogAtLine(m); }
  });
  target.setAnalyzeLineHandler(async (text, idx, uri) => { await showAnalysis(text, idx, uri); });
  target.setAddToWatchHandler(async (text) => {
    const cfg = vscode.workspace.getConfiguration('saropaLogCapture');
    const cur = cfg.get<{ pattern: string; alertType?: string }[]>('watchPatterns', []);
    if (cur.some(p => p.pattern === text)) {
      vscode.window.showInformationMessage(t('msg.alreadyInWatchList', text));
      return;
    }
    await cfg.update('watchPatterns', [...cur, { pattern: text }], vscode.ConfigurationTarget.Workspace);
    vscode.window.showInformationMessage(t('msg.addedToWatchList', text));
  });
}

function getSessionRootPath(context: vscode.ExtensionContext): string {
  const folder = vscode.workspace.workspaceFolders?.[0];
  const overrideUriStr = context.workspaceState.get<string>(SESSION_PANEL_ROOT_KEY);
  const overrideUri = overrideUriStr ? vscode.Uri.parse(overrideUriStr) : undefined;
  return overrideUri ? overrideUri.fsPath : (folder ? getLogDirectoryUri(folder).fsPath : "No workspace");
}

/** Wire session list, browse root, clear root, and session action handlers. */
function wireSessionListHandlers(target: HandlerTarget, deps: HandlerDeps): void {
  const { historyProvider, broadcaster } = deps;
  const refreshSessionList = async (): Promise<void> => {
    const overrideUriStr = deps.context.workspaceState.get<string>(SESSION_PANEL_ROOT_KEY);
    const overrideUri = overrideUriStr ? vscode.Uri.parse(overrideUriStr) : undefined;
    const items = overrideUri
      ? await historyProvider.getAllChildrenFromRoot(overrideUri)
      : await historyProvider.getAllChildren();
    const payload = await buildSessionListPayload(items, historyProvider.getActiveUri());
    const rootLabel = getSessionRootPath(deps.context);
    broadcaster.sendSessionList(payload, { label: rootLabel, path: rootLabel, isDefault: !overrideUri });
  };
  let sessionListTimer: ReturnType<typeof setTimeout> | undefined;
  target.setSessionListHandler(() => {
    broadcaster.sendSessionListLoading(getSessionRootPath(deps.context));
    if (sessionListTimer) { clearTimeout(sessionListTimer); }
    sessionListTimer = setTimeout(() => { void refreshSessionList(); }, 150);
  });
  target.setBrowseSessionRootHandler?.(async () => {
    const folder = vscode.workspace.workspaceFolders?.[0];
    const defaultLogUri = folder ? getLogDirectoryUri(folder) : undefined;
    const lastBrowse = deps.context.workspaceState.get<string>(SESSION_PANEL_LAST_BROWSE_KEY);
    const defaultUri = lastBrowse ? vscode.Uri.parse(lastBrowse) : defaultLogUri;
    const uris = await vscode.window.showOpenDialog({
      canSelectFolders: true, canSelectMany: false, defaultUri: defaultUri ?? undefined,
    });
    if (uris?.length) {
      await deps.context.workspaceState.update(SESSION_PANEL_ROOT_KEY, uris[0].toString());
      await deps.context.workspaceState.update(SESSION_PANEL_LAST_BROWSE_KEY, uris[0].toString());
      await refreshSessionList();
    }
  });
  target.setClearSessionRootHandler?.(async () => {
    const folder = vscode.workspace.workspaceFolders?.[0];
    const defaultLogUri = folder ? getLogDirectoryUri(folder) : undefined;
    await deps.context.workspaceState.update(SESSION_PANEL_ROOT_KEY, undefined);
    if (defaultLogUri) {
      await deps.context.workspaceState.update(SESSION_PANEL_LAST_BROWSE_KEY, defaultLogUri.toString());
    }
    await refreshSessionList();
  });
  target.setSessionActionHandler((action, uriString, filename) => {
    void handleSessionAction(action, uriString, filename, {
      historyProvider, refreshList: refreshSessionList, openSessionForReplay: deps.openSessionForReplay,
    });
  });
}

/**
 * Shared handler wiring for viewer targets.
 *
 * Wires the same webview → extension callbacks on both the sidebar
 * LogViewerProvider and the pop-out PopOutPanel, avoiding duplication
 * in extension.ts.
 */

import * as vscode from "vscode";
import type { SessionManagerImpl } from "../modules/session-manager";
import type { SessionHistoryProvider } from "./session-history-provider";
import type { ViewerBroadcaster } from "./viewer-broadcaster";
import { showSearchQuickPick } from "../modules/log-search-ui";
import { openLogAtLine } from "../modules/log-search";
import { loadPresets, promptSavePreset } from "../modules/filter-presets";
import { buildSessionListPayload, openSourceFile } from "./viewer-provider-helpers";
import type { BookmarkStore } from "../modules/bookmark-store";

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
  setAddToWatchHandler(h: (t: string) => void): void;
  setSavePresetRequestHandler(h: (f: Record<string, unknown>) => void): void;
  setSessionListHandler(h: () => void): void;
  setAddBookmarkHandler(h: (lineIndex: number, text: string, fileUri: vscode.Uri | undefined) => void): void;
}

/** Dependencies needed by the shared handler wiring. */
export interface HandlerDeps {
  readonly sessionManager: SessionManagerImpl;
  readonly broadcaster: ViewerBroadcaster;
  readonly historyProvider: SessionHistoryProvider;
  readonly bookmarkStore: BookmarkStore;
}

/** Wire common webview→extension handlers on a viewer target. */
export function wireSharedHandlers(target: HandlerTarget, deps: HandlerDeps): void {
  const { sessionManager, broadcaster, historyProvider } = deps;
  target.setMarkerHandler(() => sessionManager.insertMarker());
  target.setLinkClickHandler((f, l, c, s) => openSourceFile(f, l, c, s));
  target.setTogglePauseHandler(() => {
    const p = sessionManager.togglePause();
    if (p !== undefined) { broadcaster.setPaused(p); }
  });
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
  target.setAnnotationPromptHandler(async (lineIndex, current) => {
    const text = await vscode.window.showInputBox({ prompt: `Annotate line ${lineIndex + 1}`, value: current });
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
      categories?: string[]; searchPattern?: string; exclusionsEnabled?: boolean;
    });
    if (preset) { broadcaster.setPresets(loadPresets()); }
  });
  target.setSearchCodebaseHandler(async (t) => {
    await vscode.commands.executeCommand('workbench.action.findInFiles', { query: t });
  });
  target.setSearchSessionsHandler(async (t) => {
    const m = await showSearchQuickPick(t);
    if (m) { await openLogAtLine(m); }
  });
  target.setAddToWatchHandler(async (text) => {
    const cfg = vscode.workspace.getConfiguration('saropaLogCapture');
    const cur = cfg.get<{ pattern: string; alertType?: string }[]>('watchPatterns', []);
    if (cur.some(p => p.pattern === text)) {
      vscode.window.showInformationMessage(`"${text}" is already in watch list.`);
      return;
    }
    await cfg.update('watchPatterns', [...cur, { pattern: text }], vscode.ConfigurationTarget.Workspace);
    vscode.window.showInformationMessage(`Added "${text}" to watch list.`);
  });
  target.setSessionListHandler(async () => {
    const items = await historyProvider.getChildren();
    broadcaster.sendSessionList(buildSessionListPayload(items, historyProvider.getActiveUri()));
  });
  target.setAddBookmarkHandler(async (lineIndex, text, fileUri) => {
    const note = await vscode.window.showInputBox({
      prompt: `Bookmark line ${lineIndex + 1} — add a note (optional)`,
      placeHolder: 'Leave empty for no note',
    });
    if (note === undefined) { return; }
    const uri = fileUri ?? sessionManager.getActiveSession()?.fileUri;
    if (!uri) { return; }
    const filename = uri.path.split('/').pop() ?? '';
    deps.bookmarkStore.add(uri.toString(), filename, lineIndex, text, note);
  });
}

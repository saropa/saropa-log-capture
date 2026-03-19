/**
 * Load-from-file and tail watcher logic for LogViewerProvider.
 * Extracted to keep log-viewer-provider.ts under the line limit.
 */

import * as vscode from "vscode";
import { UNIFIED_SESSION_LOG_SUFFIX } from "../../modules/session/unified-session-log-writer";
import { getConfig } from "../../modules/config/config";
import { findHeaderEnd, sendFileLines, parseHeaderFields, parseRawLinesToPending, SOURCE_DEBUG } from "../viewer/viewer-file-loader";
import * as helpers from "./viewer-provider-helpers";
import { getCorrelationByLocation } from "../../modules/correlation/correlation-store";
import type { FirstErrorResult } from "../../modules/bookmarks/first-error";
import { findSidecarUris } from "../../modules/context/context-loader";
import {
  appendExternalSidecarLines,
  appendTerminalSidecarLines,
  buildMainCtx,
  collectViewerSourcesForSidecars,
  getMainBaseFromFsPath,
  getSmartBookmarksFirstErrorAndWarning,
  loadPerfAndCodeQualityPayload,
  loadUnifiedSessionJsonlContent,
  postCorrelationByLineIndex,
  postRunBoundariesIfAny,
  truncateMainContentLines,
  type LoadContentResultLike,
} from "./log-viewer-provider-load-helpers";

export interface LogViewerLoadTarget {
  postMessage(msg: unknown): void;
  setFilename(name: string): void;
  setSessionInfo(info: Record<string, string> | null): void;
  setHasPerformanceData?(has: boolean): void;
  /** Pass code quality payload (meta.integrations.codeQuality) for the loaded log. */
  setCodeQualityPayload?(payload: unknown): void;
  getSeenCategories(): Set<string>;
}

export interface LogViewerTailTarget extends LogViewerLoadTarget {
  getCurrentFileUri(): vscode.Uri | undefined;
  getView(): vscode.WebviewView | undefined;
  getTailLastLineCount(): number;
  setTailLastLineCount(n: number): void;
  getTailUpdateInProgress(): boolean;
  setTailUpdateInProgress(v: boolean): void;
}

/** Load result for smart bookmark suggestion (first error/warning in this log). */
export interface LoadResultFirstError {
  firstError?: FirstErrorResult;
  firstWarning?: FirstErrorResult;
}

type LoadContentResult = LoadContentResultLike & LoadResultFirstError;

/**
 * Execute the core load: read file, parse header, send content lines, run boundaries.
 * Returns { sessionMidnightMs, contentLength, firstError?, firstWarning? } for optional tailing and smart bookmarks.
 */
export async function executeLoadContent(
  target: LogViewerLoadTarget,
  uri: vscode.Uri,
  checkGen: () => boolean,
): Promise<LoadContentResult> {
  const raw = await vscode.workspace.fs.readFile(uri);
  if (!checkGen()) { return { sessionMidnightMs: 0, contentLength: 0 }; }
  const text = Buffer.from(raw).toString("utf-8");
  target.postMessage({ type: "setViewingMode", viewing: true });
  target.setFilename(vscode.workspace.asRelativePath(uri, false));

  if (uri.fsPath.toLowerCase().endsWith(UNIFIED_SESSION_LOG_SUFFIX.toLowerCase())) {
    return await loadUnifiedSessionJsonlContent(target, uri, text, checkGen);
  }

  const rawLines = text.split(/\r?\n/);
  const fields = parseHeaderFields(rawLines);

  if (Object.keys(fields).length > 0) { target.setSessionInfo(fields); }

  const perfResult = await loadPerfAndCodeQualityPayload(target, uri, checkGen);
  if (perfResult.cancelled) {
    return { sessionMidnightMs: 0, contentLength: 0 };
  }

  if (target.setHasPerformanceData) { target.setHasPerformanceData(perfResult.hasPerf); }
  if (target.setCodeQualityPayload && perfResult.codeQualityPayload) {
    target.setCodeQualityPayload(perfResult.codeQualityPayload);
  }

  const { headerEnd, contentLines, didTruncate, truncatedShown } = truncateMainContentLines(rawLines);
  const cfg = getConfig();

  if (didTruncate) {
    target.postMessage({ type: "loadTruncated", shown: truncatedShown, total: rawLines.length - headerEnd });
  }

  const post = (msg: unknown): void => { if (checkGen()) { target.postMessage(msg); } };
  const ctx = buildMainCtx(fields, SOURCE_DEBUG);

  // Source filter: default to debug only; terminal sidecar (if present) adds a second source.
  post({ type: "setSources", sources: [SOURCE_DEBUG], enabledSources: [SOURCE_DEBUG] });
  await sendFileLines(contentLines, ctx, post, target.getSeenCategories());

  if (!checkGen()) { return { sessionMidnightMs: 0, contentLength: 0 }; }

  const sidecarUris = await findSidecarUris(uri);
  const terminalSidecar = sidecarUris.find((u) => u.fsPath.endsWith(".terminal.log"));
  const externalSidecars = sidecarUris.filter((u) => u.fsPath.endsWith(".log") && !u.fsPath.endsWith(".terminal.log"));
  const mainBase = getMainBaseFromFsPath(uri.fsPath);

  const sources = collectViewerSourcesForSidecars(mainBase, terminalSidecar, externalSidecars);
  if (sources.length > 1) {
    post({ type: "setSources", sources: [...sources], enabledSources: [...sources] });
  }

  const totalLineCount = contentLines.length;
  const terminalRes = await appendTerminalSidecarLines({
    terminalSidecar,
    totalLineCount,
    checkGen,
    post,
    target,
  });
  if (terminalRes.cancelled) { return { sessionMidnightMs: 0, contentLength: 0 }; }

  const externalRes = await appendExternalSidecarLines({
    externalSidecars,
    mainBase,
    totalLineCount: terminalRes.totalLineCount,
    checkGen,
    post,
    target,
  });
  if (externalRes.cancelled) { return { sessionMidnightMs: 0, contentLength: 0 }; }

  postRunBoundariesIfAny(contentLines, ctx, post);

  // Map correlation data to content line index for viewer badges (main log only; key is "file:line").
  const byLoc = getCorrelationByLocation(uri.toString());
  postCorrelationByLineIndex({
    uri,
    byLoc: byLoc as Iterable<[string, { id: string; description: string }]>,
    headerEnd,
    contentLinesLength: contentLines.length,
    post,
  });

  const smart = getSmartBookmarksFirstErrorAndWarning(cfg, contentLines);

  target.postMessage({ type: "loadComplete" });
  return {
    sessionMidnightMs: ctx.sessionMidnightMs,
    contentLength: contentLines.length,
    ...(smart.firstError && { firstError: smart.firstError }),
    ...(smart.firstWarning && { firstWarning: smart.firstWarning }),
  };
}

/** Create a file watcher that appends new lines to the viewer. Caller must dispose when done. */
export function createTailWatcher(
  uri: vscode.Uri,
  sessionMidnightMs: number,
  initialLineCount: number,
  target: LogViewerTailTarget,
): vscode.Disposable {
  target.setTailLastLineCount(initialLineCount);
  const watcher = vscode.workspace.createFileSystemWatcher(uri.fsPath);
  watcher.onDidChange(async () => {
    if (target.getCurrentFileUri()?.fsPath !== uri.fsPath || !target.getView()) { return; }
    // Guard re-entrancy: rapid file changes can fire onDidChange again before we finish.
    if (target.getTailUpdateInProgress()) { return; }
    target.setTailUpdateInProgress(true);
    try {
      const raw = await vscode.workspace.fs.readFile(uri);
      const rawLines = Buffer.from(raw).toString("utf-8").split(/\r?\n/);
      const headerEnd = findHeaderEnd(rawLines);
      const contentLines = rawLines.slice(headerEnd);
      const lastCount = target.getTailLastLineCount();
      if (contentLines.length <= lastCount) { return; }
      const newLines = contentLines.slice(lastCount);
      const ctx = { classifyFrame: (t: string) => helpers.classifyFrame(t), sessionMidnightMs };
      const pending = parseRawLinesToPending(newLines, ctx);
      target.setTailLastLineCount(contentLines.length);
      target.postMessage({ type: "addLines", lines: pending, lineCount: contentLines.length });
      helpers.sendNewCategories(pending, target.getSeenCategories(), (msg) => target.postMessage(msg));
    } catch {
      // File may be locked or deleted
    } finally {
      target.setTailUpdateInProgress(false);
    }
  });
  return watcher;
}

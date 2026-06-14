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
  appendBrowserSidecarLines,
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
  type LoadContentResultLike,
} from "./log-viewer-provider-load-helpers";
import { readSessionLogParts } from "./log-viewer-provider-load-parts";
import { classifyTailChange } from "./tail-change-classify";
import { computeDatabaseQueryLineCounts } from "./database-line-badges";

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
  /** Clear + re-read + re-tail the file. Used by the 039b external-reload hook on truncate/rewrite. */
  loadFromFile(uri: vscode.Uri, options?: { tail?: boolean; replay?: boolean }): Promise<void>;
}

/**
 * Behavior the tail watcher invokes for non-append external changes (plan 039b), injected by the
 * caller so the watcher stays decoupled from the provider's reload machinery.
 */
export interface TailExternalHooks {
  /** File shrank/was rewritten or recreated — reload it (honoring `reloadOnExternalChange`). */
  onExternalReload(uri: vscode.Uri): void;
  /** File was deleted on disk — keep the last snapshot and warn. */
  onExternalDelete(uri: vscode.Uri): void;
}

/** Load result for smart bookmark suggestion (first error/warning in this log). */
export interface LoadResultFirstError {
  firstError?: FirstErrorResult;
  firstWarning?: FirstErrorResult;
}

type LoadContentResult = LoadContentResultLike & LoadResultFirstError;

/** File mode types for structured-file rendering (plan 051). */
export type FileMode = 'log' | 'markdown' | 'json' | 'csv' | 'html';

/** Detect the viewer file mode from extension. Non-log modes skip the analysis pipeline. */
export function detectFileMode(uri: vscode.Uri): FileMode {
  const ext = uri.fsPath.toLowerCase().split('.').pop();
  switch (ext) {
    case 'md': return 'markdown';
    case 'json': case 'jsonl': return 'json';
    case 'csv': return 'csv';
    case 'html': case 'htm': return 'html';
    default: return 'log';
  }
}

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

  /* Notify the webview of the file mode so it can skip log analysis for
     structured documents (markdown, JSON, CSV, HTML). Sent before lines
     so the mode is set when addToData() receives the first line. */
  const fileMode = detectFileMode(uri);
  target.postMessage({ type: "setFileMode", mode: fileMode });

  if (uri.fsPath.toLowerCase().endsWith(UNIFIED_SESSION_LOG_SUFFIX.toLowerCase())) {
    return await loadUnifiedSessionJsonlContent(target, uri, text, checkGen);
  }

  const sessionParts = await readSessionLogParts(uri, text);
  const fields = parseHeaderFields(sessionParts[0].lines);

  if (Object.keys(fields).length > 0) { target.setSessionInfo(fields); }

  // Send the raw header lines (slice up to the closing divider) so the info modal
  // can render the original groupings, nested launch-config sub-keys, and hotlinks
  // that the flattened Record<string, string> would otherwise lose.
  const headerEndIdx = findHeaderEnd(sessionParts[0].lines);
  if (headerEndIdx > 0) {
    const headerLines = sessionParts[0].lines.slice(0, headerEndIdx).filter((l) => l !== '');
    target.postMessage({ type: 'setSessionHeaderLines', headerLines });
  } else {
    target.postMessage({ type: 'setSessionHeaderLines', headerLines: [] });
  }

  const perfResult = await loadPerfAndCodeQualityPayload(target, uri, checkGen);
  if (perfResult.cancelled) {
    return { sessionMidnightMs: 0, contentLength: 0 };
  }

  if (target.setHasPerformanceData) { target.setHasPerformanceData(perfResult.hasPerf); }
  if (target.setCodeQualityPayload && perfResult.codeQualityPayload) {
    target.setCodeQualityPayload(perfResult.codeQualityPayload);
  }
  if (checkGen()) {
    target.postMessage({
      type: "setRootCauseHintHostFields",
      driftAdvisorSummary: perfResult.rootCauseDriftAdvisorSummary ?? null,
      sessionDiffSummary: null,
    });
    target.postMessage({
      type: "setDriftAdvisorDbPanelMeta",
      payload: perfResult.driftAdvisorDbPanelPayload ?? null,
    });
  }

  const contentLines: string[] = [];
  for (const part of sessionParts) {
    const headerEndForPart = findHeaderEnd(part.lines);
    contentLines.push(...part.lines.slice(headerEndForPart));
  }
  const cfg = getConfig();
  // Status-bar level filters operate on in-memory allLines, so keep MAX_LINES high enough
  // for the full loaded session (including split parts) instead of trimming to viewer default.
  target.postMessage({ type: "setMaxLines", maxLines: Math.max(contentLines.length + 1000, cfg.maxLines) });

  const post = (msg: unknown): void => { if (checkGen()) { target.postMessage(msg); } };
  // Single-part: the displayed gutter line number must match the user's raw file (post-Item-A,
  // the in-memory allLines index counts hidden stack frames + synthetic chips, so idx+1 drifts
  // arbitrarily from the file line). For multi-part sessions content comes from several files
  // concatenated end-to-end; a single offset cannot represent that, so we omit it and let the
  // gutter fall back to the in-memory ordinal.
  const mainSourceLineOffset = sessionParts.length === 1 ? findHeaderEnd(sessionParts[0].lines) : undefined;
  const ctx = { ...buildMainCtx(fields, SOURCE_DEBUG), ...(mainSourceLineOffset !== undefined ? { sourceLineOffset: mainSourceLineOffset } : {}) };

  // Source filter: default to debug only; terminal sidecar (if present) adds a second source.
  post({ type: "setSources", sources: [SOURCE_DEBUG], enabledSources: [SOURCE_DEBUG] });
  await sendFileLines(contentLines, ctx, post, target.getSeenCategories());

  if (!checkGen()) { return { sessionMidnightMs: 0, contentLength: 0 }; }

  const sidecarUris = await findSidecarUris(uri);
  const terminalSidecar = sidecarUris.find((u) => u.fsPath.endsWith(".terminal.log"));
  const browserSidecar = sidecarUris.find((u) => u.fsPath.endsWith(".browser.json"));
  const externalSidecars = sidecarUris.filter((u) => u.fsPath.endsWith(".log") && !u.fsPath.endsWith(".terminal.log"));
  const mainBase = getMainBaseFromFsPath(uri.fsPath);

  const sources = collectViewerSourcesForSidecars(mainBase, terminalSidecar, externalSidecars, browserSidecar);
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

  const browserRes = await appendBrowserSidecarLines({
    browserSidecar,
    totalLineCount: externalRes.totalLineCount,
    checkGen,
    post,
    target,
  });
  if (browserRes.cancelled) { return { sessionMidnightMs: 0, contentLength: 0 }; }

  postRunBoundariesIfAny(contentLines, ctx, post);

  // Map correlation data to content line index for viewer badges (main log only; key is "file:line").
  const byLoc = getCorrelationByLocation(uri.toString());
  postCorrelationByLineIndex({
    uri,
    byLoc: byLoc as Iterable<[string, { id: string; description: string }]>,
    headerEnd: findHeaderEnd(sessionParts[0].lines),
    contentLinesLength: contentLines.length,
    post,
  });

  // Per-line database-query badge: flag content lines whose request ID matches a captured query.
  const databaseQueryLines = await computeDatabaseQueryLineCounts(
    uri, contentLines, cfg.integrationsDatabase.requestIdPattern,
  );
  if (checkGen() && Object.keys(databaseQueryLines).length > 0) {
    post({ type: "setDatabaseQueryLines", databaseQueryLines });
  }

  const smart = getSmartBookmarksFirstErrorAndWarning(cfg, contentLines);

  target.postMessage({ type: "loadComplete" });
  return {
    sessionMidnightMs: ctx.sessionMidnightMs,
    contentLength: contentLines.length,
    ...(smart.firstError && { firstError: smart.firstError }),
    ...(smart.firstWarning && { firstWarning: smart.firstWarning }),
  };
}

/**
 * Append newly-written tail lines to the viewer. Precondition: the file grew past `lastCount`.
 *
 * The first new content line sits at file position `headerEnd + lastCount` (0-based);
 * parseRawLinesToPending adds 1 to produce the 1-based gutter number so the tailed line numbers
 * continue the same source-file numbering the initial load used.
 */
function appendTailLines(
  sessionMidnightMs: number,
  target: LogViewerTailTarget,
  contentLines: readonly string[],
  headerEnd: number,
): void {
  const lastCount = target.getTailLastLineCount();
  const newLines = contentLines.slice(lastCount);
  const ctx = { classifyFrame: (t: string) => helpers.classifyFrame(t), sessionMidnightMs, sourceLineOffset: headerEnd + lastCount };
  const pending = parseRawLinesToPending(newLines, ctx);
  target.setTailLastLineCount(contentLines.length);
  target.postMessage({ type: "addLines", lines: pending, lineCount: contentLines.length });
  helpers.sendNewCategories(pending, target.getSeenCategories(), (msg) => target.postMessage(msg));
}

/**
 * Handle one `onDidChange`: read the file, then act on {@link classifyTailChange}. The shrink branch
 * hands off to a host-driven full reload; growth appends; an unchanged count is a no-op.
 */
async function handleTailChange(
  uri: vscode.Uri,
  sessionMidnightMs: number,
  target: LogViewerTailTarget,
  hooks: TailExternalHooks,
): Promise<void> {
  const raw = await vscode.workspace.fs.readFile(uri);
  const rawLines = Buffer.from(raw).toString("utf-8").split(/\r?\n/);
  const headerEnd = findHeaderEnd(rawLines);
  const contentLines = rawLines.slice(headerEnd);
  const action = classifyTailChange(target.getTailLastLineCount(), contentLines.length);
  if (action === "reload") {
    hooks.onExternalReload(uri);
    return;
  }
  if (action === "noop") { return; }
  appendTailLines(sessionMidnightMs, target, contentLines, headerEnd);
}

/** Inputs for {@link createTailWatcher}. Bundled to stay within the 4-param limit. */
export interface TailWatcherOptions {
  readonly uri: vscode.Uri;
  readonly sessionMidnightMs: number;
  readonly initialLineCount: number;
  readonly target: LogViewerTailTarget;
  readonly hooks: TailExternalHooks;
}

/**
 * Create a file watcher that keeps the viewer in sync with external writes (plan 039b):
 * append on growth, full reload on truncate/rewrite/recreate, snapshot-keep + warn on delete.
 * Caller must dispose when done.
 */
export function createTailWatcher(o: TailWatcherOptions): vscode.Disposable {
  const { uri, sessionMidnightMs, target, hooks } = o;
  target.setTailLastLineCount(o.initialLineCount);
  const isCurrent = () => target.getCurrentFileUri()?.fsPath === uri.fsPath;
  const watcher = vscode.workspace.createFileSystemWatcher(uri.fsPath);
  watcher.onDidChange(async () => {
    if (!isCurrent() || !target.getView()) { return; }
    // Guard re-entrancy: rapid file changes can fire onDidChange again before we finish.
    if (target.getTailUpdateInProgress()) { return; }
    target.setTailUpdateInProgress(true);
    try {
      await handleTailChange(uri, sessionMidnightMs, target, hooks);
    } catch {
      // File may be locked or mid-write; the next onDidChange retries.
    } finally {
      target.setTailUpdateInProgress(false);
    }
  });
  // Recreate (a tool that unlinks-then-writes) reads as an external rewrite — reload, don't append.
  watcher.onDidCreate(() => { if (isCurrent()) { hooks.onExternalReload(uri); } });
  // Delete: keep the last in-memory snapshot (don't blank the viewer) and warn once.
  watcher.onDidDelete(() => { if (isCurrent()) { hooks.onExternalDelete(uri); } });
  return watcher;
}

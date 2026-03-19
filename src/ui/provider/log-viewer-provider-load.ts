/**
 * Load-from-file and tail watcher logic for LogViewerProvider.
 * Extracted to keep log-viewer-provider.ts under the line limit.
 */

import * as vscode from "vscode";
import { getConfig } from "../../modules/config/config";
import { SessionMetadataStore } from "../../modules/session/session-metadata";
import { UNIFIED_SESSION_LOG_SUFFIX } from "../../modules/session/unified-session-log-writer";
import { findHeaderEnd, sendFileLines, parseHeaderFields, computeSessionMidnight, parseTimeToMs, parseRawLinesToPending, parseTerminalSidecarToPending, parseExternalSidecarToPending, externalSidecarLabelFromFileName, parseUnifiedJsonlToPending, sendPendingLinesBatched, SOURCE_DEBUG, SOURCE_TERMINAL } from "../viewer/viewer-file-loader";
import { detectRunBoundaries, getRunStartIndices } from "../../modules/session/run-boundaries";
import { getRunSummaries } from "../../modules/session/run-summaries";
import { countSeverities } from "../session/session-severity-counts";
import { getEffectiveViewerLines } from "./viewer-content";
import * as helpers from "./viewer-provider-helpers";
import { getCorrelationByLocation } from "../../modules/correlation/correlation-store";
import { findFirstErrorLines, type FirstErrorResult } from "../../modules/bookmarks/first-error";
import { findSidecarUris } from "../../modules/context/context-loader";

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

type LoadContentResult = { sessionMidnightMs: number; contentLength: number } & LoadResultFirstError;

async function loadUnifiedSessionJsonlContent(
  target: LogViewerLoadTarget,
  uri: vscode.Uri,
  text: string,
  checkGen: () => boolean,
): Promise<LoadContentResult> {
  const cfgUnified = getConfig();
  const effectiveUnified = getEffectiveViewerLines(cfgUnified.maxLines, cfgUnified.viewerMaxLines ?? 0);
  target.setSessionInfo(null);

  const postUnified = (msg: unknown): void => { if (checkGen()) { target.postMessage(msg); } };

  // Unified JSONL has no header; derive absolute timestamp origin from the adjacent main log header.
  let sessionMidnightMs = 0;
  try {
    const mainLogPath = uri.fsPath.slice(0, -UNIFIED_SESSION_LOG_SUFFIX.length) + ".log";
    const mainLogUri = vscode.Uri.file(mainLogPath);
    const mainRaw = await vscode.workspace.fs.readFile(mainLogUri);
    const mainText = Buffer.from(mainRaw).toString("utf-8");
    const mainLines = mainText.split(/\r?\n/);
    const mainFields = parseHeaderFields(mainLines);
    sessionMidnightMs = computeSessionMidnight(mainFields["Date"] ?? "");
  } catch {
    // If main log is missing/unreadable, timestamps will remain 0.
    sessionMidnightMs = 0;
  }

  const unifiedBaseCtx = { classifyFrame: (t: string) => helpers.classifyFrame(t), sessionMidnightMs };
  // For run navigation + smart bookmarks we need raw lines (not PendingLine HTML).
  const unifiedRawLines: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (line.trim() === '') { continue; }
    let rec: unknown;
    try {
      rec = JSON.parse(line);
    } catch {
      continue;
    }
    const obj = rec as { source?: unknown; text?: unknown };
    if (typeof obj?.source !== 'string' || typeof obj?.text !== 'string') { continue; }
    unifiedRawLines.push(obj.text);
  }

  const { lines: unifiedAll, sources: unifiedSources } = parseUnifiedJsonlToPending(text, unifiedBaseCtx);
  let unifiedLines = unifiedAll;
  let unifiedRawLinesForView = unifiedRawLines;

  if (unifiedLines.length > effectiveUnified) {
    unifiedLines = unifiedLines.slice(0, effectiveUnified);
    unifiedRawLinesForView = unifiedRawLines.slice(0, unifiedLines.length);
    postUnified({ type: "loadTruncated", shown: effectiveUnified, total: unifiedAll.length });
  }

  postUnified({ type: "setSources", sources: unifiedSources, enabledSources: [...unifiedSources] });
  await sendPendingLinesBatched(unifiedLines, postUnified, target.getSeenCategories());

  if (!checkGen()) { return { sessionMidnightMs: 0, contentLength: 0 }; }

  // Run navigation + smart bookmarks: mirror the normal `.log` loader behavior.
  if (unifiedRawLinesForView.length > 0) {
    const boundaries = detectRunBoundaries(unifiedRawLinesForView);
    const runStartIndices = getRunStartIndices(boundaries);
    if (runStartIndices.length > 0) {
      const getTimestampForLine = (rawLine: string): number => {
        const m = rawLine.match(/^\[([\d:.]+)\]/);
        return m ? parseTimeToMs(m[1], sessionMidnightMs) : 0;
      };
      const countSeveritiesForSlice = (lines: string[]): { errors: number; warnings: number; perfs: number; infos: number } => {
        const c = countSeverities(lines.join('\n'));
        return { errors: c.errors, warnings: c.warnings, perfs: c.perfs, infos: c.infos };
      };
      const runSummaries = getRunSummaries(unifiedRawLinesForView, runStartIndices, getTimestampForLine, countSeveritiesForSlice);
      postUnified({ type: 'runBoundaries', boundaries, runStartIndices, runSummaries });
    }
  }

  let firstError: FirstErrorResult | undefined;
  let firstWarning: FirstErrorResult | undefined;
  if (cfgUnified.smartBookmarks.suggestFirstError || cfgUnified.smartBookmarks.suggestFirstWarning) {
    const found = findFirstErrorLines(unifiedRawLinesForView, {
      strict: cfgUnified.levelDetection === 'strict',
      includeWarning: cfgUnified.smartBookmarks.suggestFirstWarning,
    });
    firstError = found.firstError;
    firstWarning = found.firstWarning;
  }

  if (target.setHasPerformanceData) { target.setHasPerformanceData(false); }
  if (target.setCodeQualityPayload) { target.setCodeQualityPayload(null); }

  target.postMessage({ type: "loadComplete" });
  return {
    sessionMidnightMs,
    contentLength: unifiedLines.length,
    ...(firstError && { firstError }),
    ...(firstWarning && { firstWarning }),
  };
}

async function loadPerfAndCodeQualityPayload(
  target: LogViewerLoadTarget,
  uri: vscode.Uri,
  checkGen: () => boolean,
): Promise<{ cancelled: boolean; hasPerf: boolean; codeQualityPayload?: Record<string, unknown> }> {
  if (!target.setHasPerformanceData && !target.setCodeQualityPayload) {
    return { cancelled: false, hasPerf: false, codeQualityPayload: undefined };
  }

  let hasPerf = false;
  let codeQualityPayload: Record<string, unknown> | undefined = undefined;
  try {
    if (!checkGen()) { return { cancelled: true, hasPerf: false, codeQualityPayload: undefined }; }
    const store = new SessionMetadataStore();
    const meta = await store.loadMetadata(uri);
    if (!checkGen()) { return { cancelled: true, hasPerf: false, codeQualityPayload: undefined }; }

    const perf = meta.integrations?.performance as Record<string, unknown> | undefined;
    hasPerf = !!(perf && typeof perf === "object" && ((perf.snapshot !== null && perf.snapshot !== undefined) || (typeof perf.samplesFile === "string" && perf.samplesFile.length > 0)));

    const cq = meta.integrations?.codeQuality;
    if (cq && typeof cq === "object" && cq !== null && "files" in cq) {
      codeQualityPayload = cq as Record<string, unknown>;
    }
  } catch {
    // ignore
  }

  return { cancelled: false, hasPerf, codeQualityPayload };
}

function truncateMainContentLines(
  rawLines: readonly string[],
): { headerEnd: number; contentLines: string[]; didTruncate: boolean; truncatedShown: number } {
  const headerEnd = findHeaderEnd(rawLines);
  let contentLines = rawLines.slice(headerEnd);
  const cfg = getConfig();
  const effectiveViewerLines = getEffectiveViewerLines(cfg.maxLines, cfg.viewerMaxLines ?? 0);

  let didTruncate = false;
  let truncatedShown = effectiveViewerLines;

  if (contentLines.length > effectiveViewerLines) {
    contentLines = contentLines.slice(0, effectiveViewerLines);
    didTruncate = true;
  }

  return { headerEnd, contentLines, didTruncate, truncatedShown };
}

function buildMainCtx(fields: Record<string, string>, source: string) {
  return {
    classifyFrame: (t: string) => helpers.classifyFrame(t),
    sessionMidnightMs: computeSessionMidnight(fields["Date"] ?? ""),
    source,
  };
}

function getMainBaseFromFsPath(fsPath: string): string {
  return (fsPath.split(/[/\\]/).pop() ?? "").replace(/\.[^.]+$/, "") || "log";
}

function collectViewerSourcesForSidecars(
  mainBase: string,
  terminalSidecar: vscode.Uri | undefined,
  externalSidecars: readonly vscode.Uri[],
): string[] {
  const sources: string[] = [SOURCE_DEBUG];
  if (terminalSidecar) { sources.push(SOURCE_TERMINAL); }
  for (const sidecarUri of externalSidecars) {
    const sidecarName = sidecarUri.fsPath.split(/[/\\]/).pop() ?? "";
    const label = externalSidecarLabelFromFileName(mainBase, sidecarName);
    const sourceId = "external:" + label;
    if (!sources.includes(sourceId)) { sources.push(sourceId); }
  }
  return sources;
}

async function appendTerminalSidecarLines(
  terminalSidecar: vscode.Uri | undefined,
  totalLineCount: number,
  checkGen: () => boolean,
  post: (msg: unknown) => void,
  target: LogViewerLoadTarget & { getSeenCategories(): Set<string> },
): Promise<{ cancelled: boolean; totalLineCount: number }> {
  if (!terminalSidecar) { return { cancelled: false, totalLineCount }; }

  try {
    const termRaw = await vscode.workspace.fs.readFile(terminalSidecar);
    if (!checkGen()) { return { cancelled: true, totalLineCount }; }

    const termContent = Buffer.from(termRaw).toString("utf-8");
    const termLines = parseTerminalSidecarToPending(termContent);
    if (termLines.length > 0 && checkGen()) {
      totalLineCount += termLines.length;
      post({ type: "addLines", lines: termLines, lineCount: totalLineCount });
      helpers.sendNewCategories(termLines, target.getSeenCategories(), (m) => post(m));
    }
  } catch {
    // Sidecar read failed, skip; main log already loaded.
  }

  return { cancelled: false, totalLineCount };
}

async function appendExternalSidecarLines(
  externalSidecars: readonly vscode.Uri[],
  mainBase: string,
  totalLineCount: number,
  checkGen: () => boolean,
  post: (msg: unknown) => void,
  target: LogViewerLoadTarget & { getSeenCategories(): Set<string> },
): Promise<{ cancelled: boolean; totalLineCount: number }> {
  let currentCount = totalLineCount;
  for (const sidecarUri of externalSidecars) {
    try {
      const raw = await vscode.workspace.fs.readFile(sidecarUri);
      if (!checkGen()) { return { cancelled: true, totalLineCount: currentCount }; }

      const content = Buffer.from(raw).toString("utf-8");
      const sidecarName = sidecarUri.fsPath.split(/[/\\]/).pop() ?? "";
      const label = externalSidecarLabelFromFileName(mainBase, sidecarName);
      const extLines = parseExternalSidecarToPending(content, label);
      if (extLines.length > 0 && checkGen()) {
        currentCount += extLines.length;
        post({ type: "addLines", lines: extLines, lineCount: currentCount });
        helpers.sendNewCategories(extLines, target.getSeenCategories(), (m) => post(m));
      }
    } catch {
      // External sidecar read failed, skip.
    }
  }

  if (!checkGen()) { return { cancelled: true, totalLineCount: currentCount }; }
  return { cancelled: false, totalLineCount: currentCount };
}

function postRunBoundariesIfAny(
  contentLines: readonly string[],
  ctx: { sessionMidnightMs: number },
  post: (msg: unknown) => void,
): void {
  const boundaries = detectRunBoundaries(contentLines);
  const runStartIndices = getRunStartIndices(boundaries);
  if (runStartIndices.length === 0) { return; }

  const tsRe = /^\[([\d:.]+)\]/;
  const getTimestampForLine = (raw: string): number => {
    const m = tsRe.exec(raw);
    return m ? parseTimeToMs(m[1], ctx.sessionMidnightMs) : 0;
  };

  const countSeveritiesForSlice = (lines: string[]): { errors: number; warnings: number; perfs: number; infos: number } => {
    const c = countSeverities(lines.join("\n"));
    return { errors: c.errors, warnings: c.warnings, perfs: c.perfs, infos: c.infos };
  };

  const runSummaries = getRunSummaries(contentLines, runStartIndices, getTimestampForLine, countSeveritiesForSlice);
  post({ type: "runBoundaries", boundaries, runStartIndices, runSummaries });
}

function postCorrelationByLineIndex(
  uri: vscode.Uri,
  byLoc: Iterable<[string, { id: string; description: string }]>,
  headerEnd: number,
  contentLinesLength: number,
  post: (msg: unknown) => void,
): void {
  const correlationByLineIndex: Record<number, { id: string; description: string }> = {};
  const uriStr = uri.toString();

  for (const [key, value] of byLoc) {
    const colon = key.indexOf(":");
    if (colon === -1) { continue; }
    const file = key.slice(0, colon);
    if (file !== uriStr) { continue; }

    const line = Number.parseInt(key.slice(colon + 1), 10);
    if (!Number.isFinite(line)) { continue; }

    const contentIdx = line - 1 - headerEnd;
    if (contentIdx >= 0 && contentIdx < contentLinesLength) {
      correlationByLineIndex[contentIdx] = value;
    }
  }

  if (Object.keys(correlationByLineIndex).length > 0) {
    post({ type: "setCorrelationByLineIndex", correlationByLineIndex });
  }
}

function getSmartBookmarksFirstErrorAndWarning(
  cfg: ReturnType<typeof getConfig>,
  contentLines: readonly string[],
): { firstError?: FirstErrorResult; firstWarning?: FirstErrorResult } {
  if (!cfg.smartBookmarks.suggestFirstError && !cfg.smartBookmarks.suggestFirstWarning) {
    return {};
  }

  const found = findFirstErrorLines(contentLines, {
    strict: cfg.levelDetection === "strict",
    includeWarning: cfg.smartBookmarks.suggestFirstWarning,
  });
  return { firstError: found.firstError, firstWarning: found.firstWarning };
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

  let totalLineCount = contentLines.length;
  const terminalRes = await appendTerminalSidecarLines(terminalSidecar, totalLineCount, checkGen, post, target);
  if (terminalRes.cancelled) { return { sessionMidnightMs: 0, contentLength: 0 }; }

  const externalRes = await appendExternalSidecarLines(externalSidecars, mainBase, terminalRes.totalLineCount, checkGen, post, target);
  if (externalRes.cancelled) { return { sessionMidnightMs: 0, contentLength: 0 }; }

  postRunBoundariesIfAny(contentLines, ctx, post);

  // Map correlation data to content line index for viewer badges (main log only; key is "file:line").
  const byLoc = getCorrelationByLocation(uri.toString());
  postCorrelationByLineIndex(uri, byLoc as Iterable<[string, { id: string; description: string }]>, headerEnd, contentLines.length, post);

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

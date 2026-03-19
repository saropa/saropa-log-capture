import * as vscode from "vscode";
import { getConfig } from "../../modules/config/config";
import { SessionMetadataStore } from "../../modules/session/session-metadata";
import { UNIFIED_SESSION_LOG_SUFFIX } from "../../modules/session/unified-session-log-writer";
import { findHeaderEnd, parseHeaderFields, computeSessionMidnight, parseTimeToMs, sendPendingLinesBatched, parseUnifiedJsonlToPending, SOURCE_DEBUG, SOURCE_TERMINAL, externalSidecarLabelFromFileName, parseTerminalSidecarToPending, parseExternalSidecarToPending } from "../viewer/viewer-file-loader";
import { detectRunBoundaries, getRunStartIndices } from "../../modules/session/run-boundaries";
import { countSeverities } from "../session/session-severity-counts";
import { getRunSummaries } from "../../modules/session/run-summaries";
import { getEffectiveViewerLines } from "./viewer-content";
import { findFirstErrorLines, type FirstErrorResult } from "../../modules/bookmarks/first-error";
import * as helpers from "./viewer-provider-helpers";

interface LoadTarget {
  postMessage(msg: unknown): void;
  setSessionInfo(info: Record<string, string> | null): void;
  setHasPerformanceData?(has: boolean): void;
  setCodeQualityPayload?(payload: unknown): void;
  getSeenCategories(): Set<string>;
}

export interface LoadContentResultLike {
  sessionMidnightMs: number;
  contentLength: number;
  firstError?: FirstErrorResult;
  firstWarning?: FirstErrorResult;
}

export async function loadUnifiedSessionJsonlContent(
  target: LoadTarget,
  uri: vscode.Uri,
  text: string,
  checkGen: () => boolean,
): Promise<LoadContentResultLike> {
  const cfgUnified = getConfig();
  const effectiveUnified = getEffectiveViewerLines(cfgUnified.maxLines, cfgUnified.viewerMaxLines ?? 0);
  target.setSessionInfo(null);
  const postUnified = (msg: unknown): void => { if (checkGen()) { target.postMessage(msg); } };
  let sessionMidnightMs = 0;
  try {
    const mainLogPath = uri.fsPath.slice(0, -UNIFIED_SESSION_LOG_SUFFIX.length) + ".log";
    const mainRaw = await vscode.workspace.fs.readFile(vscode.Uri.file(mainLogPath));
    const mainFields = parseHeaderFields(Buffer.from(mainRaw).toString("utf-8").split(/\r?\n/));
    sessionMidnightMs = computeSessionMidnight(mainFields["Date"] ?? "");
  } catch {
    sessionMidnightMs = 0;
  }
  const unifiedBaseCtx = { classifyFrame: (t: string) => helpers.classifyFrame(t), sessionMidnightMs };
  const unifiedRawLines: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (line.trim() === '') { continue; }
    try {
      const obj = JSON.parse(line) as { source?: unknown; text?: unknown };
      if (typeof obj?.source === 'string' && typeof obj?.text === 'string') { unifiedRawLines.push(obj.text); }
    } catch {
      // ignore malformed jsonl records
    }
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
  postRunBoundariesIfAny(unifiedRawLinesForView, { sessionMidnightMs }, postUnified);
  const smart = getSmartBookmarksFirstErrorAndWarning(cfgUnified, unifiedRawLinesForView);
  if (target.setHasPerformanceData) { target.setHasPerformanceData(false); }
  if (target.setCodeQualityPayload) { target.setCodeQualityPayload(null); }
  target.postMessage({ type: "loadComplete" });
  return { sessionMidnightMs, contentLength: unifiedLines.length, ...smart };
}

export async function loadPerfAndCodeQualityPayload(
  target: LoadTarget,
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
    const meta = await new SessionMetadataStore().loadMetadata(uri);
    if (!checkGen()) { return { cancelled: true, hasPerf: false, codeQualityPayload: undefined }; }
    const perf = meta.integrations?.performance as Record<string, unknown> | undefined;
    hasPerf = !!(perf && typeof perf === "object" && ((perf.snapshot !== null && perf.snapshot !== undefined) || (typeof perf.samplesFile === "string" && perf.samplesFile.length > 0)));
    const cq = meta.integrations?.codeQuality;
    if (cq && typeof cq === "object" && cq !== null && "files" in cq) { codeQualityPayload = cq as Record<string, unknown>; }
  } catch {
    // ignore
  }
  return { cancelled: false, hasPerf, codeQualityPayload };
}

export function truncateMainContentLines(rawLines: readonly string[]): { headerEnd: number; contentLines: string[]; didTruncate: boolean; truncatedShown: number } {
  const headerEnd = findHeaderEnd(rawLines);
  let contentLines = rawLines.slice(headerEnd);
  const cfg = getConfig();
  const truncatedShown = getEffectiveViewerLines(cfg.maxLines, cfg.viewerMaxLines ?? 0);
  const didTruncate = contentLines.length > truncatedShown;
  if (didTruncate) { contentLines = contentLines.slice(0, truncatedShown); }
  return { headerEnd, contentLines, didTruncate, truncatedShown };
}

export function buildMainCtx(fields: Record<string, string>, source: string): { classifyFrame: (text: string) => boolean | undefined; sessionMidnightMs: number; source: string } {
  return { classifyFrame: (t: string) => helpers.classifyFrame(t), sessionMidnightMs: computeSessionMidnight(fields["Date"] ?? ""), source };
}

export function getMainBaseFromFsPath(fsPath: string): string {
  return (fsPath.split(/[/\\]/).pop() ?? "").replace(/\.[^.]+$/, "") || "log";
}

export function collectViewerSourcesForSidecars(mainBase: string, terminalSidecar: vscode.Uri | undefined, externalSidecars: readonly vscode.Uri[]): string[] {
  const sources: string[] = [SOURCE_DEBUG];
  if (terminalSidecar) { sources.push(SOURCE_TERMINAL); }
  for (const sidecarUri of externalSidecars) {
    const label = externalSidecarLabelFromFileName(mainBase, sidecarUri.fsPath.split(/[/\\]/).pop() ?? "");
    const sourceId = "external:" + label;
    if (!sources.includes(sourceId)) { sources.push(sourceId); }
  }
  return sources;
}

export async function appendTerminalSidecarLines(opts: {
  terminalSidecar: vscode.Uri | undefined;
  totalLineCount: number;
  checkGen: () => boolean;
  post: (msg: unknown) => void;
  target: LoadTarget;
}): Promise<{ cancelled: boolean; totalLineCount: number }> {
  const { terminalSidecar, totalLineCount, checkGen, post, target } = opts;
  if (!terminalSidecar) { return { cancelled: false, totalLineCount }; }
  try {
    const termRaw = await vscode.workspace.fs.readFile(terminalSidecar);
    if (!checkGen()) { return { cancelled: true, totalLineCount }; }
    const termLines = parseTerminalSidecarToPending(Buffer.from(termRaw).toString("utf-8"));
    if (termLines.length > 0 && checkGen()) {
      const nextCount = totalLineCount + termLines.length;
      post({ type: "addLines", lines: termLines, lineCount: nextCount });
      helpers.sendNewCategories(termLines, target.getSeenCategories(), (m) => post(m));
      return { cancelled: false, totalLineCount: nextCount };
    }
  } catch {
    // ignore sidecar read failure
  }
  return { cancelled: false, totalLineCount };
}

export async function appendExternalSidecarLines(opts: {
  externalSidecars: readonly vscode.Uri[];
  mainBase: string;
  totalLineCount: number;
  checkGen: () => boolean;
  post: (msg: unknown) => void;
  target: LoadTarget;
}): Promise<{ cancelled: boolean; totalLineCount: number }> {
  const { externalSidecars, mainBase, totalLineCount, checkGen, post, target } = opts;
  let currentCount = totalLineCount;
  for (const sidecarUri of externalSidecars) {
    try {
      const raw = await vscode.workspace.fs.readFile(sidecarUri);
      if (!checkGen()) { return { cancelled: true, totalLineCount: currentCount }; }
      const sidecarName = sidecarUri.fsPath.split(/[/\\]/).pop() ?? "";
      const label = externalSidecarLabelFromFileName(mainBase, sidecarName);
      const extLines = parseExternalSidecarToPending(Buffer.from(raw).toString("utf-8"), label);
      if (extLines.length > 0 && checkGen()) {
        currentCount += extLines.length;
        post({ type: "addLines", lines: extLines, lineCount: currentCount });
        helpers.sendNewCategories(extLines, target.getSeenCategories(), (m) => post(m));
      }
    } catch {
      // skip unreadable sidecar
    }
  }
  return { cancelled: !checkGen(), totalLineCount: currentCount };
}

export function postRunBoundariesIfAny(contentLines: readonly string[], ctx: { sessionMidnightMs: number }, post: (msg: unknown) => void): void {
  const boundaries = detectRunBoundaries(contentLines);
  const runStartIndices = getRunStartIndices(boundaries);
  if (runStartIndices.length === 0) { return; }
  const getTimestampForLine = (raw: string): number => {
    const m = /^\[([\d:.]+)\]/.exec(raw);
    return m ? parseTimeToMs(m[1], ctx.sessionMidnightMs) : 0;
  };
  const countSeveritiesForSlice = (lines: string[]): { errors: number; warnings: number; perfs: number; infos: number } => {
    const c = countSeverities(lines.join("\n"));
    return { errors: c.errors, warnings: c.warnings, perfs: c.perfs, infos: c.infos };
  };
  const runSummaries = getRunSummaries(contentLines, runStartIndices, getTimestampForLine, countSeveritiesForSlice);
  post({ type: "runBoundaries", boundaries, runStartIndices, runSummaries });
}

export function postCorrelationByLineIndex(opts: {
  uri: vscode.Uri;
  byLoc: Iterable<[string, { id: string; description: string }]>;
  headerEnd: number;
  contentLinesLength: number;
  post: (msg: unknown) => void;
}): void {
  const { uri, byLoc, headerEnd, contentLinesLength, post } = opts;
  const correlationByLineIndex: Record<number, { id: string; description: string }> = {};
  const uriStr = uri.toString();
  for (const [key, value] of byLoc) {
    const colon = key.indexOf(":");
    if (colon === -1 || key.slice(0, colon) !== uriStr) { continue; }
    const line = Number.parseInt(key.slice(colon + 1), 10);
    const contentIdx = line - 1 - headerEnd;
    if (Number.isFinite(line) && contentIdx >= 0 && contentIdx < contentLinesLength) {
      correlationByLineIndex[contentIdx] = value;
    }
  }
  if (Object.keys(correlationByLineIndex).length > 0) {
    post({ type: "setCorrelationByLineIndex", correlationByLineIndex });
  }
}

export function getSmartBookmarksFirstErrorAndWarning(
  cfg: ReturnType<typeof getConfig>,
  contentLines: readonly string[],
): { firstError?: FirstErrorResult; firstWarning?: FirstErrorResult } {
  if (!cfg.smartBookmarks.suggestFirstError && !cfg.smartBookmarks.suggestFirstWarning) { return {}; }
  const found = findFirstErrorLines(contentLines, {
    strict: cfg.levelDetection === "strict",
    includeWarning: cfg.smartBookmarks.suggestFirstWarning,
  });
  return { firstError: found.firstError, firstWarning: found.firstWarning };
}

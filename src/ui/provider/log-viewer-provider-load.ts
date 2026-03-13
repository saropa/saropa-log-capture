/**
 * Load-from-file and tail watcher logic for LogViewerProvider.
 * Extracted to keep log-viewer-provider.ts under the line limit.
 */

import * as vscode from "vscode";
import { getConfig } from "../../modules/config/config";
import { SessionMetadataStore } from "../../modules/session/session-metadata";
import { findHeaderEnd, sendFileLines, parseHeaderFields, computeSessionMidnight, parseTimeToMs, parseRawLinesToPending } from "../viewer/viewer-file-loader";
import { detectRunBoundaries, getRunStartIndices } from "../../modules/session/run-boundaries";
import { getRunSummaries } from "../../modules/session/run-summaries";
import { countSeverities } from "../session/session-severity-counts";
import { getEffectiveViewerLines } from "./viewer-content";
import * as helpers from "./viewer-provider-helpers";
import { getCorrelationByLocation } from "../../modules/correlation/correlation-store";

export interface LogViewerLoadTarget {
  postMessage(msg: unknown): void;
  setFilename(name: string): void;
  setSessionInfo(info: Record<string, string> | null): void;
  setHasPerformanceData?(has: boolean): void;
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

/**
 * Execute the core load: read file, parse header, send content lines, run boundaries.
 * Returns { sessionMidnightMs, contentLength } for optional tailing.
 */
export async function executeLoadContent(
  target: LogViewerLoadTarget,
  uri: vscode.Uri,
  checkGen: () => boolean,
): Promise<{ sessionMidnightMs: number; contentLength: number }> {
  const raw = await vscode.workspace.fs.readFile(uri);
  if (!checkGen()) { return { sessionMidnightMs: 0, contentLength: 0 }; }
  const text = Buffer.from(raw).toString("utf-8");
  const rawLines = text.split(/\r?\n/);
  target.postMessage({ type: "setViewingMode", viewing: true });
  target.setFilename(vscode.workspace.asRelativePath(uri, false));
  const fields = parseHeaderFields(rawLines);
  if (Object.keys(fields).length > 0) { target.setSessionInfo(fields); }
  if (target.setHasPerformanceData) {
    try {
      const store = new SessionMetadataStore();
      const meta = await store.loadMetadata(uri);
      if (!checkGen()) { return { sessionMidnightMs: 0, contentLength: 0 }; /* load superseded */
      const perf = meta.integrations?.performance as Record<string, unknown> | undefined;
      const has = !!(perf && typeof perf === "object" && (perf.snapshot != null || (typeof perf.samplesFile === "string" && perf.samplesFile.length > 0)));
      target.setHasPerformanceData(has);
    } catch {
      target.setHasPerformanceData(false);
    }
  }
  const headerEnd = findHeaderEnd(rawLines);
  let contentLines = rawLines.slice(headerEnd);
  const cfg = getConfig();
  const effectiveViewerLines = getEffectiveViewerLines(cfg.maxLines, cfg.viewerMaxLines ?? 0);
  if (contentLines.length > effectiveViewerLines) {
    contentLines = contentLines.slice(0, effectiveViewerLines);
    target.postMessage({ type: "loadTruncated", shown: effectiveViewerLines, total: rawLines.length - headerEnd });
  }
  const post = (msg: unknown): void => { if (checkGen()) { target.postMessage(msg); } };
  const ctx = { classifyFrame: (t: string) => helpers.classifyFrame(t), sessionMidnightMs: computeSessionMidnight(fields['Date'] ?? '') };
  await sendFileLines(contentLines, ctx, post, target.getSeenCategories());
  if (!checkGen()) { return { sessionMidnightMs: 0, contentLength: 0 }; }
  const boundaries = detectRunBoundaries(contentLines);
  const runStartIndices = getRunStartIndices(boundaries);
  if (runStartIndices.length > 0) {
    const getTimestampForLine = (raw: string): number => {
      const m = raw.match(/^\[([\d:.]+)\]/);
      return m ? parseTimeToMs(m[1], ctx.sessionMidnightMs) : 0;
    };
    const countSeveritiesForSlice = (lines: string[]): { errors: number; warnings: number; perfs: number; infos: number } => {
      const c = countSeverities(lines.join("\n"));
      return { errors: c.errors, warnings: c.warnings, perfs: c.perfs, infos: c.infos };
    };
    const runSummaries = getRunSummaries(contentLines, runStartIndices, getTimestampForLine, countSeveritiesForSlice);
    post({ type: "runBoundaries", boundaries, runStartIndices, runSummaries });
  }
  // Map correlation data to content line index for viewer badges (main log only; key is "file:line").
  const byLoc = getCorrelationByLocation(uri.toString());
  const correlationByLineIndex: Record<number, { id: string; description: string }> = {};
  for (const [key, value] of byLoc) {
    const colon = key.indexOf(":");
    if (colon === -1) { continue; }
    const file = key.slice(0, colon);
    if (file !== uri.toString()) { continue; }
    const line = parseInt(key.slice(colon + 1), 10);
    if (!Number.isFinite(line)) { continue; }
    const contentIdx = line - 1 - headerEnd;
    if (contentIdx >= 0 && contentIdx < contentLines.length) { correlationByLineIndex[contentIdx] = value; }
  }
  if (Object.keys(correlationByLineIndex).length > 0) { post({ type: "setCorrelationByLineIndex", correlationByLineIndex }); }
  target.postMessage({ type: "loadComplete" });
  return { sessionMidnightMs: ctx.sessionMidnightMs, contentLength: contentLines.length };
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

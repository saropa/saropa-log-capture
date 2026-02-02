/**
 * Shared interface for any webview surface that displays captured log output.
 *
 * Both the sidebar LogViewerProvider and the pop-out PopOutPanel implement
 * this so the ViewerBroadcaster can dispatch state changes to all targets.
 */

import type * as vscode from "vscode";
import type { LineData } from "../modules/session-manager";
import type { HighlightRule } from "../modules/highlight-rules";
import type { FilterPreset } from "../modules/filter-presets";
import type { SessionDisplayOptions } from "./session-display";

/** Contract for a webview that renders captured debug output. */
export interface ViewerTarget {
  addLine(data: LineData): void;
  clear(): void;
  setPaused(paused: boolean): void;
  setFilename(filename: string): void;
  setExclusions(patterns: readonly string[]): void;
  setAnnotation(lineIndex: number, text: string): void;
  loadAnnotations(annotations: readonly { lineIndex: number; text: string }[]): void;
  setSplitInfo(currentPart: number, totalParts: number): void;
  updateFooter(text: string): void;
  setContextLines(count: number): void;
  setContextViewLines(count: number): void;
  setShowElapsed(show: boolean): void;
  setShowDecorations(show: boolean): void;
  setErrorClassificationSettings(suppress: boolean, breakOn: boolean): void;
  applyPreset(name: string): void;
  setHighlightRules(rules: readonly HighlightRule[]): void;
  setPresets(presets: readonly FilterPreset[]): void;
  setCurrentFile(uri: vscode.Uri | undefined): void;
  setSessionInfo(info: Record<string, string> | null): void;
  sendSessionList(sessions: readonly Record<string, unknown>[]): void;
  sendDisplayOptions(options: SessionDisplayOptions): void;
  setSessionActive(active: boolean): void;
  updateWatchCounts(counts: ReadonlyMap<string, number>): void;
}

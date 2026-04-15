/**
 * Shared interface for any webview surface that displays captured log output.
 *
 * Both the sidebar LogViewerProvider and the pop-out PopOutPanel implement
 * this so the ViewerBroadcaster can dispatch state changes to all targets.
 */

import type * as vscode from "vscode";
import type { LineData } from "../../modules/session/session-manager";
import type { PendingLine } from "../viewer/viewer-file-loader";
import type { HighlightRule } from "../../modules/storage/highlight-rules";
import type { FilterPreset } from "../../modules/storage/filter-presets";
import type { ScopeContext } from "../../modules/storage/scope-context";
import type { ViewerRepeatThresholds } from "../../modules/db/drift-db-repeat-thresholds";
import type { ViewerSlowBurstThresholds } from "../../modules/db/drift-db-slow-burst-thresholds";
import type { SessionDisplayOptions } from "../session/session-display";
import type { PersistedDriftSqlFingerprintEntryV1 } from "../../modules/db/drift-sql-fingerprint-summary-persist";
import type { ErrorClassificationSettings, ErrorRateConfig, ViewerDbDetectorToggles } from "../../modules/config/config-types";

/** Contract for a webview that renders captured debug output. */
export interface ViewerTarget {
  addLine(data: LineData): void;
  /**
   * Live line with HTML already built; raw text is only for thread-dump grouping.
   * Used by ViewerBroadcaster to avoid duplicate ANSI/linkify work across targets.
   */
  appendLiveLineFromBroadcast(line: PendingLine, rawText: string): void;
  /** Pop-out: true while hydrating from disk so addLine can buffer raw LineData. */
  isLiveCaptureHydrating?(): boolean;
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
  setCopyContextLines(count: number): void;
  setShowElapsed(show: boolean): void;
  setErrorClassificationSettings(settings: ErrorClassificationSettings): void;
  applyPreset(name: string): void;
  setHighlightRules(rules: readonly HighlightRule[]): void;
  setPresets(presets: readonly FilterPreset[]): void;
  setCurrentFile(uri: vscode.Uri | undefined): void;
  setSessionInfo(info: Record<string, string> | null): void;
  setHasPerformanceData(has: boolean): void;
  sendSessionList(sessions: readonly Record<string, unknown>[], rootInfo?: { label: string; path: string; isDefault: boolean }): void;
  sendSessionListLoading(folderPath: string): void;
  sendDisplayOptions(options: SessionDisplayOptions): void;
  setSessionActive(active: boolean): void;
  updateWatchCounts(counts: ReadonlyMap<string, number>): void;
  sendBookmarkList(files: Record<string, unknown>): void;
  setScopeContext(context: ScopeContext): void;
  setMinimapShowInfo(show: boolean): void;
  setMinimapShowSqlDensity(show: boolean): void;
  setMinimapProportionalLines(show: boolean): void;
  setMinimapViewportRedOutline(show: boolean): void;
  setMinimapViewportOutsideArrow(show: boolean): void;
  setViewerRepeatThresholds(thresholds: ViewerRepeatThresholds): void;
  setViewerDbSignalsEnabled(enabled: boolean): void;
  setStaticSqlFromFingerprintEnabled(enabled: boolean): void;
  setViewerDbDetectorToggles(toggles: ViewerDbDetectorToggles): void;
  setViewerSlowBurstThresholds(thresholds: ViewerSlowBurstThresholds): void;

  setMinimapWidth(width: "xsmall" | "small" | "medium" | "large" | "xlarge"): void;
  setScrollbarVisible(show: boolean): void;
  setSearchMatchOptionsAlwaysVisible(always: boolean): void;
  setIconBarPosition(position: "left" | "right"): void;
  setErrorRateConfig(config: ErrorRateConfig): void;
  setAutoHidePatterns(patterns: readonly string[]): void;
  /**
   * Optional DB_10 / DB_15: normalized fingerprint → summary entry for compare-aware detectors in the viewer.
   * Pass null to clear.
   */
  setDbBaselineFingerprintSummary(
    entries: Readonly<Record<string, PersistedDriftSqlFingerprintEntryV1>> | null,
  ): void;
  /** Push an arbitrary message to the webview (e.g. learning options). */
  postToWebview(message: unknown): void;
}

/**
 * Broadcasts viewer state changes to all registered ViewerTarget instances.
 *
 * Used by extension.ts to send data to both the sidebar LogViewerProvider
 * and the pop-out PopOutPanel without duplicating every call.
 */

import type * as vscode from "vscode";
import type { ViewerRepeatThresholds } from "../../modules/db/drift-db-repeat-thresholds";
import type { ViewerSlowBurstThresholds } from "../../modules/db/drift-db-slow-burst-thresholds";
import type { LineData } from "../../modules/session/session-manager";
import type { HighlightRule } from "../../modules/storage/highlight-rules";
import type { FilterPreset } from "../../modules/storage/filter-presets";
import type { ScopeContext } from "../../modules/storage/scope-context";
import type { SessionDisplayOptions } from "../session/session-display";
import type { ViewerTarget } from "../viewer/viewer-target";
import type { PersistedDriftSqlFingerprintEntryV1 } from "../../modules/db/drift-sql-fingerprint-summary-persist";
import type { ViewerDbDetectorToggles } from "../../modules/config/config-types";

/** Dispatches every ViewerTarget method to all registered targets. */
export class ViewerBroadcaster implements ViewerTarget {
  private readonly targets = new Set<ViewerTarget>();

  /** Register a target to receive broadcasts. */
  addTarget(target: ViewerTarget): void { this.targets.add(target); }

  /** Unregister a target. */
  removeTarget(target: ViewerTarget): void { this.targets.delete(target); }

  addLine(data: LineData): void {
    for (const t of this.targets) { t.addLine(data); }
  }
  clear(): void {
    for (const t of this.targets) { t.clear(); }
  }
  setPaused(paused: boolean): void {
    for (const t of this.targets) { t.setPaused(paused); }
  }
  setFilename(filename: string): void {
    for (const t of this.targets) { t.setFilename(filename); }
  }
  setExclusions(patterns: readonly string[]): void {
    for (const t of this.targets) { t.setExclusions(patterns); }
  }
  setAnnotation(lineIndex: number, text: string): void {
    for (const t of this.targets) { t.setAnnotation(lineIndex, text); }
  }
  loadAnnotations(annotations: readonly { lineIndex: number; text: string }[]): void {
    for (const t of this.targets) { t.loadAnnotations(annotations); }
  }
  setSplitInfo(currentPart: number, totalParts: number): void {
    for (const t of this.targets) { t.setSplitInfo(currentPart, totalParts); }
  }
  updateFooter(text: string): void {
    for (const t of this.targets) { t.updateFooter(text); }
  }
  setContextLines(count: number): void {
    for (const t of this.targets) { t.setContextLines(count); }
  }
  setContextViewLines(count: number): void {
    for (const t of this.targets) { t.setContextViewLines(count); }
  }
  setCopyContextLines(count: number): void {
    for (const t of this.targets) { t.setCopyContextLines(count); }
  }
  setShowElapsed(show: boolean): void {
    for (const t of this.targets) { t.setShowElapsed(show); }
  }
  setShowDecorations(show: boolean): void {
    for (const t of this.targets) { t.setShowDecorations(show); }
  }
  setErrorClassificationSettings(suppress: boolean, breakOn: boolean, detection: string, deemphasizeFw: boolean): void {
    for (const t of this.targets) { t.setErrorClassificationSettings(suppress, breakOn, detection, deemphasizeFw); }
  }
  applyPreset(name: string): void {
    for (const t of this.targets) { t.applyPreset(name); }
  }
  setHighlightRules(rules: readonly HighlightRule[]): void {
    for (const t of this.targets) { t.setHighlightRules(rules); }
  }
  setPresets(presets: readonly FilterPreset[]): void {
    for (const t of this.targets) { t.setPresets(presets); }
  }
  setCurrentFile(uri: vscode.Uri | undefined): void {
    for (const t of this.targets) { t.setCurrentFile(uri); }
  }
  setSessionInfo(info: Record<string, string> | null): void {
    for (const t of this.targets) { t.setSessionInfo(info); }
  }
  setHasPerformanceData(has: boolean): void {
    for (const t of this.targets) { t.setHasPerformanceData(has); }
  }
  sendSessionList(sessions: readonly Record<string, unknown>[], rootInfo?: { label: string; path: string; isDefault: boolean }): void {
    for (const t of this.targets) { t.sendSessionList(sessions, rootInfo); }
  }
  sendSessionListLoading(folderPath: string): void {
    for (const t of this.targets) { t.sendSessionListLoading(folderPath); }
  }
  sendDisplayOptions(options: SessionDisplayOptions): void {
    for (const t of this.targets) { t.sendDisplayOptions(options); }
  }
  setSessionActive(active: boolean): void {
    for (const t of this.targets) { t.setSessionActive(active); }
  }
  updateWatchCounts(counts: ReadonlyMap<string, number>): void {
    for (const t of this.targets) { t.updateWatchCounts(counts); }
  }
  sendBookmarkList(files: Record<string, unknown>): void {
    for (const t of this.targets) { t.sendBookmarkList(files); }
  }
  setScopeContext(context: ScopeContext): void {
    for (const t of this.targets) { t.setScopeContext(context); }
  }
  setMinimapShowInfo(show: boolean): void {
    for (const t of this.targets) { t.setMinimapShowInfo(show); }
  }
  setMinimapShowSqlDensity(show: boolean): void {
    for (const t of this.targets) { t.setMinimapShowSqlDensity(show); }
  }
  setViewerRepeatThresholds(thresholds: ViewerRepeatThresholds): void {
    for (const t of this.targets) { t.setViewerRepeatThresholds(thresholds); }
  }
  setViewerDbInsightsEnabled(enabled: boolean): void {
    for (const t of this.targets) { t.setViewerDbInsightsEnabled(enabled); }
  }
  setStaticSqlFromFingerprintEnabled(enabled: boolean): void {
    for (const t of this.targets) { t.setStaticSqlFromFingerprintEnabled(enabled); }
  }
  setViewerDbDetectorToggles(toggles: ViewerDbDetectorToggles): void {
    for (const t of this.targets) { t.setViewerDbDetectorToggles(toggles); }
  }
  setViewerSlowBurstThresholds(thresholds: ViewerSlowBurstThresholds): void {
    for (const t of this.targets) { t.setViewerSlowBurstThresholds(thresholds); }
  }
  setViewerSqlPatternChipSettings(chipMinCount: number, chipMaxChips: number): void {
    for (const t of this.targets) { t.setViewerSqlPatternChipSettings(chipMinCount, chipMaxChips); }
  }
  setMinimapWidth(width: "small" | "medium" | "large"): void {
    for (const t of this.targets) { t.setMinimapWidth(width); }
  }
  setScrollbarVisible(show: boolean): void {
    for (const t of this.targets) { t.setScrollbarVisible(show); }
  }
  setSearchMatchOptionsAlwaysVisible(always: boolean): void {
    for (const t of this.targets) { t.setSearchMatchOptionsAlwaysVisible(always); }
  }
  setIconBarPosition(position: "left" | "right"): void {
    for (const t of this.targets) { t.setIconBarPosition(position); }
  }
  setAutoHidePatterns(patterns: readonly string[]): void {
    for (const t of this.targets) { t.setAutoHidePatterns(patterns); }
  }
  setDbBaselineFingerprintSummary(
    entries: Readonly<Record<string, PersistedDriftSqlFingerprintEntryV1>> | null,
  ): void {
    for (const t of this.targets) { t.setDbBaselineFingerprintSummary(entries); }
  }
  postToWebview(message: unknown): void {
    for (const t of this.targets) { t.postToWebview(message); }
  }
}

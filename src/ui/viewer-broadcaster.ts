/**
 * Broadcasts viewer state changes to all registered ViewerTarget instances.
 *
 * Used by extension.ts to send data to both the sidebar LogViewerProvider
 * and the pop-out PopOutPanel without duplicating every call.
 */

import type * as vscode from "vscode";
import type { LineData } from "../modules/session-manager";
import type { HighlightRule } from "../modules/highlight-rules";
import type { FilterPreset } from "../modules/filter-presets";
import type { SessionDisplayOptions } from "./session-display";
import type { ViewerTarget } from "./viewer-target";

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
  sendSessionList(sessions: readonly Record<string, unknown>[]): void {
    for (const t of this.targets) { t.sendSessionList(sessions); }
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
}

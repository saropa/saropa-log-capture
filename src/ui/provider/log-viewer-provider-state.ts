/**
 * PostMessage-based state updates for LogViewerProvider (set* / send*).
 * Extracted to keep log-viewer-provider.ts under the line limit.
 *
 * Viewer-affecting workspace settings (e.g. `showScrollbar`, `viewerAlwaysShowSearchMatchOptions`) are
 * read in the extension host, then pushed here as small typed messages; the webview applies `body` classes
 * or DOM updates in `viewer-script-messages.ts` — avoid duplicating config parsing inside the iframe.
 */

import * as vscode from "vscode";
import type { ViewerRepeatThresholds } from "../../modules/db/drift-db-repeat-thresholds";
import type { ViewerSlowBurstThresholds } from "../../modules/db/drift-db-slow-burst-thresholds";
import type { PersistedDriftSqlFingerprintEntryV1 } from "../../modules/db/drift-sql-fingerprint-summary-persist";
import { getConfig } from "../../modules/config/config";
import type { FilterPreset } from "../../modules/storage/filter-presets";
import type { SessionDisplayOptions } from "../session/session-display";
import type { ScopeContext } from "../../modules/storage/scope-context";
import type { SerializedHighlightRule } from "../viewer-decorations/viewer-highlight-serializer";
import * as helpers from "./viewer-provider-helpers";

export interface ProviderStateTarget {
  postMessage(message: unknown): void;
  getContext(): vscode.ExtensionContext;
}

export function scrollToLineImpl(target: ProviderStateTarget, line: number): void {
  target.postMessage({ type: "scrollToLine", line });
}
export function setExclusionsImpl(target: ProviderStateTarget, patterns: readonly string[]): void {
  target.postMessage({ type: "setExclusions", patterns });
}
export function setAnnotationImpl(target: ProviderStateTarget, lineIndex: number, text: string): void {
  target.postMessage({ type: "setAnnotation", lineIndex, text });
}
export function loadAnnotationsImpl(target: ProviderStateTarget, annotations: readonly { lineIndex: number; text: string }[]): void {
  target.postMessage({ type: "loadAnnotations", annotations });
}
export function setSplitInfoImpl(target: ProviderStateTarget, currentPart: number, totalParts: number): void {
  target.postMessage({ type: "splitInfo", currentPart, totalParts });
}
export function setSessionNavInfoImpl(
  target: ProviderStateTarget,
  opts: { hasPrev: boolean; hasNext: boolean; index: number; total: number },
): void {
  target.postMessage({ type: "sessionNavInfo", ...opts });
}
export function updateFooterImpl(target: ProviderStateTarget, text: string): void {
  target.postMessage({ type: "updateFooter", text });
}
export function setPausedImpl(target: ProviderStateTarget, paused: boolean): void {
  target.postMessage({ type: "setPaused", paused });
}
export function setFilenameImpl(target: ProviderStateTarget, filename: string): void {
  target.postMessage({ type: "setFilename", filename });
  const levels = helpers.getSavedLevelFilters(target.getContext(), filename);
  if (levels) { target.postMessage({ type: "restoreLevelFilters", levels }); }
}
export function setContextLinesImpl(target: ProviderStateTarget, count: number): void {
  target.postMessage({ type: "setContextLines", count });
}
export function setContextViewLinesImpl(target: ProviderStateTarget, count: number): void {
  target.postMessage({ type: "setContextViewLines", count });
}
export function setCopyContextLinesImpl(target: ProviderStateTarget, count: number): void {
  target.postMessage({ type: "setCopyContextLines", count });
}
export function setShowElapsedImpl(target: ProviderStateTarget, show: boolean): void {
  target.postMessage({ type: "setShowElapsed", show });
}
export function setShowDecorationsImpl(target: ProviderStateTarget, show: boolean): void {
  target.postMessage({ type: "setShowDecorations", show });
}
export function getReplayConfig(): { defaultMode: string; defaultSpeed: number; minLineDelayMs: number; maxDelayMs: number } {
  const r = getConfig().replay;
  return { defaultMode: r.defaultMode, defaultSpeed: r.defaultSpeed, minLineDelayMs: r.minLineDelayMs, maxDelayMs: r.maxDelayMs };
}
export function setErrorClassificationSettingsImpl(
  target: ProviderStateTarget,
  opts: { suppressTransientErrors: boolean; breakOnCritical: boolean; levelDetection: string; deemphasizeFrameworkLevels: boolean },
): void {
  target.postMessage({ type: "errorClassificationSettings", ...opts });
}
export function applyPresetImpl(target: ProviderStateTarget, name: string): void {
  target.postMessage({ type: "applyPreset", name });
}
export function setHighlightRulesImpl(target: ProviderStateTarget, rules: SerializedHighlightRule[]): void {
  target.postMessage({ type: "setHighlightRules", rules });
}
export function setPresetsImpl(target: ProviderStateTarget, presets: readonly FilterPreset[]): void {
  const lastUsed = target.getContext().workspaceState.get<string>("saropaLogCapture.lastUsedPresetName");
  target.postMessage({ type: "setPresets", presets, lastUsedPresetName: lastUsed });
}
export function setScopeContextImpl(target: ProviderStateTarget, ctx: ScopeContext): void {
  target.postMessage({ type: "setScopeContext", ...ctx });
}
export function setMinimapShowInfoImpl(target: ProviderStateTarget, show: boolean): void {
  target.postMessage({ type: "minimapShowInfo", show });
}
export function setMinimapShowSqlDensityImpl(target: ProviderStateTarget, show: boolean): void {
  target.postMessage({ type: "minimapShowSqlDensity", show });
}
export function setViewerRepeatThresholdsImpl(target: ProviderStateTarget, thresholds: ViewerRepeatThresholds): void {
  target.postMessage({
    type: "setViewerRepeatThresholds",
    thresholds: {
      globalMinCount: thresholds.globalMinCount,
      readMinCount: thresholds.readMinCount,
      transactionMinCount: thresholds.transactionMinCount,
      dmlMinCount: thresholds.dmlMinCount,
    },
  });
}
export function setViewerDbInsightsEnabledImpl(target: ProviderStateTarget, enabled: boolean): void {
  target.postMessage({ type: "setViewerDbInsightsEnabled", enabled });
}
export function setDbBaselineFingerprintSummaryImpl(
  target: ProviderStateTarget,
  entries: Readonly<Record<string, PersistedDriftSqlFingerprintEntryV1>> | null,
): void {
  target.postMessage({ type: "setDbBaselineFingerprintSummary", fingerprints: entries });
}
export function setViewerSlowBurstThresholdsImpl(target: ProviderStateTarget, thresholds: ViewerSlowBurstThresholds): void {
  target.postMessage({
    type: "setViewerSlowBurstThresholds",
    thresholds: {
      slowQueryMs: thresholds.slowQueryMs,
      burstMinCount: thresholds.burstMinCount,
      burstWindowMs: thresholds.burstWindowMs,
      cooldownMs: thresholds.cooldownMs,
    },
  });
}
export function setViewerSqlPatternChipSettingsImpl(
  target: ProviderStateTarget,
  chipMinCount: number,
  chipMaxChips: number,
): void {
  target.postMessage({ type: "setViewerSqlPatternChipSettings", chipMinCount, chipMaxChips });
}
export function setMinimapWidthImpl(target: ProviderStateTarget, width: "small" | "medium" | "large"): void {
  target.postMessage({ type: "minimapWidth", width });
}
export function setScrollbarVisibleImpl(target: ProviderStateTarget, show: boolean): void {
  target.postMessage({ type: "scrollbarVisible", show });
}
export function setSearchMatchOptionsAlwaysVisibleImpl(target: ProviderStateTarget, always: boolean): void {
  target.postMessage({ type: "searchMatchOptionsAlwaysVisible", always });
}
export function setIconBarPositionImpl(target: ProviderStateTarget, position: "left" | "right"): void {
  target.postMessage({ type: "iconBarPosition", position });
}
export function setAutoHidePatternsImpl(target: ProviderStateTarget, patterns: readonly string[]): void {
  target.postMessage({ type: "setAutoHidePatterns", patterns: [...patterns] });
}
export function setSessionInfoImpl(target: ProviderStateTarget, info: Record<string, string> | null): void {
  target.postMessage({ type: "setSessionInfo", info });
}
export function setHasPerformanceDataImpl(target: ProviderStateTarget, has: boolean): void {
  target.postMessage({ type: "setHasPerformanceData", has });
}
export function setCodeQualityPayloadImpl(target: ProviderStateTarget, payload: unknown): void {
  target.postMessage({ type: "setCodeQualityPayload", payload });
}
export function sendFindResultsImpl(target: ProviderStateTarget, results: unknown): void {
  target.postMessage({ type: "findResults", ...(results as Record<string, unknown>) });
}
export function setupFindSearchImpl(target: ProviderStateTarget, query: string, options: Record<string, unknown>): void {
  target.postMessage({ type: "setupFindSearch", query, ...options });
}
export function findNextMatchImpl(target: ProviderStateTarget): void {
  target.postMessage({ type: "findNextMatch" });
}
export function sendSessionListImpl(
  target: ProviderStateTarget,
  sessions: readonly Record<string, unknown>[],
  rootInfo?: { label: string; path: string; isDefault: boolean },
): void {
  target.postMessage({ type: "sessionList", sessions, ...rootInfo });
}
export function sendSessionListLoadingImpl(target: ProviderStateTarget, folderPath: string): void {
  target.postMessage({ type: "sessionListLoading", folderPath });
}
export function sendBookmarkListImpl(target: ProviderStateTarget, files: Record<string, unknown>): void {
  target.postMessage({ type: "bookmarkList", files });
}
export function sendDisplayOptionsImpl(target: ProviderStateTarget, options: SessionDisplayOptions): void {
  target.postMessage({ type: "sessionDisplayOptions", options });
}
export function sendIntegrationsAdaptersImpl(target: ProviderStateTarget, adapterIds: readonly string[]): void {
  target.postMessage({ type: "integrationsAdapters", adapterIds: [...adapterIds] });
}
export function setSessionStateImpl(target: ProviderStateTarget, active: boolean): void {
  target.postMessage({ type: "sessionState", active });
}
export function postStartReplayImpl(target: ProviderStateTarget): void {
  target.postMessage({ type: "startReplay", replayConfig: getReplayConfig() });
}

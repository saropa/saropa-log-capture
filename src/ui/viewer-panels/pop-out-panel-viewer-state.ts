/**
 * ViewerTarget state method implementations for PopOutPanel.
 * Forwarding methods that translate ViewerTarget calls into webview postMessage payloads.
 * Extracted from pop-out-panel.ts to keep the file under the line limit.
 */

import type { ViewerRepeatThresholds } from "../../modules/db/drift-db-repeat-thresholds";
import type { ViewerSlowBurstThresholds } from "../../modules/db/drift-db-slow-burst-thresholds";
import type { PersistedDriftSqlFingerprintEntryV1 } from "../../modules/db/drift-sql-fingerprint-summary-persist";
import type { ErrorRateConfig, ViewerDbDetectorToggles } from "../../modules/config/config-types";
import type { ScopeContext } from "../../modules/storage/scope-context";

/** Minimal post interface for viewer state methods. */
export interface ViewerStatePost {
    postToWebview(message: unknown): void;
}

/** Post minimap and scrollbar state messages to the webview. */
export function postMinimapState(target: ViewerStatePost, type: string, value: unknown): void {
    target.postToWebview({ type, ...typeof value === 'object' && value !== null ? value : { [type.startsWith('minimap') ? 'show' : 'value']: value } });
}

/** Post viewer repeat thresholds to the webview. */
export function postViewerRepeatThresholds(target: ViewerStatePost, thresholds: ViewerRepeatThresholds): void {
    target.postToWebview({
        type: "setViewerRepeatThresholds",
        thresholds: {
            globalMinCount: thresholds.globalMinCount,
            readMinCount: thresholds.readMinCount,
            transactionMinCount: thresholds.transactionMinCount,
            dmlMinCount: thresholds.dmlMinCount,
        },
    });
}

/** Post viewer DB detector toggles to the webview. */
export function postViewerDbDetectorToggles(target: ViewerStatePost, toggles: ViewerDbDetectorToggles): void {
    target.postToWebview({
        type: "setViewerDbDetectorToggles",
        nPlusOneEnabled: toggles.nPlusOneEnabled,
        slowBurstEnabled: toggles.slowBurstEnabled,
        baselineHintsEnabled: toggles.baselineHintsEnabled,
    });
}

/** Post DB baseline fingerprint summary to the webview. */
export function postDbBaselineFingerprintSummary(
    target: ViewerStatePost,
    entries: Readonly<Record<string, PersistedDriftSqlFingerprintEntryV1>> | null,
): void {
    target.postToWebview({ type: "setDbBaselineFingerprintSummary", fingerprints: entries });
}

/** Post viewer slow burst thresholds to the webview. */
export function postViewerSlowBurstThresholds(target: ViewerStatePost, thresholds: ViewerSlowBurstThresholds): void {
    target.postToWebview({
        type: "setViewerSlowBurstThresholds",
        thresholds: {
            slowQueryMs: thresholds.slowQueryMs,
            burstMinCount: thresholds.burstMinCount,
            burstWindowMs: thresholds.burstWindowMs,
            cooldownMs: thresholds.cooldownMs,
        },
    });
}

/** Post error rate config to the webview. */
export function postErrorRateConfig(target: ViewerStatePost, config: ErrorRateConfig): void {
    target.postToWebview({
        type: "setErrorRateConfig",
        bucketSize: config.bucketSize,
        showWarnings: config.showWarnings,
        detectSpikes: config.detectSpikes,
    });
}

/** Post scope context to the webview. */
export function postScopeContext(target: ViewerStatePost, ctx: ScopeContext): void {
    target.postToWebview({ type: "setScopeContext", ...ctx });
}

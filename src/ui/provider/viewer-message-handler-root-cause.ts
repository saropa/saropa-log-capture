/**
 * Root-cause hint message handlers: bundle processing, hypothesis building,
 * signal report opening, and cross-session trend lookup.
 *
 * Extracted from viewer-message-handler-actions.ts for file-length compliance
 * and to co-locate all root-cause state (cached bundle, hypotheses, trends).
 */

import * as vscode from 'vscode';
import { t } from '../../l10n';
import { buildHypotheses } from '../../modules/root-cause-hints/build-hypotheses';
import type { RootCauseHintBundle, RootCauseHypothesis } from '../../modules/root-cause-hints/root-cause-hint-types';
import { clearHostSignalCache, enrichBundleWithHostSignals } from '../../modules/root-cause-hints/signal-host-collectors';
import { isPersistedSignalSummaryV1 } from '../../modules/root-cause-hints/signal-summary-types';
import { extractSignalSummary } from '../../modules/root-cause-hints/signal-summary-extract';
import { SessionMetadataStore } from '../../modules/session/session-metadata';
import { loadFilteredMetas } from '../../modules/session/metadata-loader';
import { showSignalReport } from '../signals/signal-report-panel';
import { runExplainRootCauseHypotheses } from './viewer-message-handler-root-cause-ai';
import type { ViewerMessageContext } from './viewer-message-types';

// --- Module state: cached bundle, hypotheses, and cross-session trends ---

let lastRchBundle: RootCauseHintBundle | undefined;
let lastRchHypotheses: RootCauseHypothesis[] = [];
let lastRchSessionId: string | undefined;

/** Last enriched bundle for signal summary persistence at session finalization. */
export function getLastSignalBundle(): RootCauseHintBundle | undefined { return lastRchBundle; }

/** Last hypotheses for signal summary persistence at session finalization. */
export function getLastSignalHypotheses(): readonly RootCauseHypothesis[] { return lastRchHypotheses; }

// --- Cross-session trend cache (30s TTL to avoid reading metadata on every RAF tick) ---

let cachedTrends: Record<string, number> = {};
let cachedTrendsAt = 0;
const trendsCacheTtlMs = 30_000;

/** Count how many sessions each hypothesis templateId appears in. Cached for 30s. */
async function refreshTrendsIfStale(): Promise<Record<string, number>> {
    if (Date.now() - cachedTrendsAt < trendsCacheTtlMs) { return cachedTrends; }
    const metas = await loadFilteredMetas('all').catch(() => [] as const);
    const templateCounts = new Map<string, number>();
    for (const { meta } of metas) {
        const s = meta.signalSummary;
        if (!s || !isPersistedSignalSummaryV1(s)) { continue; }
        for (const tid of s.hypothesisTemplateIds ?? []) {
            templateCounts.set(tid, (templateCounts.get(tid) ?? 0) + 1);
        }
    }
    const map: Record<string, number> = {};
    for (const [tid, count] of templateCounts) { map[tid] = count; }
    cachedTrends = map;
    cachedTrendsAt = Date.now();
    return map;
}

// --- Periodic signal persistence (crash resilience) ---
// Writes signal summary to metadata every 30s while signals are being collected,
// so data survives VS Code / session crashes without waiting for finalization.

let persistTimer: ReturnType<typeof setTimeout> | undefined;
const persistIntervalMs = 30_000;

/** Debounced persist: writes the current signal summary to session metadata. Respects signalAutoTrack setting. */
function schedulePersist(fileUri: vscode.Uri | undefined): void {
    if (persistTimer || !fileUri) { return; }
    // Check if auto-tracking is enabled — user can disable to only track manually pinned signals
    const autoTrack = vscode.workspace.getConfiguration('saropaLogCapture').get<boolean>('signalAutoTrack', true);
    if (!autoTrack) { return; }
    persistTimer = setTimeout(() => {
        persistTimer = undefined;
        if (!lastRchBundle) { return; }
        const summary = extractSignalSummary(lastRchBundle, lastRchHypotheses);
        if (!summary) { return; }
        const store = new SessionMetadataStore();
        store.loadMetadata(fileUri).then(meta => {
            meta.signalSummary = summary;
            return store.saveMetadata(fileUri, meta);
        }).catch(() => {});
    }, persistIntervalMs);
}

/** Coerce message field to string. Duplicated here to avoid cross-file dependency on a private helper. */
function msgStr(m: Record<string, unknown>, key: string, fallback = ""): string {
    const v = m[key];
    return typeof v === "string" ? v : fallback;
}

// --- Message dispatch ---

/** Process a rootCauseBundle message: enrich, build hypotheses, resolve trends, post results. */
function handleRootCauseBundle(msg: Record<string, unknown>, ctx: ViewerMessageContext): void {
    // Validate bundle shape — webview should always send a valid bundle, but guard against malformed messages
    const incomingBundle = msg.bundle as RootCauseHintBundle | undefined;
    if (!incomingBundle || typeof incomingBundle.sessionId !== 'string') { return; }
    if (incomingBundle.sessionId !== lastRchSessionId) {
        clearHostSignalCache();
        lastRchSessionId = incomingBundle.sessionId;
    }
    // Enrich bundle with host-side signals (ANR risk), build hypotheses,
    // then look up cross-session trends and post everything to the webview.
    enrichBundleWithHostSignals(incomingBundle, ctx.currentFileUri).then(enriched => {
        lastRchBundle = enriched;
        lastRchHypotheses = buildHypotheses(enriched);
        // Schedule periodic persist so signal data survives crashes
        schedulePersist(ctx.currentFileUri);
        return refreshTrendsIfStale();
    }).then(trends => {
        ctx.post({ type: 'rootCauseHypothesesResult', hypotheses: lastRchHypotheses, trends });
    }).catch(() => {
        // Fallback: build hypotheses without enrichment, post without trends
        lastRchBundle = incomingBundle;
        lastRchHypotheses = buildHypotheses(lastRchBundle);
        ctx.post({ type: 'rootCauseHypothesesResult', hypotheses: lastRchHypotheses, trends: {} });
    });
}

/**
 * Handle root-cause hint messages. Returns true if handled.
 * Cases: rootCauseBundle, openSignalReport, explainRootCauseHypotheses,
 * explainRootCauseHypothesesEmpty.
 */
export function dispatchRootCauseMessage(
    type: string, msg: Record<string, unknown>, ctx: ViewerMessageContext,
): boolean {
    switch (type) {
    case "rootCauseBundle": handleRootCauseBundle(msg, ctx); return true;
    case "openSignalReport": {
        const hyp = lastRchHypotheses.find(h => h.hypothesisKey === msgStr(msg, "hypothesisKey"));
        if (hyp && lastRchBundle) {
            showSignalReport(hyp, lastRchBundle, ctx.currentFileUri).catch(() => {});
        } else {
            vscode.window.setStatusBarMessage(t("msg.signalReportNotReady"), 3000);
        }
        return true;
    }
    case "explainRootCauseHypotheses":
        runExplainRootCauseHypotheses(msg, ctx);
        return true;
    case "explainRootCauseHypothesesEmpty":
        vscode.window.showInformationMessage(t("msg.explainRootCauseHypothesesEmpty")).then(undefined, () => {});
        return true;
    default:
        return false;
    }
}

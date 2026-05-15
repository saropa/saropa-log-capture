/**
 * Recurring Signal Handlers
 *
 * Handlers for recurring signals panel operations.
 * All signal kinds (error, warning, perf, SQL, etc.) go through the unified RecurringSignalEntry type.
 */

import * as path from 'path';
import * as vscode from 'vscode';
import { getLogDirectoryUri } from '../../../modules/config/config';
import { aggregateSignals } from '../../../modules/misc/cross-session-aggregator';
import type { RecurringSignalEntry } from '../../../modules/misc/recurring-signal-builder';
import { buildAllRecurringSignals } from '../../../modules/misc/recurring-signal-builder';
import { getErrorStatusBatch, setErrorStatus, type ErrorStatus } from '../../../modules/misc/error-status-store';
import { getInteractionTracker } from '../../../modules/learning/learning-runtime';
import { SessionMetadataStore } from '../../../modules/session/session-metadata';
import { loadFilteredMetas, parseSessionDate } from '../../../modules/session/metadata-loader';
import { isPersistedSignalSummaryV2 } from '../../../modules/root-cause-hints/signal-summary-types';
import { isPersistedDriftSqlFingerprintSummaryV1 } from '../../../modules/db/drift-sql-fingerprint-summary-persist';
import type { SessionMeta } from '../../../modules/session/session-metadata';
import { enrichSignalsWithLintContext } from '../../../modules/diagnostics/signal-lint-enricher';
import { enrichSignalsWithDaContext } from '../../../modules/diagnostics/signal-da-enricher';
import { buildRegressionSignalEntries, detectRegressions } from '../../../modules/signals/regression-detector';
import { getLearningStore } from '../../../modules/learning/learning-runtime';
import { SuggestionEngine, type RuleSuggestion } from '../../../modules/learning/suggestion-engine';
import type { PostFn } from './crashlytics-handlers';

/** Update error/warning triage status and refresh the signal panel.
 *  Needs currentFileUri so the refresh includes "Signals in this log" data. */
export async function handleSetErrorStatus(hash: string, status: string, post: PostFn, currentFileUri?: vscode.Uri): Promise<void> {
    await setErrorStatus(hash, status as ErrorStatus);
    // Re-send full signal data so the unified list re-renders with updated triage states
    await handleSignalDataRequest(post, currentFileUri);
}

/**
 * Fu4 (plan 052): Mute a signal with a free-text reason.
 *
 * Two outcomes from a single user gesture:
 *   1. Status flip: the signal goes from open → muted, same path as anonymous mute.
 *   2. Labeled training example: the reason gets recorded via the existing InteractionTracker
 *      using the `add-exclusion` type. The signal label becomes the `lineText` (the pattern the
 *      tracker will analyze for noise-learning), suffixed with the reason as a hint comment.
 *      Without a reason the user gets the existing anonymous mute behavior — no learning data.
 *
 * Cancel from the InputBox aborts the mute entirely. This matches the rule of least surprise:
 * "I clicked Mute, then thought better of it" should not result in a half-applied state.
 */
export async function handleMuteSignalWithReason(hash: string, label: string, post: PostFn, currentFileUri?: vscode.Uri): Promise<void> {
    if (!hash) { return; }
    const reason = await vscode.window.showInputBox({
        title: 'Mute signal',
        prompt: 'Why are you muting this signal? (Optional but feeds noise-learning so future suggestions improve.)',
        placeHolder: 'e.g. expected framework noise, known third-party warning, intentional debug print',
        validateInput: (v) => v.length > 80 ? 'Reason must be 80 characters or fewer' : undefined,
        ignoreFocusOut: true,
    });
    /* showInputBox returns undefined when the user dismisses with Escape; an empty string means
       "OK with no text". Treat undefined as a cancel and bail; treat empty as "anonymous mute". */
    if (reason === undefined) { return; }
    await setErrorStatus(hash, 'muted' as ErrorStatus);
    /* Only feed the learning system if the user actually provided a reason. The bare signal label
       has no narrative signal beyond what the tracker would see from any other interaction. */
    if (reason.trim().length > 0 && label) {
        try {
            getInteractionTracker()?.handleViewerMessage({
                type: 'trackInteraction',
                interactionType: 'add-exclusion',
                /* lineText carries the pattern the extractor will analyze. Combining label + reason
                   gives the extractor both the signal content and the user's framing of WHY it's noise. */
                lineText: `${label} // reason: ${reason.trim()}`,
                lineLevel: 'info',
            });
        } catch {
            /* Non-critical: a learning capture failure must never block the mute itself. */
        }
    }
    await handleSignalDataRequest(post, currentFileUri);
}

/** Full signal payload (unified signals + hot files + environment). */
export async function handleSignalDataRequest(post: PostFn, currentFileUri?: vscode.Uri): Promise<void> {
    const aggregated = await aggregateSignals('all').catch(() => undefined);
    const allSignals = aggregated?.allSignals ?? [];
    const errorFingerprints = allSignals.filter(s => s.kind === 'error' || s.kind === 'warning').map(s => s.fingerprint);
    const statuses = await getErrorStatusBatch(errorFingerprints);

    let signalsInThisLog: RecurringSignalEntry[] | undefined;
    let sessionCorrelationTags: readonly string[] = [];
    if (currentFileUri) {
        try {
            const store = new SessionMetadataStore();
            const meta = await store.loadMetadata(currentFileUri);
            sessionCorrelationTags = meta?.correlationTags ?? [];
            const sessionFilename = path.basename(currentFileUri.fsPath);
            const thisSessionSignals = buildAllRecurringSignals([{ filename: sessionFilename, meta }]);
            /* F7/F8 (plan 052): compute regression/recovery against the last N sessions and
               prepend the results to "Signals in this log". Prepending puts the
               highest-actionability items first (new error types) and the highest-positive items
               near them (recoveries). Falls back silently if no past metas or no fingerprints. */
            const allMetas = await loadFilteredMetas('all').catch(() => [] as Awaited<ReturnType<typeof loadFilteredMetas>>);
            const pastMetas = [...allMetas]
                .filter((m) => m.filename !== sessionFilename)
                .sort((a, b) => parseSessionDate(a.filename) - parseSessionDate(b.filename));
            const regression = detectRegressions({
                currentFingerprints: meta?.fingerprints ?? [],
                pastMetas,
            });
            const regressionEntries = buildRegressionSignalEntries(sessionFilename, regression);
            const merged = [...regressionEntries, ...thisSessionSignals];
            if (merged.length > 0) { signalsInThisLog = merged; }
        } catch {
            // ignore — metadata may not exist yet for new sessions
        }
    }

    /* Plan 053-A: pending noise-learning suggestions piggyback on the same payload so the panel
       doesn't need a separate round-trip on open. Failures here must NOT block the panel render —
       the learning store can be uninitialized or empty for new workspaces, and we'd rather show
       signals without suggestions than show nothing. */
    const filterSuggestions = await loadPendingFilterSuggestions().catch(() => [] as RuleSuggestion[]);

    post({
        type: 'signalData',
        statuses,
        hotFiles: aggregated?.hotFiles ?? [],
        platforms: aggregated?.platforms ?? [],
        sdkVersions: aggregated?.sdkVersions ?? [],
        debugAdapters: aggregated?.debugAdapters ?? [],
        // Enrich signals with lint diagnostics + DA table metadata
        allSignals: await enrichSignalsWithDaContext(
            await enrichSignalsWithLintContext([...allSignals], sessionCorrelationTags),
        ),
        signalsInThisLog: await enrichSignalsWithDaContext(
            await enrichSignalsWithLintContext([...(signalsInThisLog ?? [])], sessionCorrelationTags),
        ),
        coOccurrences: aggregated?.coOccurrences ?? [],
        filterSuggestions,
    });
}

/** Plan 053-A: fetch pending suggestions from the learning system for panel display. */
async function loadPendingFilterSuggestions(): Promise<RuleSuggestion[]> {
    const store = getLearningStore();
    if (!store) { return []; }
    const engine = new SuggestionEngine(store);
    /* Use listPendingSuggestions (not refreshAndListPending) — the notification path already
       triggers refresh on its own cooldown. The panel just reads what's pending right now;
       triggering an extract every panel open would burn CPU on signal-data refreshes that
       happen multiple times per session. */
    return engine.listPendingSuggestions();
}

/** Plan 053-A: Accept a filter suggestion. Mirrors the QuickPick accept path — update workspace
 *  exclusions then mark the suggestion accepted, then re-send signal data so the panel re-renders
 *  without the now-accepted row. */
export async function handleAcceptFilterSuggestion(id: string, pattern: string, post: PostFn, currentFileUri?: vscode.Uri): Promise<void> {
    if (!id || !pattern) { return; }
    const cfg = vscode.workspace.getConfiguration('saropaLogCapture');
    const cur = cfg.get<string[]>('exclusions', []);
    if (!cur.includes(pattern)) {
        try {
            await cfg.update('exclusions', [...cur, pattern], vscode.ConfigurationTarget.Workspace);
        } catch {
            /* Settings write failure: surface to user, do not mark suggestion accepted. */
            void vscode.window.showErrorMessage(`Failed to add exclusion: ${pattern}`);
            return;
        }
    }
    const store = getLearningStore();
    if (store) { await store.setSuggestionStatus(id, 'accepted'); }
    await handleSignalDataRequest(post, currentFileUri);
}

/** Plan 053-A: Reject a filter suggestion. Persists rejection so the same pattern doesn't
 *  re-surface; once plan 053 Workstream C (confidence feedback loop) lands, rejections will
 *  also suppress the pattern for N sessions. */
export async function handleRejectFilterSuggestion(id: string, post: PostFn, currentFileUri?: vscode.Uri): Promise<void> {
    if (!id) { return; }
    const store = getLearningStore();
    if (store) { await store.setSuggestionStatus(id, 'rejected'); }
    await handleSignalDataRequest(post, currentFileUri);
}

/**
 * Find the most recent session that contains the given signal and return its URI string.
 *
 * Preferred: exact fingerprint match against meta.fingerprints / warningFingerprints /
 * perfFingerprints / driftSqlFingerprintSummary.fingerprints / signalSummary.entries (V2).
 *
 * Fallback (no fingerprint or no fingerprint match): "any session that has at least one
 * signal of this kind" — checked against the typed metadata lists, not signalSummary.counts.
 * The old counts-key path silently never matched because the SignalKind values
 * (e.g. "error", "warning", "sql") don't equal the SignalSummaryCounts keys
 * (e.g. "errors", "warningGroups", "sqlBursts"), which is the reason every click
 * looked dead before this rewrite.
 */
export async function handleOpenSessionForSignalType(
    signalType: string,
    fingerprint?: string,
): Promise<string | undefined> {
    const metas = await loadFilteredMetas('all');
    const byFingerprint = fingerprint
        ? metas.filter(m => sessionHasFingerprint(m.meta, fingerprint))
        : [];
    /* Prefer a fingerprint match. Fall back to any session of that kind only when no session
       carries the specific fingerprint (older sessions may pre-date fingerprint storage). */
    const candidates = byFingerprint.length > 0
        ? byFingerprint
        : metas.filter(m => sessionHasAnyOfKind(m.meta, signalType));
    if (candidates.length === 0) { return undefined; }
    const sorted = [...candidates].sort((a, b) => parseSessionDate(b.filename) - parseSessionDate(a.filename));
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) { return undefined; }
    const logDir = getLogDirectoryUri(folder);
    return vscode.Uri.joinPath(logDir, sorted[0].filename).toString();
}

/** True if any of this session's persisted fingerprint lists carries the given identifier. */
function sessionHasFingerprint(meta: SessionMeta, fp: string): boolean {
    if ((meta.fingerprints ?? []).some(f => f.h === fp)) { return true; }
    if ((meta.warningFingerprints ?? []).some(f => f.h === fp)) { return true; }
    /* Perf signals use the operation name as their fingerprint, not a hash. */
    if ((meta.perfFingerprints ?? []).some(p => p.name === fp)) { return true; }
    const drift = meta.driftSqlFingerprintSummary;
    if (drift && isPersistedDriftSqlFingerprintSummaryV1(drift) && fp in drift.fingerprints) {
        return true;
    }
    const summary = meta.signalSummary;
    if (summary && isPersistedSignalSummaryV2(summary)) {
        if ((summary.entries ?? []).some(e => e.fingerprint === fp)) { return true; }
    }
    return false;
}

/** True if this session contains any signal of the requested kind. Used as fallback when the
 *  specific fingerprint can't be located (e.g. older sessions, kinds with no per-fingerprint store). */
function sessionHasAnyOfKind(meta: SessionMeta, kind: string): boolean {
    switch (kind) {
        case 'error': return (meta.fingerprints ?? []).length > 0;
        case 'warning': return (meta.warningFingerprints ?? []).length > 0;
        case 'perf': return (meta.perfFingerprints ?? []).length > 0;
        case 'sql': {
            const d = meta.driftSqlFingerprintSummary;
            return !!(d && isPersistedDriftSqlFingerprintSummaryV1(d) && Object.keys(d.fingerprints).length > 0);
        }
        default: {
            /* Remaining kinds (network/memory/slow-op/anr/permission/classified) only land in V2
               entries — V1 counts keys don't share names with SignalKind values so they're unusable. */
            const s = meta.signalSummary;
            if (!s || !isPersistedSignalSummaryV2(s)) { return false; }
            return (s.entries ?? []).some(e => e.kind === kind);
        }
    }
}

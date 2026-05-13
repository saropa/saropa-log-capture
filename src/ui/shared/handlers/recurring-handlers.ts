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
import { isPersistedSignalSummaryV1 } from '../../../modules/root-cause-hints/signal-summary-types';
import { enrichSignalsWithLintContext } from '../../../modules/diagnostics/signal-lint-enricher';
import { enrichSignalsWithDaContext } from '../../../modules/diagnostics/signal-da-enricher';
import { buildRegressionSignalEntries, detectRegressions } from '../../../modules/signals/regression-detector';
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
    });
}

/**
 * Find the most recent session that has the given signal type and return its URI string.
 * Returns undefined if no matching session found.
 */
export async function handleOpenSessionForSignalType(signalType: string): Promise<string | undefined> {
    const metas = await loadFilteredMetas('all');
    const matching = metas
        .filter(m => {
            const s = m.meta.signalSummary;
            if (!s || !isPersistedSignalSummaryV1(s)) { return false; }
            // Check if this session has a non-zero count for the requested signal type
            const count = (s.counts as Record<string, number | undefined>)[signalType];
            return typeof count === 'number' && count > 0;
        })
        .sort((a, b) => parseSessionDate(b.filename) - parseSessionDate(a.filename));
    if (matching.length === 0) { return undefined; }
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) { return undefined; }
    const logDir = getLogDirectoryUri(folder);
    return vscode.Uri.joinPath(logDir, matching[0].filename).toString();
}

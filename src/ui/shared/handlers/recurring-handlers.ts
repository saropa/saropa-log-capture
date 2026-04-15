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
import { SessionMetadataStore } from '../../../modules/session/session-metadata';
import { loadFilteredMetas, parseSessionDate } from '../../../modules/session/metadata-loader';
import { isPersistedSignalSummaryV1 } from '../../../modules/root-cause-hints/signal-summary-types';
import { enrichSignalsWithLintContext } from '../../../modules/diagnostics/signal-lint-enricher';
import { enrichSignalsWithDaContext } from '../../../modules/diagnostics/signal-da-enricher';
import type { PostFn } from './crashlytics-handlers';

/** Update error/warning triage status and refresh the signal panel.
 *  Needs currentFileUri so the refresh includes "Signals in this log" data. */
export async function handleSetErrorStatus(hash: string, status: string, post: PostFn, currentFileUri?: vscode.Uri): Promise<void> {
    await setErrorStatus(hash, status as ErrorStatus);
    // Re-send full signal data so the unified list re-renders with updated triage states
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
            if (thisSessionSignals.length > 0) { signalsInThisLog = thisSessionSignals; }
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

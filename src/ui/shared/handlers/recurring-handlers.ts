/**
 * Recurring Signal Handlers
 *
 * Handlers for recurring signals panel operations.
 * All signal kinds (error, warning, perf, SQL, etc.) go through the unified RecurringSignalEntry type.
 */

import * as path from 'path';
import * as vscode from 'vscode';
import { getConfig, getLogDirectoryUri } from '../../../modules/config/config';
import { aggregateSignals } from '../../../modules/misc/cross-session-aggregator';
import type { RecurringSignalEntry } from '../../../modules/misc/recurring-signal-builder';
import { buildAllRecurringSignals } from '../../../modules/misc/recurring-signal-builder';
import { getErrorStatusBatch, setErrorStatus, type ErrorStatus } from '../../../modules/misc/error-status-store';
import { getFirstSeenHintsForErrors } from '../../../modules/regression/regression-hint-service';
import { SessionMetadataStore } from '../../../modules/session/session-metadata';
import { loadFilteredMetas, parseSessionDate } from '../../../modules/session/metadata-loader';
import { isPersistedSignalSummaryV1 } from '../../../modules/root-cause-hints/signal-summary-types';
import { enrichSignalsWithLintContext } from '../../../modules/diagnostics/signal-lint-enricher';
import { enrichSignalsWithDaContext } from '../../../modules/diagnostics/signal-da-enricher';
import type { PostFn } from './crashlytics-handlers';

/** First-seen regression hint for display in Signals (commit for session where error first appeared). */
export interface RegressionHintPayload {
    readonly hash: string;
    readonly session: string;
    readonly commitUrl?: string;
}

/** Top errors in one session (from fingerprints). */
export interface ErrorInThisLogItem {
    readonly normalizedText: string;
    readonly exampleLine: string;
    readonly count: number;
}

/** Normalize path segment for comparison with timeline session (forward slashes). */
function normSession(s: string): string {
    return s.replace(/\\/g, '/');
}

/** Signals that appear in the given session (timeline contains session path). */
function filterSignalsInSession(signals: readonly RecurringSignalEntry[], sessionRelPath: string): RecurringSignalEntry[] {
    const norm = normSession(sessionRelPath);
    return signals.filter(s => s.timeline.some(t => normSession(t.session) === norm || normSession(t.session).endsWith(norm)));
}

/** Aggregate recurring errors and send to webview (used by the standalone recurring panel). */
export async function handleRecurringRequest(post: PostFn): Promise<void> {
    const aggregated = await aggregateSignals('all').catch(() => undefined);
    const errors = (aggregated?.allSignals ?? []).filter(s => s.kind === 'error');
    const statuses = await getErrorStatusBatch(errors.map(e => e.fingerprint));
    post({ type: 'recurringErrorsData', errors, statuses });
}

/** Update error status and refresh. */
export async function handleSetErrorStatus(hash: string, status: string, post: PostFn): Promise<void> {
    await setErrorStatus(hash, status as ErrorStatus);
    await handleRecurringRequest(post);
}

/** Full signal payload (unified signals + hot files + environment). */
export async function handleSignalDataRequest(post: PostFn, currentFileUri?: vscode.Uri): Promise<void> {
    const aggregated = await aggregateSignals('all').catch(() => undefined);
    const allSignals = aggregated?.allSignals ?? [];
    const errorSignals = allSignals.filter(s => s.kind === 'error');
    const hotFiles = aggregated?.hotFiles ?? [];
    const platforms = aggregated?.platforms ?? [];
    const sdkVersions = aggregated?.sdkVersions ?? [];
    const debugAdapters = aggregated?.debugAdapters ?? [];
    const statuses = await getErrorStatusBatch(errorSignals.map(e => e.fingerprint));

    const commitLinks = getConfig().integrationsGit?.commitLinks ?? true;
    const regressionHints = await getFirstSeenHintsForErrors(errorSignals.map(e => e.fingerprint), {
        resolveCommitUrls: commitLinks,
        cap: 15,
    }).catch(() => ({}));

    let recurringInThisLog: RecurringSignalEntry[] | undefined;
    let errorsInThisLog: ErrorInThisLogItem[] | undefined;
    let errorsInThisLogTotal: number | undefined;
    let signalsInThisLog: RecurringSignalEntry[] | undefined;
    /** Correlation tags from the current session — `file:lib/foo.dart` entries for stack trace files. */
    let sessionCorrelationTags: readonly string[] = [];
    if (currentFileUri) {
        const folder = vscode.workspace.workspaceFolders?.[0];
        if (folder) {
            const logDir = getLogDirectoryUri(folder);
            const rel = path.relative(logDir.fsPath, currentFileUri.fsPath);
            const sessionRel = normSession(rel);
            if (!rel.startsWith('..') && sessionRel.length > 0) {
                recurringInThisLog = filterSignalsInSession(errorSignals, sessionRel);
            }
        }
        try {
            const store = new SessionMetadataStore();
            const meta = await store.loadMetadata(currentFileUri);
            const fps = meta?.fingerprints ?? [];
            const top3 = [...fps]
                .sort((a, b) => (b.c ?? 0) - (a.c ?? 0))
                .slice(0, 3)
                .map(f => ({
                    normalizedText: f.n ?? '',
                    exampleLine: f.e ?? '',
                    count: f.c ?? 0,
                }));
            if (top3.length > 0) {
                errorsInThisLog = top3;
            }
            errorsInThisLogTotal = fps.length;
            // Capture correlation tags for lint enrichment — these are the source files
            // from stack traces that saropa_lints and the Dart analyzer should analyze
            sessionCorrelationTags = meta?.correlationTags ?? [];
            // Build unified signals for this session from all metadata sources
            const sessionFilename = path.basename(currentFileUri.fsPath);
            const thisSessionSignals = buildAllRecurringSignals([{ filename: sessionFilename, meta }]);
            if (thisSessionSignals.length > 0) {
                signalsInThisLog = thisSessionSignals;
            }
        } catch {
            // ignore
        }
    }

    post({
        type: 'signalData',
        // Error signals sent as 'errors' for webview recurring-error cards
        errors: errorSignals,
        statuses,
        hotFiles,
        platforms,
        sdkVersions,
        debugAdapters,
        recurringInThisLog,
        errorsInThisLog,
        errorsInThisLogTotal,
        regressionHints,
        // Enrich signals with lint diagnostics from ALL source files in the session's
        // stack traces (correlation tags). Opens unanalyzed files to trigger saropa_lints /
        // Dart analyzer / ESLint, waits up to 2s for results.
        // Then enrich SQL signals with Drift Advisor table metadata (schema info,
        // index suggestions) when the DA extension is installed.
        allSignals: await enrichSignalsWithDaContext(
            await enrichSignalsWithLintContext([...allSignals], sessionCorrelationTags),
        ),
        signalsInThisLog: await enrichSignalsWithDaContext(
            await enrichSignalsWithLintContext([...(signalsInThisLog ?? [])], sessionCorrelationTags),
        ),
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

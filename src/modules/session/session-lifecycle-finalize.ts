/**
 * Session finalization — stops a log session, saves metadata, and runs scans.
 * Split from session-lifecycle.ts for file-length compliance.
 */

import * as vscode from 'vscode';
import * as path from 'node:path';
import { getConfig } from '../config/config';
import { LogSession } from '../capture/log-session';
import { AutoTagger } from '../misc/auto-tagger';
import { KeywordWatcher } from '../features/keyword-watcher';
import { SessionMetadataStore } from './session-metadata';
import { scanForCorrelationTags } from '../analysis/correlation-scanner';
import { scanForFingerprints } from '../analysis/error-fingerprint';
import { scanForWarningFingerprints } from '../analysis/warning-fingerprint';
import { scanForPerfFingerprints } from '../misc/perf-fingerprint';
import { scanAnrRisk } from '../analysis/anr-risk-scorer';
import { detectAppVersion } from '../misc/app-version';
import { detectTargetDevice } from '../misc/device-detector';
import { countSeveritiesChunked, extractBody } from '../../ui/session/session-severity-counts';
import {
    generateSummary, showSummaryNotification, withLogUri, SessionStats,
} from './session-summary';
import {
    getDefaultIntegrationRegistry,
    createIntegrationContext,
    createIntegrationEndContext,
} from '../integrations';
import { stopExternalLogTailers } from '../integrations/external-log-tailer';
import { stopLogcatCapture } from '../integrations/adb-logcat-capture';
import { stopDatabaseQueryTail } from '../integrations/database-query-tailer';
import { writeUnifiedSessionLogIfEnabled } from './unified-session-log-writer';
import { scanAndPersistDriftSqlFingerprintSummary } from './session-drift-sql-fingerprint-persist';
import { getLastSignalBundle, getLastSignalHypotheses } from '../../ui/provider/viewer-message-handler-actions';
import { extractSignalSummary } from '../root-cause-hints/signal-summary-extract';
import { scanForGeneralSignals } from '../analysis/general-signal-scanner';
import { surfacePredictiveSignals } from './session-signal-surfacing';
import { loadFilteredMetas, parseSessionDate, type LoadedMeta } from './metadata-loader';
import { computeSessionDelta, formatSessionDelta } from '../compare/session-delta';
import { computeDebuggingVelocity } from '../compare/debugging-velocity';
import { writeLogCaptureDiagnostics } from '../diagnostics/diagnostics-producer';
import { getSessionCommit } from './session-commit-from-meta';

/** Parameters for session finalization. */
export interface FinalizeSessionParams {
    readonly logSession: LogSession;
    readonly outputChannel: vscode.OutputChannel;
    readonly autoTagger: AutoTagger | null;
    readonly metadataStore: SessionMetadataStore;
    readonly debugAdapterType: string;
    readonly sessionStartTime: number;
    /** Debug target process ID from DAP process event (if available). */
    readonly debugProcessId?: number;
    /** Called when post-finalize metadata (correlation tags, fingerprints) has been written. Used for project index inline update. */
    readonly onReportsIndexReady?: (logUri: vscode.Uri) => void | Promise<void>;
}

/** Parameters for building session statistics. */
export interface BuildStatsParams {
    readonly logSession: LogSession;
    readonly sessionStartTime: number;
    readonly categoryCounts: Record<string, number>;
    readonly watcher: KeywordWatcher;
    readonly floodSuppressedTotal: number;
}

/** Build session statistics for the summary notification. */
export function buildSessionStats(params: BuildStatsParams): SessionStats {
    const { logSession, sessionStartTime, categoryCounts, watcher, floodSuppressedTotal } = params;
    const watchCounts: Record<string, number> = {};
    for (const [key, value] of watcher.getCounts()) {
        watchCounts[key] = value;
    }
    return {
        lineCount: logSession.lineCount,
        bytesWritten: logSession.bytesWritten,
        durationMs: Date.now() - sessionStartTime,
        partCount: logSession.partNumber + 1,
        categoryCounts: { ...categoryCounts },
        watchHitCounts: watchCounts,
        floodSuppressedCount: floodSuppressedTotal,
        exclusionsApplied: 0,
    };
}

/** Stop a log session, save metadata, and show the summary notification. */
export async function finalizeSession(
    params: FinalizeSessionParams,
    stats: SessionStats,
): Promise<void> {
    const { logSession, outputChannel, autoTagger, metadataStore, sessionStartTime } = params;
    const sessionEndTime = Date.now();
    const config = getConfig();

    try {
        await logSession.stop();
        outputChannel.appendLine(`Session stopped: ${logSession.fileUri.fsPath}`);
    } catch (err) {
        outputChannel.appendLine(`Error stopping log session: ${err}`);
    }

    // Integration end-phase: providers write meta + sidecars; then we run scans and save metadata.
    const integrationRegistry = getDefaultIntegrationRegistry();
    const integrationContext = createIntegrationContext(
        logSession.sessionContext, config, outputChannel,
    );
    const baseFileName = path.basename(logSession.fileUri.fsPath).replace(/\.log$/i, '') ||
        'session';
    const endContext = createIntegrationEndContext({
        base: integrationContext,
        logUri: logSession.fileUri,
        baseFileName,
        sessionStartTime,
        sessionEndTime,
        debugProcessId: params.debugProcessId,
    });
    await integrationRegistry.runOnSessionEnd(endContext, metadataStore);
    // Always dispose external log watchers and adb logcat (provider stops when adapter enabled; if disabled mid-session, this still closes handles).
    stopExternalLogTailers();
    stopLogcatCapture();
    // Belt-and-suspenders: the database provider stops its live tail in onSessionEnd; this closes the handle if onSessionEnd was skipped.
    stopDatabaseQueryTail();
    await writeUnifiedSessionLogIfEnabled(logSession.fileUri, baseFileName, config, outputChannel);

    // Save auto-tags if any watch patterns triggered during the session.
    if (autoTagger?.hasTriggeredTags()) {
        const autoTags = autoTagger.getTriggeredTags();
        metadataStore.setAutoTags(logSession.fileUri, autoTags).catch((err) => {
            outputChannel.appendLine(`Failed to save auto-tags: ${err}`);
        });
        outputChannel.appendLine(`Auto-tags applied: ${autoTags.join(', ')}`);
    }

    // Scans (correlation tags, error fingerprints, perf fingerprints) run in parallel; onReportsIndexReady after all settle.
    const pCorr = scanForCorrelationTags(logSession.fileUri).then(async (corrTags) => {
        if (corrTags.length > 0) {
            await metadataStore.setCorrelationTags(logSession.fileUri, corrTags);
            outputChannel.appendLine(`Correlation tags: ${corrTags.join(', ')}`);
        }
    }).catch((err) => {
        outputChannel.appendLine(`Failed to scan correlation tags: ${err}`);
    });

    const pFp = scanForFingerprints(logSession.fileUri).then(async (fps) => {
        if (fps.length > 0) {
            await metadataStore.setFingerprints(logSession.fileUri, fps);
            outputChannel.appendLine(`Error fingerprints: ${fps.length} patterns`);
        }
    }).catch((err) => {
        outputChannel.appendLine(`Failed to scan fingerprints: ${err}`);
    });

    const pWarnFp = scanForWarningFingerprints(logSession.fileUri).then(async (wfps) => {
        if (wfps.length > 0) {
            const meta = await metadataStore.loadMetadata(logSession.fileUri);
            meta.warningFingerprints = wfps;
            await metadataStore.saveMetadata(logSession.fileUri, meta);
            outputChannel.appendLine(`Warning fingerprints: ${wfps.length} patterns`);
        }
    }).catch((err) => {
        outputChannel.appendLine(`Failed to scan warning fingerprints: ${err}`);
    });

    const pPerf = scanForPerfFingerprints(logSession.fileUri).then(async (pfs) => {
        if (pfs.length > 0) {
            await metadataStore.setPerfFingerprints(logSession.fileUri, pfs);
            outputChannel.appendLine(`Perf fingerprints: ${pfs.length} operations`);
        }
    }).catch((err) => {
        outputChannel.appendLine(`Failed to scan perf fingerprints: ${err}`);
    });

    const pDriftSql = scanAndPersistDriftSqlFingerprintSummary(logSession.fileUri, metadataStore, outputChannel);

    // Persist signal summary: prefer the viewer-collected bundle (richer data with
    // hypothesis template IDs, N+1 fingerprints, slow op names). If the viewer was
    // never opened, fallback to extension-side general signal scanning so network
    // failures, memory events, slow ops, etc. are still captured.
    const pSignal = Promise.resolve().then(async () => {
        // Respect the signalAutoTrack setting — skip persistence if disabled
        const autoTrack = vscode.workspace.getConfiguration('saropaLogCapture').get<boolean>('signalAutoTrack', true);
        if (!autoTrack) { return; }
        const bundle = getLastSignalBundle();
        const summary = bundle
            ? extractSignalSummary(bundle, getLastSignalHypotheses())
            : await scanForGeneralSignals(logSession.fileUri);
        if (!summary) { return; }
        const meta = await metadataStore.loadMetadata(logSession.fileUri);
        meta.signalSummary = summary;
        await metadataStore.saveMetadata(logSession.fileUri, meta);
        const source = bundle ? 'viewer' : 'extension-scan';
        outputChannel.appendLine(`Signal summary (${source}): ${JSON.stringify(summary.counts)}`);
    }).catch((err) => {
        outputChannel.appendLine(`Failed to persist signal summary: ${err}`);
    });

    Promise.allSettled([pCorr, pFp, pWarnFp, pPerf, pDriftSql, pSignal]).then(() => {
        params.onReportsIndexReady?.(logSession.fileUri);
        // Predictive surfacing (idea #1): proactively flag this session's new + recurring errors
        // in one toast. Runs after scans settle so fingerprints are persisted for the comparison.
        surfacePredictiveSignals(logSession.fileUri, outputChannel);
        // "What changed?" auto-summary (idea #10): log the delta vs the previous session to the
        // output channel — silent (no toast) so it never competes with the surfacing notification.
        logWhatChanged(logSession.fileUri, metadataStore, outputChannel);
        // Suite integration (R1): write the offline diagnostic mirror only after scans
        // settle, so the envelope reflects this session's freshly-persisted signals.
        writeSessionDiagnosticEnvelope(logSession.fileUri, metadataStore, outputChannel);
    }).catch(() => {});

    scanAnrRiskForSession(logSession.fileUri, metadataStore, outputChannel);

    detectAppVersion().then(async (version) => {
        if (version) {
            await metadataStore.setAppVersion(logSession.fileUri, version);
            outputChannel.appendLine(`App version: ${version}`);
        }
    }).catch((err: unknown) => {
        outputChannel.appendLine(`Failed to detect app version: ${err}`);
    });

    storeSessionDeviceInfo(logSession.fileUri, params.debugAdapterType, metadataStore, outputChannel);

    // Refresh signals sidebar after metadata scans complete
    setTimeout(() => vscode.commands.executeCommand('saropaLogCapture.refreshRecurringSignals'), 3000);

    const filename = logSession.fileUri.fsPath.split(/[\\/]/).pop() ?? '';

    // afterCaptureAction controls post-capture behavior:
    // - "ask": show the summary toast with Open / Copy / Always Open / Don't Ask buttons
    // - "openLog": silently open the log in the viewer (no toast)
    // - "nothing": do nothing (no toast, no auto-open)
    if (config.afterCaptureAction === 'openLog') {
        void vscode.commands.executeCommand('saropaLogCapture.openSession', { uri: logSession.fileUri });
    } else if (config.afterCaptureAction === 'ask') {
        showSummaryNotification(withLogUri(generateSummary(filename, stats), logSession.fileUri));
    }
}

/** Auto-summary (idea #10): log how this session differs from its predecessor to the output
 *  channel. Best-effort and silent — a missing predecessor or read failure simply logs nothing. */
function logWhatChanged(
    fileUri: vscode.Uri, store: SessionMetadataStore, out: vscode.OutputChannel,
): void {
    Promise.all([
        store.loadMetadata(fileUri),
        loadFilteredMetas('all').catch(() => [] as readonly LoadedMeta[]),
    ]).then(([current, allMetas]) => {
        const previous = pickPreviousMeta(allMetas, path.basename(fileUri.fsPath));
        const summary = formatSessionDelta(computeSessionDelta(current, previous?.meta));
        if (summary) { out.appendLine(summary); }
        // Debugging velocity (idea #14): fix rate across all sessions, reusing the metas just loaded.
        const velocity = formatVelocityLine(allMetas);
        if (velocity) { out.appendLine(velocity); }
    }).catch(() => { /* metadata may be absent for a brand-new session — nothing to compare */ });
}

/** Format the cross-session fix-rate line (idea #14), or '' when there's too little history. */
function formatVelocityLine(metas: readonly LoadedMeta[]): string {
    const ordered = [...metas]
        .sort((a, b) => parseSessionDate(a.filename) - parseSessionDate(b.filename))
        .map((m) => (m.meta.fingerprints ?? []).map((f) => f.h).filter(Boolean));
    const v = computeDebuggingVelocity(ordered);
    if (!v || v.resolved + v.persisting === 0) { return ''; }
    return `Debugging velocity: ${v.resolved} resolved, ${v.persisting} persisting `
        + `(${v.velocityPct}% fixed; resolved errors lasted ~${v.avgSessionsToResolve} sessions)`;
}

/** The session chronologically just before `currentFilename`. Falls back to the most recent other
 *  session when the current one isn't in the list yet (its metadata may still be settling). */
function pickPreviousMeta(
    metas: readonly LoadedMeta[], currentFilename: string,
): LoadedMeta | undefined {
    const sorted = [...metas].sort((a, b) => parseSessionDate(a.filename) - parseSessionDate(b.filename));
    const idx = sorted.findIndex((m) => m.filename === currentFilename);
    if (idx > 0) { return sorted[idx - 1]; }
    const others = sorted.filter((m) => m.filename !== currentFilename);
    return others.length > 0 ? others[others.length - 1] : undefined;
}

/**
 * Write the Saropa Diagnostic Envelope mirror for the suite (R1). Reads the session's
 * commit off its integration metadata so siblings can correlate per commit. Fully
 * best-effort: any failure is logged and swallowed — it must never break finalization.
 */
function writeSessionDiagnosticEnvelope(
    fileUri: vscode.Uri,
    store: SessionMetadataStore,
    out: vscode.OutputChannel,
): void {
    store.loadMetadata(fileUri).then(async (meta) => {
        const commitSha = getSessionCommit(meta.integrations);
        const wrote = await writeLogCaptureDiagnostics({
            commitSha,
            generatedAt: new Date().toISOString(),
        });
        if (wrote) {
            out.appendLine('Wrote .saropa/diagnostics/log-capture.json (suite diagnostic mirror)');
        }
    }).catch((err: unknown) => {
        out.appendLine(`Failed to write diagnostic envelope: ${err}`);
    });
}

/** Async: scan log file for ANR risk patterns and store results in metadata. */
function scanAnrRiskForSession(
    fileUri: vscode.Uri,
    store: SessionMetadataStore,
    out: vscode.OutputChannel,
): void {
    Promise.resolve(vscode.workspace.fs.readFile(fileUri)).then(async (raw) => {
        const body = extractBody(Buffer.from(raw).toString('utf-8'));
        const risk = scanAnrRisk(body);
        if (risk.score === 0) { return; }
        const sev = await countSeveritiesChunked(body);
        const meta = await store.loadMetadata(fileUri);
        meta.anrCount = sev.anrs;
        meta.anrRiskLevel = risk.level;
        await store.saveMetadata(fileUri, meta);
        out.appendLine(`ANR risk: ${risk.level} (score ${risk.score}) — ${risk.signals.join(', ')}`);
    }).catch((err: unknown) => {
        out.appendLine(`Failed to scan ANR risk: ${err}`);
    });
}

/** Store debug adapter type and detect target device from log file content. */
function storeSessionDeviceInfo(
    fileUri: vscode.Uri, adapterType: string,
    store: SessionMetadataStore, out: vscode.OutputChannel,
): void {
    store.loadMetadata(fileUri).then(async (meta) => {
        meta.debugAdapterType = adapterType;
        const target = await detectTargetDevice(fileUri).catch(() => undefined);
        if (target) { meta.debugTarget = target; }
        await store.saveMetadata(fileUri, meta);
        if (target) { out.appendLine(`Debug target: ${target}`); }
    }).catch((err: unknown) => {
        out.appendLine(`Failed to store device info: ${err}`);
    });
}

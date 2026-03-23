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
import { scanForPerfFingerprints } from '../misc/perf-fingerprint';
import { scanAnrRisk } from '../analysis/anr-risk-scorer';
import { detectAppVersion } from '../misc/app-version';
import { detectTargetDevice } from '../misc/device-detector';
import { countSeverities, extractBody } from '../../ui/session/session-severity-counts';
import {
    generateSummary, showSummaryNotification, withLogUri, SessionStats,
} from './session-summary';
import {
    getDefaultIntegrationRegistry,
    createIntegrationContext,
    createIntegrationEndContext,
} from '../integrations';
import { stopExternalLogTailers } from '../integrations/external-log-tailer';
import { writeUnifiedSessionLogIfEnabled } from './unified-session-log-writer';
import { scanAndPersistDriftSqlFingerprintSummary } from './session-drift-sql-fingerprint-persist';

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
    // Always dispose external log watchers (provider stops when adapter enabled; if disabled mid-session, this still closes handles).
    stopExternalLogTailers();
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

    const pPerf = scanForPerfFingerprints(logSession.fileUri).then(async (pfs) => {
        if (pfs.length > 0) {
            await metadataStore.setPerfFingerprints(logSession.fileUri, pfs);
            outputChannel.appendLine(`Perf fingerprints: ${pfs.length} operations`);
        }
    }).catch((err) => {
        outputChannel.appendLine(`Failed to scan perf fingerprints: ${err}`);
    });

    const pDriftSql = scanAndPersistDriftSqlFingerprintSummary(logSession.fileUri, metadataStore, outputChannel);

    Promise.allSettled([pCorr, pFp, pPerf, pDriftSql]).then(() => {
        params.onReportsIndexReady?.(logSession.fileUri);
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

    // Refresh recurring errors sidebar after metadata scans complete.
    setTimeout(() => vscode.commands.executeCommand('saropaLogCapture.refreshRecurringErrors'), 3000);

    const filename = logSession.fileUri.fsPath.split(/[\\/]/).pop() ?? '';
    showSummaryNotification(withLogUri(generateSummary(filename, stats), logSession.fileUri));

    if (config.autoOpen) {
        await vscode.window.showTextDocument(logSession.fileUri);
    }
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
        const sev = countSeverities(body);
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

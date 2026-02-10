/**
 * Session lifecycle helpers extracted from SessionManagerImpl.
 * Handles initialization and finalization of log sessions.
 */

import * as vscode from 'vscode';
import * as os from 'os';
import { getConfig, getLogDirectoryUri } from './config';
import { LogSession, SessionContext } from './log-session';
import { enforceFileRetention } from './file-retention';
import { checkGitignore } from './gitignore-checker';
import { ExclusionRule, parseExclusionPattern } from './exclusion-matcher';
import { AutoTagger } from './auto-tagger';
import { KeywordWatcher } from './keyword-watcher';
import { SessionMetadataStore } from './session-metadata';
import { scanForCorrelationTags } from './correlation-scanner';
import { scanForFingerprints } from './error-fingerprint';
import { scanAnrRisk } from './anr-risk-scorer';
import { detectAppVersion } from './app-version';
import { countSeverities, extractBody } from '../ui/session-severity-counts';
import {
    generateSummary, showSummaryNotification, SessionStats,
} from './session-summary';
import { collectDevEnvironment } from './environment-collector';

/** Result of initializing a new log session. */
export interface SessionSetupResult {
    readonly logSession: LogSession;
    readonly exclusionRules: ExclusionRule[];
    readonly autoTagger: AutoTagger;
}

/** Parameters for session initialization. */
export interface InitSessionParams {
    readonly session: vscode.DebugSession;
    readonly context: vscode.ExtensionContext;
    readonly outputChannel: vscode.OutputChannel;
    readonly onLineCount: (count: number) => void;
    readonly onSplit: (newUri: vscode.Uri, partNumber: number) => void;
}

/** Get the first workspace folder (fallback when session has none). */
export function getWorkspaceFolder(): vscode.WorkspaceFolder | undefined {
    return vscode.workspace.workspaceFolders?.[0];
}

/** Create and start a new log session for a debug session. */
export async function initializeSession(
    params: InitSessionParams,
): Promise<SessionSetupResult | undefined> {
    const { session, context, outputChannel, onLineCount, onSplit } = params;
    const config = getConfig();
    if (!config.enabled) { return undefined; }

    const workspaceFolder = session.workspaceFolder ?? getWorkspaceFolder();
    if (!workspaceFolder) {
        outputChannel.appendLine('No workspace folder found. Skipping capture.');
        return undefined;
    }

    checkGitignore(context, workspaceFolder, config.logDirectory).catch((err) => {
        outputChannel.appendLine(`Gitignore check failed: ${err}`);
    });
    const retentionStore = new SessionMetadataStore();
    enforceFileRetention(getLogDirectoryUri(workspaceFolder), config.maxLogFiles, retentionStore).catch((err) => {
        outputChannel.appendLine(`File retention failed: ${err}`);
    });

    const devEnvironment = await collectDevEnvironment().catch(() => undefined);

    const sessionContext: SessionContext = {
        date: new Date(),
        projectName: workspaceFolder.name,
        debugAdapterType: session.type,
        configurationName: session.configuration.name,
        configuration: session.configuration,
        vscodeVersion: vscode.version,
        extensionVersion: context.extension.packageJSON.version ?? '0.0.0',
        os: `${os.type()} ${os.release()} (${os.arch()})`,
        workspaceFolder,
        devEnvironment,
    };

    const logSession = new LogSession(sessionContext, config, onLineCount);
    logSession.setSplitCallback(onSplit);

    const exclusionRules = config.exclusions
        .map(parseExclusionPattern)
        .filter((r): r is ExclusionRule => r !== undefined);
    const autoTagger = new AutoTagger(config.autoTagRules);

    try {
        await logSession.start();
        outputChannel.appendLine(`Session started: ${logSession.fileUri.fsPath}`);
        return { logSession, exclusionRules, autoTagger };
    } catch (err) {
        outputChannel.appendLine(`Failed to start log session: ${err}`);
        return undefined;
    }
}

/** Parameters for session finalization. */
export interface FinalizeSessionParams {
    readonly logSession: LogSession;
    readonly outputChannel: vscode.OutputChannel;
    readonly autoTagger: AutoTagger | null;
    readonly metadataStore: SessionMetadataStore;
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
    const { logSession, outputChannel, autoTagger, metadataStore } = params;

    try {
        await logSession.stop();
        outputChannel.appendLine(`Session stopped: ${logSession.fileUri.fsPath}`);
    } catch (err) {
        outputChannel.appendLine(`Error stopping log session: ${err}`);
    }

    if (autoTagger?.hasTriggeredTags()) {
        const autoTags = autoTagger.getTriggeredTags();
        metadataStore.setAutoTags(logSession.fileUri, autoTags).catch((err) => {
            outputChannel.appendLine(`Failed to save auto-tags: ${err}`);
        });
        outputChannel.appendLine(`Auto-tags applied: ${autoTags.join(', ')}`);
    }

    scanForCorrelationTags(logSession.fileUri).then(async (corrTags) => {
        if (corrTags.length > 0) {
            await metadataStore.setCorrelationTags(logSession.fileUri, corrTags);
            outputChannel.appendLine(`Correlation tags: ${corrTags.join(', ')}`);
        }
    }).catch((err) => {
        outputChannel.appendLine(`Failed to scan correlation tags: ${err}`);
    });

    scanForFingerprints(logSession.fileUri).then(async (fps) => {
        if (fps.length > 0) {
            await metadataStore.setFingerprints(logSession.fileUri, fps);
            outputChannel.appendLine(`Error fingerprints: ${fps.length} patterns`);
        }
    }).catch((err) => {
        outputChannel.appendLine(`Failed to scan fingerprints: ${err}`);
    });

    scanAnrRiskForSession(logSession.fileUri, metadataStore, outputChannel);

    detectAppVersion().then(async (version) => {
        if (version) {
            await metadataStore.setAppVersion(logSession.fileUri, version);
            outputChannel.appendLine(`App version: ${version}`);
        }
    }).catch((err: unknown) => {
        outputChannel.appendLine(`Failed to detect app version: ${err}`);
    });

    const filename = logSession.fileUri.fsPath.split(/[\\/]/).pop() ?? '';
    showSummaryNotification(generateSummary(filename, stats));

    const config = getConfig();
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

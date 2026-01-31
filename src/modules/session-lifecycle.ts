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
import {
    generateSummary, showSummaryNotification, SessionStats,
} from './session-summary';

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
    enforceFileRetention(getLogDirectoryUri(workspaceFolder), config.maxLogFiles).catch((err) => {
        outputChannel.appendLine(`File retention failed: ${err}`);
    });

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
    readonly watcher: KeywordWatcher;
    readonly autoTagger: AutoTagger | null;
    readonly metadataStore: SessionMetadataStore;
}

/** Build session statistics for the summary notification. */
export function buildSessionStats(
    logSession: LogSession,
    sessionStartTime: number,
    categoryCounts: Record<string, number>,
    watcher: KeywordWatcher,
    floodSuppressedTotal: number,
): SessionStats {
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

    const filename = logSession.fileUri.fsPath.split(/[\\/]/).pop() ?? '';
    showSummaryNotification(generateSummary(filename, stats));

    const config = getConfig();
    if (config.autoOpen) {
        await vscode.window.showTextDocument(logSession.fileUri);
    }
}

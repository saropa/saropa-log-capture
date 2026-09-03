/**
 * Session initialization — creates and starts a new log session.
 * Split from session-lifecycle.ts for file-length compliance.
 */

import * as vscode from 'vscode';
import * as os from 'os';
import { getConfig, getLogDirectoryUri } from '../config/config';
import { LogSession, SessionContext } from '../capture/log-session';
// LineData: shared shape for everything broadcast to the viewer/line listeners (bug_010 fix).
import type { LineData } from './session-event-bus';
import { enforceFileRetention } from '../config/file-retention';
import { organizeLogFiles } from '../misc/folder-organizer';
import { checkGitignore } from '../config/gitignore-checker';
import { ExclusionRule, parseExclusionPattern } from '../features/exclusion-matcher';
import { AutoTagger } from '../misc/auto-tagger';
import { SessionMetadataStore } from './session-metadata';
import {
    getDefaultIntegrationRegistry,
    createIntegrationContext,
    type MetaContribution,
} from '../integrations';
import { startTerminalCapture } from '../integrations/terminal-capture';
import { startExternalLogTailers } from '../integrations/external-log-tailer';
import { updateExternalLogTailStatus } from '../../ui/shared/external-log-tail-status';
import { collectDevEnvironment } from '../misc/environment-collector';

/** Result of initializing a new log session. */
export interface SessionSetupResult {
    readonly logSession: LogSession;
    readonly exclusionRules: ExclusionRule[];
    readonly autoTagger: AutoTagger;
    /** Integration adapter ids that contributed at start (for status bar). */
    readonly integrationContributorIds: string[];
}

/** Parameters for session initialization. */
export interface InitSessionParams {
    readonly session: vscode.DebugSession;
    readonly context: vscode.ExtensionContext;
    readonly outputChannel: vscode.OutputChannel;
    readonly onLineCount: (count: number) => void;
    readonly onSplit: (newUri: vscode.Uri, partNumber: number) => void;
    // Broadcast callback shared with the DAP output path (session-manager-events.ts), so streaming
    // integrations (e.g. adb logcat) reach the viewer live instead of only appearing on file reload
    // (bug_010: logcat wrote directly to the file stream and never called this).
    readonly broadcastLine: (data: Omit<LineData, 'watchHits'>) => void;
}

/** Get the first workspace folder (fallback when session has none). */
export function getWorkspaceFolder(): vscode.WorkspaceFolder | undefined {
    return vscode.workspace.workspaceFolders?.[0];
}

/**
 * Build the writeLine callback handed to streaming integrations (e.g. adb logcat).
 *
 * bug_010: this previously called only `logSession.appendLine`, writing straight to the
 * file stream and skipping the broadcast that the DAP output path performs
 * (session-manager-events.ts writeOneLine/processOutputEvent). Line listeners (file
 * watchers, screenshot triggers, API callbacks) and the live viewer never saw logcat
 * output until the log file was reloaded. Mirroring the append+broadcast pair here fixes
 * that without touching the DAP path itself.
 */
function makeStreamingWriteLine(
    logSession: LogSession,
    broadcastLine: (data: Omit<LineData, 'watchHits'>) => void,
): (text: string, category: string, timestamp?: Date) => void {
    return (text, category, timestamp) => {
        const ts = timestamp ?? new Date();
        logSession.appendLine(text, category, ts);
        broadcastLine({
            text, isMarker: false, lineCount: logSession.lineCount,
            physicalLineCount: logSession.physicalLineCount,
            category, timestamp: ts, logFileUri: logSession.fileUri.fsPath,
        });
    };
}

/** Create and start a new log session for a debug session. */
export async function initializeSession(
    params: InitSessionParams,
): Promise<SessionSetupResult | undefined> {
    const { session, context, outputChannel, onLineCount, onSplit, broadcastLine } = params;
    const config = getConfig();
    if (!config.enabled) {
        outputChannel.appendLine('initializeSession: skipped — saropaLogCapture.enabled is false');
        return undefined;
    }

    const workspaceFolder = session.workspaceFolder ?? getWorkspaceFolder();
    if (!workspaceFolder) {
        outputChannel.appendLine('No workspace folder found. Skipping capture.');
        return undefined;
    }

    checkGitignore(context, workspaceFolder, config.logDirectory).catch((err) => {
        outputChannel.appendLine(`Gitignore check failed: ${err}`);
    });
    const logDirUri = getLogDirectoryUri(workspaceFolder);
    const retentionStore = new SessionMetadataStore();
    // Organize first so retention counts settled files; then enforce max log files.
    const organizePromise = config.organizeFolders
        ? organizeLogFiles(logDirUri, retentionStore).catch((err) => {
            outputChannel.appendLine(`Folder organization failed: ${err}`);
        })
        : Promise.resolve();
    organizePromise.then(() =>
        enforceFileRetention(logDirUri, config.maxLogFiles, retentionStore).catch((err) => {
            outputChannel.appendLine(`File retention failed: ${err}`);
        }),
    );

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

    // Integration registry: sync header contributions before start(); async runOnSessionStartAsync merges header + meta when options provided.
    const integrationRegistry = getDefaultIntegrationRegistry();
    const integrationContext = createIntegrationContext(sessionContext, config, outputChannel, context);
    const { lines: extraHeaderLines, contributorIds: integrationContributorIds } =
        integrationRegistry.getHeaderContributions(integrationContext);

    const pendingAsyncMeta: MetaContribution[] = [];

    try {
        await logSession.start(extraHeaderLines);
        outputChannel.appendLine(`Session started: ${logSession.fileUri.fsPath}`);
        integrationRegistry.runOnSessionStartAsync(integrationContext, { logSession, pendingAsyncMeta });
        if (config.integrationsAdapters?.includes('terminal')) {
            const termCfg = config.integrationsTerminal;
            startTerminalCapture({
                whichTerminals: termCfg.whichTerminals,
                maxLines: termCfg.maxLines,
                prefixTimestamp: termCfg.prefixTimestamp,
            });
        }
        if (config.integrationsAdapters?.includes('externalLogs') && config.integrationsExternalLogs.paths.length > 0) {
            startExternalLogTailers(
                workspaceFolder,
                config.integrationsExternalLogs,
                outputChannel,
                updateExternalLogTailStatus,
            );
        }
        // Streaming providers (e.g. adb logcat) spawn child processes and
        // push lines via the writer; the registry gates on isEnabled. writeLine both
        // appends to the file AND broadcasts to the live viewer (bug_010).
        integrationRegistry.runOnSessionStartStreaming(integrationContext, {
            writeLine: makeStreamingWriteLine(logSession, broadcastLine),
        });
        return { logSession, exclusionRules, autoTagger, integrationContributorIds };
    } catch (err) {
        outputChannel.appendLine(`Failed to start log session: ${err}`);
        return undefined;
    }
}

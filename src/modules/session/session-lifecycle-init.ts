/**
 * Session initialization — creates and starts a new log session.
 * Split from session-lifecycle.ts for file-length compliance.
 */

import * as vscode from 'vscode';
import * as os from 'os';
import { getConfig, getLogDirectoryUri } from '../config/config';
import { LogSession, SessionContext } from '../capture/log-session';
import { enforceFileRetention } from '../config/file-retention';
import { organizeLogFiles } from '../misc/folder-organizer';
import { checkGitignore } from '../config/gitignore-checker';
import { ExclusionRule, parseExclusionPattern } from '../features/exclusion-matcher';
import { AutoTagger } from '../misc/auto-tagger';
import { SessionMetadataStore } from './session-metadata';
import {
    getDefaultIntegrationRegistry,
    createIntegrationContext,
} from '../integrations';
import { startTerminalCapture } from '../integrations/terminal-capture';
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

    // Integration registry: sync header contributions before start(); async runOnSessionStartAsync is fire-and-forget.
    const integrationRegistry = getDefaultIntegrationRegistry();
    const integrationContext = createIntegrationContext(sessionContext, config, outputChannel);
    const { lines: extraHeaderLines, contributorIds: integrationContributorIds } =
        integrationRegistry.getHeaderContributions(integrationContext);

    try {
        await logSession.start(extraHeaderLines);
        outputChannel.appendLine(`Session started: ${logSession.fileUri.fsPath}`);
        integrationRegistry.runOnSessionStartAsync(integrationContext);
        if (config.integrationsAdapters?.includes('terminal')) {
            const termCfg = config.integrationsTerminal;
            startTerminalCapture({
                whichTerminals: termCfg.whichTerminals,
                maxLines: termCfg.maxLines,
                prefixTimestamp: termCfg.prefixTimestamp,
            });
        }
        return { logSession, exclusionRules, autoTagger, integrationContributorIds };
    } catch (err) {
        outputChannel.appendLine(`Failed to start log session: ${err}`);
        return undefined;
    }
}

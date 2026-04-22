"use strict";
/**
 * Session initialization — creates and starts a new log session.
 * Split from session-lifecycle.ts for file-length compliance.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getWorkspaceFolder = getWorkspaceFolder;
exports.initializeSession = initializeSession;
const vscode = __importStar(require("vscode"));
const os = __importStar(require("os"));
const config_1 = require("../config/config");
const log_session_1 = require("../capture/log-session");
const file_retention_1 = require("../config/file-retention");
const folder_organizer_1 = require("../misc/folder-organizer");
const gitignore_checker_1 = require("../config/gitignore-checker");
const exclusion_matcher_1 = require("../features/exclusion-matcher");
const auto_tagger_1 = require("../misc/auto-tagger");
const session_metadata_1 = require("./session-metadata");
const integrations_1 = require("../integrations");
const terminal_capture_1 = require("../integrations/terminal-capture");
const external_log_tailer_1 = require("../integrations/external-log-tailer");
const environment_collector_1 = require("../misc/environment-collector");
/** Get the first workspace folder (fallback when session has none). */
function getWorkspaceFolder() {
    return vscode.workspace.workspaceFolders?.[0];
}
/** Create and start a new log session for a debug session. */
async function initializeSession(params) {
    const { session, context, outputChannel, onLineCount, onSplit } = params;
    const config = (0, config_1.getConfig)();
    if (!config.enabled) {
        outputChannel.appendLine('initializeSession: skipped — saropaLogCapture.enabled is false');
        return undefined;
    }
    const workspaceFolder = session.workspaceFolder ?? getWorkspaceFolder();
    if (!workspaceFolder) {
        outputChannel.appendLine('No workspace folder found. Skipping capture.');
        return undefined;
    }
    (0, gitignore_checker_1.checkGitignore)(context, workspaceFolder, config.logDirectory).catch((err) => {
        outputChannel.appendLine(`Gitignore check failed: ${err}`);
    });
    const logDirUri = (0, config_1.getLogDirectoryUri)(workspaceFolder);
    const retentionStore = new session_metadata_1.SessionMetadataStore();
    // Organize first so retention counts settled files; then enforce max log files.
    const organizePromise = config.organizeFolders
        ? (0, folder_organizer_1.organizeLogFiles)(logDirUri, retentionStore).catch((err) => {
            outputChannel.appendLine(`Folder organization failed: ${err}`);
        })
        : Promise.resolve();
    organizePromise.then(() => (0, file_retention_1.enforceFileRetention)(logDirUri, config.maxLogFiles, retentionStore).catch((err) => {
        outputChannel.appendLine(`File retention failed: ${err}`);
    }));
    const devEnvironment = await (0, environment_collector_1.collectDevEnvironment)().catch(() => undefined);
    const sessionContext = {
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
    const logSession = new log_session_1.LogSession(sessionContext, config, onLineCount);
    logSession.setSplitCallback(onSplit);
    const exclusionRules = config.exclusions
        .map(exclusion_matcher_1.parseExclusionPattern)
        .filter((r) => r !== undefined);
    const autoTagger = new auto_tagger_1.AutoTagger(config.autoTagRules);
    // Integration registry: sync header contributions before start(); async runOnSessionStartAsync merges header + meta when options provided.
    const integrationRegistry = (0, integrations_1.getDefaultIntegrationRegistry)();
    const integrationContext = (0, integrations_1.createIntegrationContext)(sessionContext, config, outputChannel, context);
    const { lines: extraHeaderLines, contributorIds: integrationContributorIds } = integrationRegistry.getHeaderContributions(integrationContext);
    const pendingAsyncMeta = [];
    try {
        await logSession.start(extraHeaderLines);
        outputChannel.appendLine(`Session started: ${logSession.fileUri.fsPath}`);
        integrationRegistry.runOnSessionStartAsync(integrationContext, { logSession, pendingAsyncMeta });
        if (config.integrationsAdapters?.includes('terminal')) {
            const termCfg = config.integrationsTerminal;
            (0, terminal_capture_1.startTerminalCapture)({
                whichTerminals: termCfg.whichTerminals,
                maxLines: termCfg.maxLines,
                prefixTimestamp: termCfg.prefixTimestamp,
            });
        }
        if (config.integrationsAdapters?.includes('externalLogs') && config.integrationsExternalLogs.paths.length > 0) {
            (0, external_log_tailer_1.startExternalLogTailers)(workspaceFolder, config.integrationsExternalLogs.paths, config.integrationsExternalLogs, outputChannel);
        }
        // Streaming providers (e.g. adb logcat) spawn child processes and
        // push lines via the writer; the registry gates on isEnabled.
        integrationRegistry.runOnSessionStartStreaming(integrationContext, {
            writeLine: (text, category, timestamp) => logSession.appendLine(text, category, timestamp ?? new Date()),
        });
        return { logSession, exclusionRules, autoTagger, integrationContributorIds };
    }
    catch (err) {
        outputChannel.appendLine(`Failed to start log session: ${err}`);
        return undefined;
    }
}
//# sourceMappingURL=session-lifecycle-init.js.map
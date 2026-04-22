"use strict";
/**
 * Command registration for the Saropa Log Capture extension.
 * Groups: session lifecycle (start/stop, marker, pause), session actions (open, trash, export),
 * history browse/edit, export, comparison, correlation, signals, bug report, timeline, trash,
 * collection, tools.
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
exports.registerCommands = registerCommands;
const vscode = __importStar(require("vscode"));
const l10n_1 = require("./l10n");
const correlation_scanner_1 = require("./modules/analysis/correlation-scanner");
const commands_comparison_1 = require("./commands-comparison");
const commands_signals_1 = require("./commands-signals");
const commands_bug_report_1 = require("./commands-bug-report");
const commands_quality_1 = require("./commands-quality");
const commands_timeline_1 = require("./commands-timeline");
const commands_trash_1 = require("./commands-trash");
const commands_session_1 = require("./commands-session");
const commands_export_1 = require("./commands-export");
const commands_tools_1 = require("./commands-tools");
const commands_collection_1 = require("./commands-collection");
const commands_external_logs_1 = require("./commands-external-logs");
const commands_learning_1 = require("./commands-learning");
const commands_session_groups_1 = require("./commands-session-groups");
/** Register all extension commands. Called from extension-activation after handler wiring. */
function registerCommands(deps, captureToggle) {
    const { context, collectionStore } = deps;
    context.subscriptions.push(...(0, commands_session_1.sessionLifecycleCommands)(deps, captureToggle), ...(0, commands_session_1.sessionActionCommands)(deps), ...(0, commands_session_1.historyBrowseCommands)(deps), ...(0, commands_session_1.historyEditCommands)(deps), ...(0, commands_export_1.exportCommands)(deps), ...(0, commands_comparison_1.comparisonCommands)(context.extensionUri, deps.broadcaster), ...correlationCommands(deps), ...(0, commands_signals_1.signalsCommands)(deps), ...(0, commands_bug_report_1.bugReportCommands)({ getFileUri: () => deps.viewerProvider.getCurrentFileUri(), context }), ...(0, commands_quality_1.qualityCommands)({ getFileUri: () => deps.viewerProvider.getCurrentFileUri() }), ...(0, commands_timeline_1.timelineCommands)(), ...(0, commands_trash_1.trashCommands)(deps.historyProvider, () => deps.viewerProvider.getCurrentFileUri()), ...(0, commands_collection_1.registerCollectionCommands)({ context, collectionStore, historyProvider: deps.historyProvider, viewerProvider: deps.viewerProvider }), ...(0, commands_tools_1.toolCommands)(deps), ...(0, commands_external_logs_1.externalLogsCommands)(deps), ...(0, commands_learning_1.learningCommands)(deps), ...(0, commands_session_groups_1.sessionGroupCommands)(deps.historyProvider, deps.viewerProvider, deps.collectionStore), walkthroughCommand());
}
/** Opens the Getting Started walkthrough in VS Code's native walkthrough UI. */
function walkthroughCommand() {
    return vscode.commands.registerCommand('saropaLogCapture.openWalkthrough', () => {
        void vscode.commands.executeCommand('workbench.action.openWalkthrough', 'saropa.saropa-log-capture#saropaLogCapture.getStarted', false);
    });
}
function correlationCommands(deps) {
    const { historyProvider } = deps;
    return [
        vscode.commands.registerCommand('saropaLogCapture.rescanTags', async (item) => {
            if (!item?.uri) {
                return;
            }
            const tags = await (0, correlation_scanner_1.scanForCorrelationTags)(item.uri);
            await historyProvider.getMetaStore().setCorrelationTags(item.uri, tags);
            historyProvider.refresh();
            vscode.window.showInformationMessage((0, l10n_1.t)('msg.foundCorrelationTags', String(tags.length), tags.length !== 1 ? 's' : ''));
        }),
    ];
}
//# sourceMappingURL=commands.js.map
"use strict";
/** Export-related commands (HTML, CSV, JSON, SLC, Loki). */
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
exports.exportCommands = exportCommands;
const vscode = __importStar(require("vscode"));
const l10n_1 = require("./l10n");
const config_1 = require("./modules/config/config");
const html_export_1 = require("./modules/export/html-export");
const html_export_interactive_1 = require("./modules/export/html-export-interactive");
const export_formats_1 = require("./modules/export/export-formats");
const slc_bundle_1 = require("./modules/export/slc-bundle");
const loki_export_1 = require("./modules/export/loki-export");
const build_ci_1 = require("./modules/integrations/providers/build-ci");
const commands_export_signals_1 = require("./commands-export-signals");
const commands_export_helpers_1 = require("./commands-export-helpers");
function exportCommands(deps) {
    const { context, viewerProvider, historyProvider, collectionStore } = deps;
    return [
        (0, commands_export_helpers_1.htmlExportCmd)('exportHtml', html_export_1.exportToHtml),
        (0, commands_export_helpers_1.htmlExportCmd)('exportHtmlInteractive', html_export_interactive_1.exportToInteractiveHtml),
        (0, commands_export_helpers_1.fileExportCmd)('exportCsv', export_formats_1.exportToCsv),
        (0, commands_export_helpers_1.fileExportCmd)('exportJson', export_formats_1.exportToJson),
        (0, commands_export_helpers_1.fileExportCmd)('exportJsonl', export_formats_1.exportToJsonl),
        (0, commands_export_signals_1.exportSignalsSummaryCmd)(viewerProvider, collectionStore),
        vscode.commands.registerCommand('saropaLogCapture.exportSlc', async (item) => {
            const uri = item?.uri ?? viewerProvider.getCurrentFileUri();
            if (!uri) {
                void vscode.window.showWarningMessage((0, l10n_1.t)('msg.openLogFirst'));
                return;
            }
            const outUri = await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: (0, l10n_1.t)('progress.exportSlc') }, () => (0, slc_bundle_1.exportSessionToSlc)(uri));
            if (outUri) {
                const action = await vscode.window.showInformationMessage((0, l10n_1.t)('msg.exportedTo', outUri.fsPath.split(/[\\/]/).pop() ?? ''), (0, l10n_1.t)('action.open'));
                if (action === (0, l10n_1.t)('action.open')) {
                    await vscode.window.showTextDocument(outUri);
                }
            }
        }),
        vscode.commands.registerCommand('saropaLogCapture.importSlc', async () => {
            const uris = await vscode.window.showOpenDialog({
                filters: { [(0, l10n_1.t)('filter.slcBundles')]: ['slc'] },
                canSelectMany: true,
                title: (0, l10n_1.t)('title.importSlc'),
            });
            if (!uris?.length) {
                return;
            }
            let lastResult;
            await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: (0, l10n_1.t)('progress.importSlc') }, async () => {
                for (const uri of uris) {
                    const result = await (0, slc_bundle_1.importSlcBundle)(uri);
                    if (result) {
                        lastResult = result;
                    }
                }
            });
            if (lastResult && 'mainLogUri' in lastResult) {
                historyProvider.refresh();
                await vscode.commands.executeCommand('saropaLogCapture.logViewer.focus');
                await viewerProvider.loadFromFile(lastResult.mainLogUri);
            }
            else if (lastResult) {
                await (0, commands_export_helpers_1.importCollectionFromSlc)(lastResult.collection, collectionStore, historyProvider);
            }
        }),
        vscode.commands.registerCommand('saropaLogCapture.exportToLoki', async (item) => {
            const config = (0, config_1.getConfig)();
            const loki = config.integrationsLoki;
            if (!loki.enabled || !loki.pushUrl.trim()) {
                void vscode.window.showWarningMessage((0, l10n_1.t)('msg.lokiNotConfigured'));
                return;
            }
            const uri = item?.uri ?? viewerProvider.getCurrentFileUri();
            if (!uri) {
                void vscode.window.showWarningMessage((0, l10n_1.t)('msg.openLogFirst'));
                return;
            }
            const result = await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: (0, l10n_1.t)('progress.exportLoki') }, () => (0, loki_export_1.exportToLoki)(uri, loki, context, historyProvider.getMetaStore()));
            if (result.success) {
                void vscode.window.showInformationMessage((0, l10n_1.t)('msg.lokiPushed'));
            }
            else {
                void vscode.window.showErrorMessage((0, l10n_1.t)('msg.lokiPushFailed', result.errorMessage ?? 'Unknown error'));
            }
        }),
        vscode.commands.registerCommand('saropaLogCapture.setLokiApiKey', async () => {
            const token = await vscode.window.showInputBox({
                prompt: (0, l10n_1.t)('prompt.lokiApiKey'),
                password: true,
                placeHolder: (0, l10n_1.t)('prompt.lokiApiKeyPlaceholder'),
            });
            if (token === undefined) {
                return;
            }
            const trimmed = token.trim();
            if (!trimmed) {
                void vscode.window.showWarningMessage((0, l10n_1.t)('msg.lokiApiKeyEmpty'));
                return;
            }
            await (0, loki_export_1.setLokiBearerToken)(context, trimmed);
            void vscode.window.showInformationMessage((0, l10n_1.t)('msg.lokiApiKeyStored'));
        }),
        (0, commands_export_helpers_1.buildCiTokenCmd)(context, { commandId: 'setBuildCiGithubToken', label: 'GitHub', setFn: build_ci_1.setBuildCiGithubToken }),
        (0, commands_export_helpers_1.buildCiTokenCmd)(context, { commandId: 'clearBuildCiGithubToken', label: 'GitHub', clearFn: build_ci_1.deleteBuildCiGithubToken }),
        (0, commands_export_helpers_1.buildCiTokenCmd)(context, { commandId: 'setBuildCiAzurePat', label: 'Azure PAT', setFn: build_ci_1.setBuildCiAzurePat }),
        (0, commands_export_helpers_1.buildCiTokenCmd)(context, { commandId: 'clearBuildCiAzurePat', label: 'Azure PAT', clearFn: build_ci_1.deleteBuildCiAzurePat }),
        (0, commands_export_helpers_1.buildCiTokenCmd)(context, { commandId: 'setBuildCiGitlabToken', label: 'GitLab', setFn: build_ci_1.setBuildCiGitlabToken }),
        (0, commands_export_helpers_1.buildCiTokenCmd)(context, { commandId: 'clearBuildCiGitlabToken', label: 'GitLab', clearFn: build_ci_1.deleteBuildCiGitlabToken }),
    ];
}
//# sourceMappingURL=commands-export.js.map
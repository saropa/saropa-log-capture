"use strict";
/** Tool commands: index rebuild, pop-out, search, presets, templates, integrations, reset settings. */
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
exports.toolCommands = toolCommands;
const vscode = __importStar(require("vscode"));
const l10n_1 = require("./l10n");
const log_search_ui_1 = require("./modules/search/log-search-ui");
const log_search_1 = require("./modules/search/log-search");
const deep_links_1 = require("./modules/features/deep-links");
const filter_presets_1 = require("./modules/storage/filter-presets");
const session_templates_1 = require("./modules/session/session-templates");
const session_templates_ui_1 = require("./modules/misc/session-templates-ui");
const integrations_ui_1 = require("./modules/integrations/integrations-ui");
const project_indexer_1 = require("./modules/project-indexer/project-indexer");
const extension_logger_1 = require("./modules/misc/extension-logger");
const extensionId = 'saropa.saropa-log-capture';
const settingsSection = 'saropaLogCapture';
function toolCommands(deps) {
    const { viewerProvider, inlineDecorations, popOutPanel, sessionManager, broadcaster } = deps;
    return [
        vscode.commands.registerCommand('saropaLogCapture.explainRootCauseHypotheses', () => {
            broadcaster.postToWebview({ type: 'triggerExplainRootCauseHypotheses' });
        }),
        vscode.commands.registerCommand('saropaLogCapture.openSqlQueryHistory', () => {
            broadcaster.postToWebview({ type: 'openSqlQueryHistoryPanel' });
        }),
        vscode.commands.registerCommand('saropaLogCapture.showRelatedQueries', () => {
            broadcaster.postToWebview({ type: 'triggerShowRelatedQueries' });
        }),
        vscode.commands.registerCommand('saropaLogCapture.rebuildProjectIndex', async () => {
            const indexer = (0, project_indexer_1.getGlobalProjectIndexer)();
            if (!indexer) {
                (0, extension_logger_1.logExtensionWarn)('rebuildProjectIndex', 'Project index not available (no workspace folder)');
                vscode.window.showWarningMessage('Project index is not available (no workspace folder).');
                return;
            }
            await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: 'Rebuilding project index', cancellable: true }, async (_progress, _token) => {
                const getActiveLogUri = () => sessionManager.getActiveSession()?.fileUri;
                await indexer.build(getActiveLogUri);
            });
            vscode.window.showInformationMessage('Project index rebuilt.');
        }),
        vscode.commands.registerCommand('saropaLogCapture.debugProjectIndexRanking', async () => {
            const indexer = (0, project_indexer_1.getGlobalProjectIndexer)();
            if (!indexer) {
                vscode.window.showWarningMessage('Project index is not available (no workspace folder).');
                return;
            }
            const raw = await vscode.window.showInputBox({
                placeHolder: 'Enter tokens (space/comma separated), e.g. firebase projectId permission',
                prompt: 'Show ranked project-index doc matches for tokens',
                ignoreFocusOut: true,
            });
            if (!raw) {
                return;
            }
            const tokens = raw.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
            if (tokens.length === 0) {
                vscode.window.showInformationMessage('No tokens provided.');
                return;
            }
            await indexer.getOrRebuild(60_000);
            const ranked = indexer.queryDocEntriesByTokensWithDebug(tokens).slice(0, 20);
            if (ranked.length === 0) {
                vscode.window.showInformationMessage(`No project-index docs matched: ${tokens.join(', ')}`);
                return;
            }
            const items = ranked.map((r) => ({
                label: `${r.score}  ${r.doc.relativePath}`,
                description: `${r.doc.tokens.length} tokens`,
                doc: r.doc,
                row: r,
            }));
            const picked = await vscode.window.showQuickPick(items, {
                title: `Project index ranking (${tokens.join(', ')})`,
                placeHolder: 'Pick an entry to open',
                matchOnDescription: true,
            });
            if (!picked) {
                return;
            }
            const action = await vscode.window.showQuickPick([
                { label: 'Open file', value: 'open' },
                { label: 'Copy score breakdown', value: 'copy' },
                { label: 'Copy top 100 as JSON', value: 'copyJson' },
            ], { title: 'Debug ranking action' });
            if (!action) {
                return;
            }
            if (action.value === 'copy') {
                const lines = ranked.map((r) => {
                    const detail = r.contributions
                        .map((c) => `${c.points}:${c.kind}:${c.token}`)
                        .join(', ');
                    return `${r.score}\t${r.doc.relativePath}\t${detail}`;
                });
                const payload = [
                    `tokens\t${tokens.join(',')}`,
                    'score\tpath\tcontributions(points:kind:token)',
                    ...lines,
                ].join('\n');
                await vscode.env.clipboard.writeText(payload);
                vscode.window.showInformationMessage('Copied project index score breakdown to clipboard.');
                return;
            }
            if (action.value === 'copyJson') {
                const top = indexer.queryDocEntriesByTokensWithDebug(tokens).slice(0, 100);
                const payload = JSON.stringify({
                    version: 1,
                    tokens,
                    generatedAt: new Date().toISOString(),
                    results: top.map((r) => ({
                        score: r.score,
                        path: r.doc.relativePath,
                        uri: r.doc.uri,
                        tokenCount: r.doc.tokens.length,
                        contributions: r.contributions,
                    })),
                }, null, 2);
                await vscode.env.clipboard.writeText(payload);
                vscode.window.showInformationMessage('Copied top 100 project index results as JSON.');
                return;
            }
            await vscode.window.showTextDocument(vscode.Uri.parse(picked.doc.uri), { preview: true });
        }),
        vscode.commands.registerCommand('saropaLogCapture.popOutViewer', async () => { await popOutPanel.open(); }),
        vscode.commands.registerCommand('saropaLogCapture.searchLogs', async () => {
            const match = await (0, log_search_ui_1.showSearchQuickPick)();
            if (match) {
                await (0, log_search_1.openLogAtLine)(match);
            }
        }),
        vscode.commands.registerCommand('saropaLogCapture.copyDeepLink', async (item) => {
            if (item?.filename) {
                await (0, deep_links_1.copyDeepLinkToClipboard)(item.filename);
            }
        }),
        vscode.commands.registerCommand('saropaLogCapture.copyFilePath', async (item) => {
            if (!item?.uri) {
                return;
            }
            await vscode.env.clipboard.writeText(item.uri.fsPath);
            vscode.window.showInformationMessage((0, l10n_1.t)('msg.filePathCopied'));
        }),
        vscode.commands.registerCommand('saropaLogCapture.applyPreset', async () => {
            const preset = await (0, filter_presets_1.pickPreset)();
            if (preset) {
                viewerProvider.applyPreset(preset.name);
            }
        }),
        vscode.commands.registerCommand('saropaLogCapture.savePreset', async () => {
            const preset = await (0, filter_presets_1.promptSavePreset)({});
            if (preset) {
                viewerProvider.setPresets((0, filter_presets_1.loadPresets)());
            }
        }),
        vscode.commands.registerCommand('saropaLogCapture.toggleInlineDecorations', () => {
            const enabled = inlineDecorations.toggle();
            vscode.window.showInformationMessage(enabled ? (0, l10n_1.t)('msg.inlineDecorationsEnabled') : (0, l10n_1.t)('msg.inlineDecorationsDisabled'));
        }),
        vscode.commands.registerCommand('saropaLogCapture.applyTemplate', async () => {
            const template = await (0, session_templates_ui_1.pickTemplate)();
            if (template) {
                await (0, session_templates_1.applyTemplate)(template);
                vscode.window.showInformationMessage((0, l10n_1.t)('msg.templateApplied', template.name));
            }
        }),
        vscode.commands.registerCommand('saropaLogCapture.saveTemplate', async () => { await (0, session_templates_ui_1.promptSaveTemplate)(); }),
        vscode.commands.registerCommand('saropaLogCapture.resetAllSettings', resetAllSettings),
        vscode.commands.registerCommand('saropaLogCapture.configureIntegrations', () => (0, integrations_ui_1.showIntegrationsPicker)()),
    ];
}
async function resetAllSettings() {
    const answer = await vscode.window.showWarningMessage((0, l10n_1.t)('msg.resetSettingsConfirm'), { modal: true }, (0, l10n_1.t)('action.reset'));
    if (answer !== (0, l10n_1.t)('action.reset')) {
        return;
    }
    const ext = vscode.extensions.getExtension(extensionId);
    const props = ext?.packageJSON?.contributes?.configuration?.properties;
    if (!props) {
        return;
    }
    const cfg = vscode.workspace.getConfiguration(settingsSection);
    const prefix = `${settingsSection}.`;
    const keys = Object.keys(props)
        .filter(k => k.startsWith(prefix))
        .map(k => k.slice(prefix.length));
    const { Global, Workspace } = vscode.ConfigurationTarget;
    await Promise.all(keys.flatMap(k => [
        cfg.update(k, undefined, Global),
        cfg.update(k, undefined, Workspace),
    ]));
    vscode.window.showInformationMessage((0, l10n_1.t)('msg.settingsReset', String(keys.length)));
}
//# sourceMappingURL=commands-tools.js.map
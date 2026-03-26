"use strict";
/**
 * Investigation mode commands: create, open, switch, add sources, delete.
 * Share, export, and new-from-sessions are in investigation-commands-share and investigation-commands-export.
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
exports.registerInvestigationCommands = registerInvestigationCommands;
const vscode = __importStar(require("vscode"));
const l10n_1 = require("./l10n");
const investigation_panel_1 = require("./ui/investigation/investigation-panel");
const investigation_commands_share_1 = require("./investigation-commands-share");
const investigation_commands_export_1 = require("./investigation-commands-export");
const viewer_message_handler_investigation_1 = require("./ui/provider/viewer-message-handler-investigation");
const investigation_commands_helpers_1 = require("./investigation-commands-helpers");
const commands_investigation_lints_1 = require("./commands-investigation-lints");
function registerInvestigationCommands(deps) {
    const { context, investigationStore, historyProvider, viewerProvider } = deps;
    const shareAndExport = [
        (0, investigation_commands_export_1.registerExportInvestigationCommand)(investigationStore),
        ...(0, investigation_commands_share_1.registerShareCommands)({ context, investigationStore, historyProvider }),
    ];
    return [
        vscode.commands.registerCommand('saropaLogCapture.createInvestigation', async () => {
            const name = await vscode.window.showInputBox({
                prompt: (0, l10n_1.t)('prompt.investigationName'),
                placeHolder: (0, l10n_1.t)('placeholder.investigationName'),
                validateInput: (value) => {
                    if (!value || value.trim().length === 0) {
                        return (0, l10n_1.t)('validation.nameRequired');
                    }
                    if (value.length > 100) {
                        return (0, l10n_1.t)('validation.nameTooLong');
                    }
                    return undefined;
                },
            });
            if (!name) {
                return;
            }
            try {
                const investigation = await investigationStore.createInvestigation({ name });
                await investigationStore.setActiveInvestigationId(investigation.id);
                await (0, investigation_panel_1.showInvestigationPanel)(investigationStore);
                viewerProvider?.postMessage({ type: 'openInsight', tab: 'cases' });
                vscode.window.showInformationMessage((0, l10n_1.t)('msg.investigationCreated', name));
            }
            catch (e) {
                vscode.window.showErrorMessage((0, l10n_1.t)('msg.investigationCreateFailed', e instanceof Error ? e.message : String(e)));
            }
        }),
        vscode.commands.registerCommand('saropaLogCapture.openInvestigation', async () => {
            const investigations = await investigationStore.listInvestigations();
            if (investigations.length === 0) {
                const create = await vscode.window.showInformationMessage((0, l10n_1.t)('msg.noInvestigations'), (0, l10n_1.t)('action.createInvestigation'));
                if (create === (0, l10n_1.t)('action.createInvestigation')) {
                    await vscode.commands.executeCommand('saropaLogCapture.createInvestigation');
                }
                return;
            }
            const activeId = await investigationStore.getActiveInvestigationId();
            const items = investigations.map(inv => ({
                label: inv.name,
                description: inv.id === activeId ? '$(check) Active' : `${inv.sources.length} sources`,
                detail: inv.notes?.slice(0, 100),
                investigation: inv,
            }));
            const picked = await vscode.window.showQuickPick(items, {
                placeHolder: (0, l10n_1.t)('prompt.selectInvestigation'),
                matchOnDescription: true,
                matchOnDetail: true,
            });
            if (picked) {
                await investigationStore.setActiveInvestigationId(picked.investigation.id);
                await (0, investigation_panel_1.showInvestigationPanel)(investigationStore);
                viewerProvider?.postMessage({ type: 'openInsight', tab: 'cases' });
            }
        }),
        vscode.commands.registerCommand('saropaLogCapture.closeInvestigation', async () => {
            await investigationStore.setActiveInvestigationId(undefined);
            (0, investigation_panel_1.disposeInvestigationPanel)();
        }),
        vscode.commands.registerCommand('saropaLogCapture.switchInvestigation', async () => {
            await vscode.commands.executeCommand('saropaLogCapture.openInvestigation');
        }),
        vscode.commands.registerCommand('saropaLogCapture.addToInvestigation', async (item) => {
            const investigation = await (0, investigation_commands_helpers_1.resolveOrPickInvestigation)(investigationStore);
            if (!investigation) {
                return;
            }
            let uri = item?.uri;
            if (!uri) {
                const editor = vscode.window.activeTextEditor;
                uri = editor?.document.uri;
            }
            if (!uri) {
                vscode.window.showWarningMessage((0, l10n_1.t)('msg.noFileToAdd'));
                return;
            }
            const relativePath = vscode.workspace.asRelativePath(uri, false);
            const label = uri.path.split('/').pop() ?? relativePath;
            const isSession = uri.fsPath.endsWith('.log');
            try {
                await investigationStore.addSource(investigation.id, {
                    type: isSession ? 'session' : 'file',
                    relativePath,
                    label,
                });
                // Phase 5 (optional): include a lint snapshot in exported bundles.
                // We pin the Saropa Lints `violations.json` so exported `.slc` bundles can
                // still show lint investigations even if the workspace later changes.
                if (isSession) {
                    const wsRoot = vscode.workspace.workspaceFolders?.[0]?.uri;
                    if (wsRoot) {
                        await (0, commands_investigation_lints_1.tryPinSaropaLintsViolationsSnapshot)(investigationStore, investigation.id, investigation.sources, wsRoot);
                    }
                }
                await (0, investigation_panel_1.refreshInvestigationPanelIfOpen)();
                viewerProvider?.postMessage({ type: 'openInsight', tab: 'cases' });
                vscode.window.showInformationMessage((0, l10n_1.t)('msg.sourceAddedToInvestigation', label, investigation.name));
            }
            catch (e) {
                vscode.window.showErrorMessage(e instanceof Error ? e.message : String(e));
            }
        }),
        vscode.commands.registerCommand('saropaLogCapture.removeFromInvestigation', async (item) => {
            const investigation = await investigationStore.getActiveInvestigation();
            if (!investigation) {
                vscode.window.showWarningMessage((0, l10n_1.t)('msg.noActiveInvestigation'));
                return;
            }
            if (item?.path) {
                await investigationStore.removeSource(investigation.id, item.path);
                await (0, investigation_panel_1.refreshInvestigationPanelIfOpen)();
                return;
            }
            if (investigation.sources.length === 0) {
                vscode.window.showInformationMessage((0, l10n_1.t)('msg.noSourcesInInvestigation'));
                return;
            }
            const items = investigation.sources.map(s => ({
                label: s.label,
                description: s.type,
                path: s.relativePath,
            }));
            const picked = await vscode.window.showQuickPick(items, {
                placeHolder: (0, l10n_1.t)('prompt.selectSourceToRemove'),
            });
            if (picked) {
                await investigationStore.removeSource(investigation.id, picked.path);
                await (0, investigation_panel_1.refreshInvestigationPanelIfOpen)();
                vscode.window.showInformationMessage((0, l10n_1.t)('msg.sourceRemovedFromInvestigation', picked.label));
            }
        }),
        vscode.commands.registerCommand('saropaLogCapture.deleteInvestigation', async () => {
            const investigation = await investigationStore.getActiveInvestigation();
            if (!investigation) {
                const investigations = await investigationStore.listInvestigations();
                if (investigations.length === 0) {
                    vscode.window.showInformationMessage((0, l10n_1.t)('msg.noInvestigations'));
                    return;
                }
                const items = investigations.map(inv => ({
                    label: inv.name,
                    description: `${inv.sources.length} sources`,
                    investigation: inv,
                }));
                const picked = await vscode.window.showQuickPick(items, {
                    placeHolder: (0, l10n_1.t)('prompt.selectInvestigationToDelete'),
                });
                if (!picked) {
                    return;
                }
                const confirm = await vscode.window.showWarningMessage((0, l10n_1.t)('msg.deleteInvestigationConfirm', picked.investigation.name), { modal: true }, (0, l10n_1.t)('action.delete'));
                if (confirm === (0, l10n_1.t)('action.delete')) {
                    await investigationStore.deleteInvestigation(picked.investigation.id);
                    vscode.window.showInformationMessage((0, l10n_1.t)('msg.investigationDeleted', picked.investigation.name));
                }
                return;
            }
            const confirm = await vscode.window.showWarningMessage((0, l10n_1.t)('msg.deleteInvestigationConfirm', investigation.name), { modal: true }, (0, l10n_1.t)('action.delete'));
            if (confirm === (0, l10n_1.t)('action.delete')) {
                await investigationStore.deleteInvestigation(investigation.id);
                (0, investigation_panel_1.disposeInvestigationPanel)();
                vscode.window.showInformationMessage((0, l10n_1.t)('msg.investigationDeleted', investigation.name));
            }
        }),
        vscode.commands.registerCommand('saropaLogCapture.addInsightItemToCase', async (payload) => {
            const line = (0, investigation_commands_helpers_1.formatInsightItemLine)(payload);
            if (!line) {
                vscode.window.showWarningMessage((0, l10n_1.t)('msg.nothingToAddToCase'));
                return;
            }
            const investigations = await investigationStore.listInvestigations();
            if (investigations.length === 0) {
                const create = await vscode.window.showInformationMessage((0, l10n_1.t)('msg.noInvestigations'), (0, l10n_1.t)('action.createInvestigation'));
                if (create === (0, l10n_1.t)('action.createInvestigation')) {
                    await vscode.commands.executeCommand('saropaLogCapture.createInvestigation');
                }
                return;
            }
            const activeId = await investigationStore.getActiveInvestigationId();
            const items = investigations.map(inv => ({
                label: inv.name,
                description: inv.id === activeId ? '$(check) Active' : undefined,
                investigation: inv,
            }));
            const picked = await vscode.window.showQuickPick(items, {
                placeHolder: (0, l10n_1.t)('prompt.selectInvestigation'),
                matchOnDescription: true,
            });
            if (!picked) {
                return;
            }
            const inv = picked.investigation;
            const currentNotes = inv.notes ?? '';
            const newNotes = currentNotes ? `${currentNotes}\n${line}` : line;
            try {
                await investigationStore.updateNotes(inv.id, newNotes);
                await investigationStore.setActiveInvestigationId(inv.id);
                await (0, investigation_panel_1.showInvestigationPanel)(investigationStore);
                viewerProvider?.postMessage({ type: 'openInsight', tab: 'cases' });
                const listPayload = await (0, viewer_message_handler_investigation_1.getInvestigationsListPayload)(investigationStore);
                viewerProvider?.postMessage(listPayload);
                viewerProvider?.postMessage({ type: 'addToCaseCompleted' });
                vscode.window.showInformationMessage((0, l10n_1.t)('msg.sourceAddedToInvestigation', line.slice(0, 50), inv.name));
            }
            catch (e) {
                vscode.window.showErrorMessage(e instanceof Error ? e.message : String(e));
            }
        }),
        ...shareAndExport,
    ];
}
//# sourceMappingURL=commands-investigation.js.map
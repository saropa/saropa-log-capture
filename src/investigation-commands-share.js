"use strict";
/**
 * Investigation share commands: share (gist, file, LAN, upload, etc.), clear history, new from sessions.
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
exports.registerShareCommands = registerShareCommands;
const vscode = __importStar(require("vscode"));
const l10n_1 = require("./l10n");
const slc_bundle_1 = require("./modules/export/slc-bundle");
const gist_uploader_1 = require("./modules/share/gist-uploader");
const share_history_1 = require("./modules/share/share-history");
const lan_server_1 = require("./modules/share/lan-server");
const upload_url_1 = require("./modules/share/upload-url");
const shared_folder_1 = require("./modules/share/shared-folder");
const investigation_panel_1 = require("./ui/investigation/investigation-panel");
const session_history_grouping_1 = require("./ui/session/session-history-grouping");
function registerShareCommands(deps) {
    const { context, investigationStore, historyProvider } = deps;
    return [
        vscode.commands.registerCommand('saropaLogCapture.shareInvestigation', async () => {
            const investigation = await investigationStore.getActiveInvestigation();
            if (!investigation) {
                vscode.window.showWarningMessage((0, l10n_1.t)('msg.noActiveInvestigation'));
                return;
            }
            if (investigation.sources.length === 0) {
                vscode.window.showWarningMessage((0, l10n_1.t)('msg.noSourcesInInvestigation'));
                return;
            }
            const folder = vscode.workspace.workspaceFolders?.[0];
            if (!folder) {
                vscode.window.showWarningMessage((0, l10n_1.t)('msg.slcImportNoWorkspace'));
                return;
            }
            const recent = await (0, share_history_1.getShareHistory)(context);
            const cfg = vscode.workspace.getConfiguration('saropaLogCapture');
            const uploadPutUrl = (cfg.get('share.uploadPutUrl') ?? '').trim();
            const sharedFolderPath = (cfg.get('share.sharedFolderPath') ?? '').trim();
            const items = [
                { label: '$(github) Share via GitHub Gist', value: 'gist', description: (0, l10n_1.t)('share.gistDescription') },
                { label: '$(file-zip) Export as .slc file', value: 'file' },
                { label: '$(link) ' + (0, l10n_1.t)('action.copyDeepLinkLocal'), value: 'copy-deep-link-local', description: (0, l10n_1.t)('share.copyDeepLinkLocalDescription') },
                { label: '$(globe) ' + (0, l10n_1.t)('action.shareOnLan'), value: 'lan' },
            ];
            if (uploadPutUrl) {
                items.push({ label: '$(cloud-upload) ' + (0, l10n_1.t)('action.uploadToUrl'), value: 'upload-url' });
            }
            if (sharedFolderPath) {
                items.push({ label: '$(folder-opened) ' + (0, l10n_1.t)('action.saveToSharedFolder'), value: 'shared-folder' });
            }
            if (recent.length > 0) {
                items.push({ label: '$(history) ' + (0, l10n_1.t)('action.recentShares'), value: 'recent' });
                items.push({ label: '$(trash) ' + (0, l10n_1.t)('action.clearShareHistory'), value: 'clear-history' });
            }
            const choice = await vscode.window.showQuickPick(items, { title: (0, l10n_1.t)('title.shareInvestigation') });
            if (!choice) {
                return;
            }
            if (choice.value === 'clear-history') {
                await (0, share_history_1.clearShareHistory)(context);
                vscode.window.showInformationMessage((0, l10n_1.t)('msg.shareHistoryCleared'));
                return;
            }
            if (choice.value === 'recent') {
                const picked = await vscode.window.showQuickPick(recent.map((e) => ({
                    label: e.investigationName,
                    description: new Date(e.sharedAt).toLocaleString(),
                    value: e.deepLinkUrl,
                    gistUrl: e.gistUrl,
                })), { title: (0, l10n_1.t)('title.recentShares'), matchOnDescription: true });
                if (picked) {
                    await vscode.env.clipboard.writeText(picked.value);
                    vscode.window.showInformationMessage((0, l10n_1.t)('msg.deepLinkCopied', ''));
                }
                return;
            }
            if (choice.value === 'file') {
                await vscode.commands.executeCommand('saropaLogCapture.exportInvestigation');
                return;
            }
            if (choice.value === 'copy-deep-link-local') {
                try {
                    const outUri = await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: (0, l10n_1.t)('progress.exportInvestigation') }, () => (0, slc_bundle_1.exportInvestigationToSlc)(investigation, folder.uri));
                    if (outUri) {
                        const deepLink = `vscode://saropa.saropa-log-capture/import?url=${encodeURIComponent(outUri.toString())}`;
                        await vscode.env.clipboard.writeText(deepLink);
                        vscode.window.showInformationMessage((0, l10n_1.t)('msg.deepLinkLocalCopied'));
                    }
                }
                catch (e) {
                    vscode.window.showErrorMessage(e instanceof Error ? e.message : String(e));
                }
                return;
            }
            if (choice.value === 'lan') {
                try {
                    const { url, stop } = await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: (0, l10n_1.t)('progress.shareInvestigation') }, () => (0, lan_server_1.startShareServer)(investigation, folder.uri));
                    const action = await vscode.window.showInformationMessage((0, l10n_1.t)('msg.lanServerStarted', url), (0, l10n_1.t)('action.copyLink'), (0, l10n_1.t)('action.stopServer'));
                    if (action === (0, l10n_1.t)('action.copyLink')) {
                        await vscode.env.clipboard.writeText(url);
                        vscode.window.showInformationMessage((0, l10n_1.t)('msg.deepLinkCopied', ''));
                    }
                    else if (action === (0, l10n_1.t)('action.stopServer')) {
                        stop();
                    }
                }
                catch (e) {
                    vscode.window.showErrorMessage(e instanceof Error ? e.message : String(e));
                }
                return;
            }
            if (choice.value === 'upload-url') {
                if (!uploadPutUrl) {
                    vscode.window.showWarningMessage((0, l10n_1.t)('msg.uploadUrlNotConfigured'));
                    return;
                }
                try {
                    const buffer = await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: (0, l10n_1.t)('progress.shareInvestigation') }, () => (0, slc_bundle_1.exportInvestigationToBuffer)(investigation, folder.uri));
                    const resultUrl = await (0, upload_url_1.uploadBufferToPutUrl)(buffer, uploadPutUrl);
                    await vscode.env.clipboard.writeText(resultUrl);
                    vscode.window.showInformationMessage((0, l10n_1.t)('msg.uploadedToUrl'));
                }
                catch (e) {
                    vscode.window.showErrorMessage(e instanceof Error ? e.message : String(e));
                }
                return;
            }
            if (choice.value === 'shared-folder') {
                if (!sharedFolderPath) {
                    vscode.window.showWarningMessage((0, l10n_1.t)('msg.sharedFolderNotConfigured'));
                    return;
                }
                try {
                    const fileUri = await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: (0, l10n_1.t)('progress.shareInvestigation') }, () => (0, shared_folder_1.saveToSharedFolder)(investigation, folder.uri, sharedFolderPath));
                    vscode.window.showInformationMessage((0, l10n_1.t)('msg.savedToSharedFolder') + ' ' + fileUri.fsPath);
                }
                catch (e) {
                    vscode.window.showErrorMessage(e instanceof Error ? e.message : String(e));
                }
                return;
            }
            if (choice.value === 'gist') {
                try {
                    const sizeLimitWarnMb = 50;
                    const buffer = await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: (0, l10n_1.t)('progress.shareInvestigation') }, () => (0, slc_bundle_1.exportInvestigationToBuffer)(investigation, folder.uri));
                    const sizeMb = Math.round(buffer.length / (1024 * 1024));
                    if (sizeMb > sizeLimitWarnMb) {
                        const continueLabel = (0, l10n_1.t)('action.continue');
                        const chosen = await vscode.window.showWarningMessage((0, l10n_1.t)('msg.investigationTooLargeWarning', String(sizeMb)), continueLabel, (0, l10n_1.t)('action.cancel'));
                        if (chosen !== continueLabel) {
                            return;
                        }
                    }
                    const result = await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: (0, l10n_1.t)('progress.shareInvestigation') }, () => (0, gist_uploader_1.shareViaGist)(investigation, folder.uri, context, buffer));
                    await (0, share_history_1.addToShareHistory)(context, result, investigation.name);
                    const action = await vscode.window.showInformationMessage((0, l10n_1.t)('msg.investigationShared'), (0, l10n_1.t)('action.copyLink'), (0, l10n_1.t)('action.openGist'));
                    if (action === (0, l10n_1.t)('action.copyLink')) {
                        await vscode.env.clipboard.writeText(result.deepLinkUrl);
                        vscode.window.showInformationMessage((0, l10n_1.t)('msg.deepLinkCopied', ''));
                    }
                    else if (action === (0, l10n_1.t)('action.openGist')) {
                        await vscode.env.openExternal(vscode.Uri.parse(result.gistUrl));
                    }
                }
                catch (e) {
                    vscode.window.showErrorMessage(e instanceof Error ? e.message : String(e));
                }
            }
        }),
        vscode.commands.registerCommand('saropaLogCapture.clearShareHistory', async () => {
            await (0, share_history_1.clearShareHistory)(context);
            vscode.window.showInformationMessage((0, l10n_1.t)('msg.shareHistoryCleared'));
        }),
        vscode.commands.registerCommand('saropaLogCapture.newInvestigationFromSessions', async () => {
            if (!historyProvider) {
                vscode.window.showWarningMessage((0, l10n_1.t)('msg.noSessionsToAdd'));
                return;
            }
            const items = await historyProvider.getAllChildren();
            const sessions = [];
            for (const item of items) {
                if ((0, session_history_grouping_1.isSplitGroup)(item)) {
                    for (const part of item.parts) {
                        sessions.push({ uri: part.uri, filename: part.filename });
                    }
                }
                else {
                    const meta = item;
                    sessions.push({ uri: meta.uri, filename: meta.filename });
                }
            }
            if (sessions.length === 0) {
                vscode.window.showInformationMessage((0, l10n_1.t)('msg.noSessionsToAdd'));
                return;
            }
            const folder = vscode.workspace.workspaceFolders?.[0];
            if (!folder) {
                return;
            }
            const picks = await vscode.window.showQuickPick(sessions.map((s) => ({ label: (s.filename || s.uri.path.split(/[/\\]/).pop()) ?? '', uri: s.uri })), { canPickMany: true, placeHolder: (0, l10n_1.t)('prompt.selectSessionsForInvestigation') });
            if (!picks?.length) {
                return;
            }
            const name = await vscode.window.showInputBox({
                prompt: (0, l10n_1.t)('prompt.investigationName'),
                placeHolder: (0, l10n_1.t)('placeholder.investigationName'),
                validateInput: (v) => (!v || !v.trim() ? (0, l10n_1.t)('validation.nameRequired') : undefined),
            });
            if (!name?.trim()) {
                return;
            }
            try {
                const investigation = await investigationStore.createInvestigation({ name: name.trim() });
                await investigationStore.setActiveInvestigationId(investigation.id);
                for (const p of picks) {
                    const relativePath = vscode.workspace.asRelativePath(p.uri, false);
                    const label = p.uri.path.split(/[/\\]/).pop() ?? relativePath;
                    await investigationStore.addSource(investigation.id, {
                        type: 'session',
                        relativePath,
                        label,
                    });
                }
                await (0, investigation_panel_1.showInvestigationPanel)(investigationStore);
                vscode.window.showInformationMessage((0, l10n_1.t)('msg.investigationCreated', name.trim()));
            }
            catch (e) {
                vscode.window.showErrorMessage(e instanceof Error ? e.message : String(e));
            }
        }),
    ];
}
//# sourceMappingURL=investigation-commands-share.js.map
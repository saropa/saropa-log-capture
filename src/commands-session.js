"use strict";
/** Session lifecycle, actions, and history browse/edit commands. */
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
exports.sessionLifecycleCommands = sessionLifecycleCommands;
exports.sessionActionCommands = sessionActionCommands;
exports.historyBrowseCommands = historyBrowseCommands;
exports.historyEditCommands = historyEditCommands;
const vscode = __importStar(require("vscode"));
const l10n_1 = require("./l10n");
const config_1 = require("./modules/config/config");
const delete_command_1 = require("./modules/features/delete-command");
const viewer_provider_helpers_1 = require("./ui/provider/viewer-provider-helpers");
function sessionLifecycleCommands(deps, captureToggle) {
    const { context, sessionManager, viewerProvider } = deps;
    return [
        vscode.commands.registerCommand('saropaLogCapture.toggleCapture', async () => {
            const cfg = vscode.workspace.getConfiguration('saropaLogCapture');
            const current = cfg.get('enabled', true);
            const newValue = !current;
            /* Write to Workspace scope when a workspace is open, otherwise Global.
             * This fixes the common pitfall where the user enables at User level
             * but a workspace override silently keeps it disabled. */
            const target = vscode.workspace.workspaceFolders
                ? vscode.ConfigurationTarget.Workspace
                : vscode.ConfigurationTarget.Global;
            await cfg.update('enabled', newValue, target);
            captureToggle.setEnabled(newValue);
            vscode.window.showInformationMessage(newValue ? (0, l10n_1.t)('captureToggle.enabled') : (0, l10n_1.t)('captureToggle.disabled'));
        }),
        vscode.commands.registerCommand('saropaLogCapture.start', () => {
            const active = vscode.debug.activeDebugSession;
            if (active && !sessionManager.hasSession(active.id)) {
                sessionManager.startSession(active, context);
            }
        }),
        vscode.commands.registerCommand('saropaLogCapture.stop', async () => {
            const active = vscode.debug.activeDebugSession;
            if (active) {
                await sessionManager.stopSession(active);
            }
        }),
        vscode.commands.registerCommand('saropaLogCapture.pause', () => {
            const paused = sessionManager.togglePause();
            if (paused !== undefined) {
                viewerProvider.setPaused(paused);
            }
        }),
        vscode.commands.registerCommand('saropaLogCapture.open', async () => {
            const s = sessionManager.getActiveSession();
            if (s) {
                await vscode.window.showTextDocument(s.fileUri);
            }
        }),
        vscode.commands.registerCommand('saropaLogCapture.openFolder', async () => {
            const folder = vscode.workspace.workspaceFolders?.[0];
            if (folder) {
                await vscode.commands.executeCommand('revealFileInOS', (0, config_1.getLogDirectoryUri)(folder));
            }
        }),
        vscode.commands.registerCommand('saropaLogCapture.clear', () => {
            sessionManager.clearActiveSession();
        }),
    ];
}
function sessionActionCommands(deps) {
    const { sessionManager, historyProvider } = deps;
    return [
        vscode.commands.registerCommand('saropaLogCapture.delete', async () => { await (0, delete_command_1.handleDeleteCommand)(); }),
        vscode.commands.registerCommand('saropaLogCapture.insertMarker', async () => {
            const text = await vscode.window.showInputBox({
                prompt: (0, l10n_1.t)('msg.markerPrompt'),
                placeHolder: (0, l10n_1.t)('msg.markerPlaceholder'),
            });
            if (text !== undefined) {
                sessionManager.insertMarker(text || undefined);
            }
        }),
        vscode.commands.registerCommand('saropaLogCapture.splitNow', async () => {
            const session = sessionManager.getActiveSession();
            if (!session) {
                vscode.window.showWarningMessage((0, l10n_1.t)('msg.noActiveSessionToSplit'));
                return;
            }
            await session.splitNow();
            historyProvider.refresh();
            vscode.window.showInformationMessage((0, l10n_1.t)('msg.logFileSplit', String(session.partNumber + 1)));
        }),
    ];
}
function historyBrowseCommands(deps) {
    const { viewerProvider, historyProvider } = deps;
    return [
        vscode.commands.registerCommand('saropaLogCapture.refreshHistory', () => {
            historyProvider.refresh();
        }),
        vscode.commands.registerCommand('saropaLogCapture.openSession', async (item) => {
            if (!item?.uri) {
                return;
            }
            await vscode.commands.executeCommand('saropaLogCapture.logViewer.focus');
            await viewerProvider.loadFromFile(item.uri);
            await (0, viewer_provider_helpers_1.updateLastViewed)(deps.context, item.uri);
        }),
        vscode.commands.registerCommand('saropaLogCapture.replay', async () => {
            await vscode.commands.executeCommand('saropaLogCapture.logViewer.focus');
            viewerProvider.startReplay();
        }),
        vscode.commands.registerCommand('saropaLogCapture.openTailedFile', async () => {
            const folder = vscode.workspace.workspaceFolders?.[0];
            if (!folder) {
                void vscode.window.showWarningMessage((0, l10n_1.t)('msg.openWorkspaceFirst'));
                return;
            }
            const cfg = (0, config_1.getConfig)();
            const patterns = cfg.tailPatterns.length > 0 ? cfg.tailPatterns : ['**/*.log'];
            const exclude = '**/node_modules/**';
            const uris = new Map();
            for (const pattern of patterns) {
                const found = await vscode.workspace.findFiles(new vscode.RelativePattern(folder, pattern), exclude, 500);
                for (const u of found) {
                    uris.set(u.fsPath, u);
                }
            }
            const list = [...uris.values()].sort((a, b) => a.fsPath.localeCompare(b.fsPath));
            if (list.length === 0) {
                void vscode.window.showInformationMessage((0, l10n_1.t)('msg.noTailedFiles'));
                return;
            }
            const rel = (u) => vscode.workspace.asRelativePath(u, false);
            const picked = await vscode.window.showQuickPick(list.map((u) => ({ label: rel(u), uri: u })), { placeHolder: (0, l10n_1.t)('msg.selectTailedFile') });
            if (picked?.uri) {
                await vscode.commands.executeCommand('saropaLogCapture.logViewer.focus');
                await viewerProvider.loadFromFile(picked.uri, { tail: true });
            }
        }),
        vscode.commands.registerCommand('saropaLogCapture.deleteSession', async (item) => {
            if (!item?.uri) {
                return;
            }
            const answer = await vscode.window.showWarningMessage((0, l10n_1.t)('msg.deleteFileConfirm', item.filename), { modal: true }, (0, l10n_1.t)('action.delete'));
            if (answer === (0, l10n_1.t)('action.delete')) {
                await vscode.workspace.fs.delete(item.uri);
                historyProvider.refresh();
            }
        }),
    ];
}
function historyEditCommands(deps) {
    const { historyProvider } = deps;
    return [
        vscode.commands.registerCommand('saropaLogCapture.renameSession', async (item) => {
            if (!item?.uri) {
                return;
            }
            const name = await vscode.window.showInputBox({
                prompt: (0, l10n_1.t)('msg.renameSessionPrompt'),
                value: item.filename.replace(/\.log$/, '').replace(/^\d{8}_(?:\d{6}|\d{2}-\d{2}(?:-\d{2})?)_/, ''),
            });
            if (!name || name.trim() === '') {
                return;
            }
            const metaStore = historyProvider.getMetaStore();
            const newUri = await metaStore.renameLogFile(item.uri, name.trim());
            await metaStore.setDisplayName(newUri, name.trim());
            historyProvider.refresh();
        }),
        vscode.commands.registerCommand('saropaLogCapture.tagSession', async (item) => {
            if (!item?.uri) {
                return;
            }
            const meta = await historyProvider.getMetaStore().loadMetadata(item.uri);
            const input = await vscode.window.showInputBox({
                prompt: (0, l10n_1.t)('msg.enterTagsPrompt'),
                value: (meta.tags ?? []).join(', '),
            });
            if (input === undefined) {
                return;
            }
            const tags = input.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
            await historyProvider.getMetaStore().setTags(item.uri, tags);
            historyProvider.refresh();
        }),
    ];
}
//# sourceMappingURL=commands-session.js.map
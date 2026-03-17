/** Session lifecycle, actions, and history browse/edit commands. */

import * as vscode from 'vscode';
import { t } from './l10n';
import { getConfig, getLogDirectoryUri } from './modules/config/config';
import type { CommandDeps } from './commands-deps';
import { handleDeleteCommand } from './modules/features/delete-command';
import { updateLastViewed } from './ui/provider/viewer-provider-helpers';

export function sessionLifecycleCommands(deps: CommandDeps): vscode.Disposable[] {
    const { context, sessionManager, viewerProvider } = deps;
    return [
        vscode.commands.registerCommand('saropaLogCapture.start', () => {
            const active = vscode.debug.activeDebugSession;
            if (active && !sessionManager.hasSession(active.id)) {
                sessionManager.startSession(active, context);
            }
        }),
        vscode.commands.registerCommand('saropaLogCapture.stop', async () => {
            const active = vscode.debug.activeDebugSession;
            if (active) { await sessionManager.stopSession(active); }
        }),
        vscode.commands.registerCommand('saropaLogCapture.pause', () => {
            const paused = sessionManager.togglePause();
            if (paused !== undefined) { viewerProvider.setPaused(paused); }
        }),
        vscode.commands.registerCommand('saropaLogCapture.open', async () => {
            const s = sessionManager.getActiveSession();
            if (s) { await vscode.window.showTextDocument(s.fileUri); }
        }),
        vscode.commands.registerCommand('saropaLogCapture.openFolder', async () => {
            const folder = vscode.workspace.workspaceFolders?.[0];
            if (folder) {
                await vscode.commands.executeCommand('revealFileInOS', getLogDirectoryUri(folder));
            }
        }),
        vscode.commands.registerCommand('saropaLogCapture.clear', () => {
            sessionManager.clearActiveSession();
        }),
    ];
}

export function sessionActionCommands(deps: CommandDeps): vscode.Disposable[] {
    const { sessionManager, historyProvider } = deps;
    return [
        vscode.commands.registerCommand('saropaLogCapture.delete', async () => { await handleDeleteCommand(); }),
        vscode.commands.registerCommand('saropaLogCapture.insertMarker', async () => {
            const text = await vscode.window.showInputBox({
                prompt: t('msg.markerPrompt'),
                placeHolder: t('msg.markerPlaceholder'),
            });
            if (text !== undefined) { sessionManager.insertMarker(text || undefined); }
        }),
        vscode.commands.registerCommand('saropaLogCapture.splitNow', async () => {
            const session = sessionManager.getActiveSession();
            if (!session) {
                vscode.window.showWarningMessage(t('msg.noActiveSessionToSplit'));
                return;
            }
            await session.splitNow();
            historyProvider.refresh();
            vscode.window.showInformationMessage(t('msg.logFileSplit', String(session.partNumber + 1)));
        }),
    ];
}

export function historyBrowseCommands(deps: CommandDeps): vscode.Disposable[] {
    const { viewerProvider, historyProvider } = deps;
    return [
        vscode.commands.registerCommand('saropaLogCapture.refreshHistory', () => {
            historyProvider.refresh();
        }),
        vscode.commands.registerCommand('saropaLogCapture.openSession', async (item: { uri: vscode.Uri }) => {
            if (!item?.uri) { return; }
            await vscode.commands.executeCommand('saropaLogCapture.logViewer.focus');
            await viewerProvider.loadFromFile(item.uri);
            await updateLastViewed(deps.context, item.uri);
        }),
        vscode.commands.registerCommand('saropaLogCapture.replay', async () => {
            await vscode.commands.executeCommand('saropaLogCapture.logViewer.focus');
            viewerProvider.startReplay();
        }),
        vscode.commands.registerCommand('saropaLogCapture.openTailedFile', async () => {
            const folder = vscode.workspace.workspaceFolders?.[0];
            if (!folder) {
                void vscode.window.showWarningMessage(t('msg.openWorkspaceFirst'));
                return;
            }
            const cfg = getConfig();
            const patterns = cfg.tailPatterns.length > 0 ? cfg.tailPatterns : ['**/*.log'];
            const exclude = '**/node_modules/**';
            const uris = new Map<string, vscode.Uri>();
            for (const pattern of patterns) {
                const found = await vscode.workspace.findFiles(new vscode.RelativePattern(folder, pattern), exclude, 500);
                for (const u of found) { uris.set(u.fsPath, u); }
            }
            const list = [...uris.values()].sort((a, b) => a.fsPath.localeCompare(b.fsPath));
            if (list.length === 0) {
                void vscode.window.showInformationMessage(t('msg.noTailedFiles'));
                return;
            }
            const rel = (u: vscode.Uri) => vscode.workspace.asRelativePath(u, false);
            const picked = await vscode.window.showQuickPick(
                list.map((u) => ({ label: rel(u), uri: u })),
                { placeHolder: t('msg.selectTailedFile') },
            );
            if (picked?.uri) {
                await vscode.commands.executeCommand('saropaLogCapture.logViewer.focus');
                await viewerProvider.loadFromFile(picked.uri, { tail: true });
            }
        }),
        vscode.commands.registerCommand('saropaLogCapture.deleteSession',
          async (item: { uri: vscode.Uri; filename: string }) => {
            if (!item?.uri) { return; }
            const answer = await vscode.window.showWarningMessage(
                t('msg.deleteFileConfirm', item.filename),
                { modal: true },
                t('action.delete'),
            );
            if (answer === t('action.delete')) {
                await vscode.workspace.fs.delete(item.uri);
                historyProvider.refresh();
            }
        }),
    ];
}

export function historyEditCommands(deps: CommandDeps): vscode.Disposable[] {
    const { historyProvider } = deps;
    return [
        vscode.commands.registerCommand('saropaLogCapture.renameSession',
          async (item: { uri: vscode.Uri; filename: string }) => {
            if (!item?.uri) { return; }
            const name = await vscode.window.showInputBox({
                prompt: t('msg.renameSessionPrompt'),
                value: item.filename.replace(/\.log$/, '').replace(/^\d{8}_(?:\d{6}|\d{2}-\d{2}(?:-\d{2})?)_/, ''),
            });
            if (!name || name.trim() === '') { return; }
            const metaStore = historyProvider.getMetaStore();
            const newUri = await metaStore.renameLogFile(item.uri, name.trim());
            await metaStore.setDisplayName(newUri, name.trim());
            historyProvider.refresh();
        }),
        vscode.commands.registerCommand('saropaLogCapture.tagSession',
          async (item: { uri: vscode.Uri }) => {
            if (!item?.uri) { return; }
            const meta = await historyProvider.getMetaStore().loadMetadata(item.uri);
            const input = await vscode.window.showInputBox({
                prompt: t('msg.enterTagsPrompt'),
                value: (meta.tags ?? []).join(', '),
            });
            if (input === undefined) { return; }
            const tags = input.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
            await historyProvider.getMetaStore().setTags(item.uri, tags);
            historyProvider.refresh();
        }),
    ];
}

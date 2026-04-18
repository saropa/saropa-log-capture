/**
 * Collection share commands: share (gist, file, LAN, upload, etc.), clear history, new from sessions.
 */

import * as vscode from 'vscode';
import { t } from './l10n';
import { exportCollectionToSlc, exportCollectionToBuffer } from './modules/export/slc-bundle';
import { shareViaGist } from './modules/share/gist-uploader';
import { getShareHistory, addToShareHistory, clearShareHistory } from './modules/share/share-history';
import { startShareServer } from './modules/share/lan-server';
import { uploadBufferToPutUrl } from './modules/share/upload-url';
import { saveToSharedFolder } from './modules/share/shared-folder';
import { showCollectionPanel } from './ui/collection/collection-panel';
import { isSplitGroup, type SessionMetadata, type TreeItem } from './ui/session/session-history-grouping';
import type { CollectionStore } from './modules/collection/collection-store';

export interface ShareCommandsDeps {
    readonly context: vscode.ExtensionContext;
    readonly collectionStore: CollectionStore;
    readonly historyProvider?: { getAllChildren(): Promise<readonly TreeItem[]> };
}

export function registerShareCommands(deps: ShareCommandsDeps): vscode.Disposable[] {
    const { context, collectionStore, historyProvider } = deps;

    return [
        vscode.commands.registerCommand('saropaLogCapture.shareCollection', async () => {
            const collection = await collectionStore.getActiveCollection();
            if (!collection) {
                vscode.window.showWarningMessage(t('msg.noActiveCollection'));
                return;
            }
            if (collection.sources.length === 0) {
                vscode.window.showWarningMessage(t('msg.noSourcesInCollection'));
                return;
            }
            const folder = vscode.workspace.workspaceFolders?.[0];
            if (!folder) {
                vscode.window.showWarningMessage(t('msg.slcImportNoWorkspace'));
                return;
            }

            const recent = await getShareHistory(context);
            const cfg = vscode.workspace.getConfiguration('saropaLogCapture');
            const uploadPutUrl = (cfg.get<string>('share.uploadPutUrl') ?? '').trim();
            const sharedFolderPath = (cfg.get<string>('share.sharedFolderPath') ?? '').trim();

            const items: { label: string; value: string; description?: string }[] = [
                { label: '$(github) Share via GitHub Gist', value: 'gist', description: t('share.gistDescription') },
                { label: '$(file-zip) Export as .slc file', value: 'file' },
                { label: '$(link) ' + t('action.copyDeepLinkLocal'), value: 'copy-deep-link-local', description: t('share.copyDeepLinkLocalDescription') },
                { label: '$(globe) ' + t('action.shareOnLan'), value: 'lan' },
            ];
            if (uploadPutUrl) {
                items.push({ label: '$(cloud-upload) ' + t('action.uploadToUrl'), value: 'upload-url' });
            }
            if (sharedFolderPath) {
                items.push({ label: '$(folder-opened) ' + t('action.saveToSharedFolder'), value: 'shared-folder' });
            }
            if (recent.length > 0) {
                items.push({ label: '$(history) ' + t('action.recentShares'), value: 'recent' });
                items.push({ label: '$(trash) ' + t('action.clearShareHistory'), value: 'clear-history' });
            }

            const choice = await vscode.window.showQuickPick(items, { title: t('title.shareCollection') });
            if (!choice) { return; }

            if (choice.value === 'clear-history') {
                await clearShareHistory(context);
                vscode.window.showInformationMessage(t('msg.shareHistoryCleared'));
                return;
            }

            if (choice.value === 'recent') {
                const picked = await vscode.window.showQuickPick(
                    recent.map((e) => ({
                        label: e.collectionName,
                        description: new Date(e.sharedAt).toLocaleString(),
                        value: e.deepLinkUrl,
                        gistUrl: e.gistUrl,
                    })),
                    { title: t('title.recentShares'), matchOnDescription: true },
                );
                if (picked) {
                    await vscode.env.clipboard.writeText(picked.value);
                    vscode.window.showInformationMessage(t('msg.deepLinkCopied', ''));
                }
                return;
            }

            if (choice.value === 'file') {
                await vscode.commands.executeCommand('saropaLogCapture.exportCollection');
                return;
            }

            if (choice.value === 'copy-deep-link-local') {
                try {
                    const outUri = await vscode.window.withProgress(
                        { location: vscode.ProgressLocation.Notification, title: t('progress.exportCollection') },
                        () => exportCollectionToSlc(collection, folder.uri),
                    );
                    if (outUri) {
                        const deepLink = `vscode://saropa.saropa-log-capture/import?url=${encodeURIComponent(outUri.toString())}`;
                        await vscode.env.clipboard.writeText(deepLink);
                        vscode.window.showInformationMessage(t('msg.deepLinkLocalCopied'));
                    }
                } catch (e) {
                    vscode.window.showErrorMessage(e instanceof Error ? e.message : String(e));
                }
                return;
            }

            if (choice.value === 'lan') {
                try {
                    const { url, stop } = await vscode.window.withProgress(
                        { location: vscode.ProgressLocation.Notification, title: t('progress.shareCollection') },
                        () => startShareServer(collection, folder.uri),
                    );
                    const action = await vscode.window.showInformationMessage(
                        t('msg.lanServerStarted', url),
                        t('action.copyLink'),
                        t('action.stopServer'),
                    );
                    if (action === t('action.copyLink')) {
                        await vscode.env.clipboard.writeText(url);
                        vscode.window.showInformationMessage(t('msg.deepLinkCopied', ''));
                    } else if (action === t('action.stopServer')) {
                        stop();
                    }
                } catch (e) {
                    vscode.window.showErrorMessage(e instanceof Error ? e.message : String(e));
                }
                return;
            }

            if (choice.value === 'upload-url') {
                if (!uploadPutUrl) {
                    vscode.window.showWarningMessage(t('msg.uploadUrlNotConfigured'));
                    return;
                }
                try {
                    const buffer = await vscode.window.withProgress(
                        { location: vscode.ProgressLocation.Notification, title: t('progress.shareCollection') },
                        () => exportCollectionToBuffer(collection, folder.uri),
                    );
                    const resultUrl = await uploadBufferToPutUrl(buffer, uploadPutUrl);
                    await vscode.env.clipboard.writeText(resultUrl);
                    vscode.window.showInformationMessage(t('msg.uploadedToUrl'));
                } catch (e) {
                    vscode.window.showErrorMessage(e instanceof Error ? e.message : String(e));
                }
                return;
            }

            if (choice.value === 'shared-folder') {
                if (!sharedFolderPath) {
                    vscode.window.showWarningMessage(t('msg.sharedFolderNotConfigured'));
                    return;
                }
                try {
                    const fileUri = await vscode.window.withProgress(
                        { location: vscode.ProgressLocation.Notification, title: t('progress.shareCollection') },
                        () => saveToSharedFolder(collection, folder.uri, sharedFolderPath),
                    );
                    vscode.window.showInformationMessage(t('msg.savedToSharedFolder') + ' ' + fileUri.fsPath);
                } catch (e) {
                    vscode.window.showErrorMessage(e instanceof Error ? e.message : String(e));
                }
                return;
            }

            if (choice.value === 'gist') {
                try {
                    const sizeLimitWarnMb = 50;
                    const buffer = await vscode.window.withProgress(
                        { location: vscode.ProgressLocation.Notification, title: t('progress.shareCollection') },
                        () => exportCollectionToBuffer(collection, folder.uri),
                    );
                    const sizeMb = Math.round(buffer.length / (1024 * 1024));
                    if (sizeMb > sizeLimitWarnMb) {
                        const continueLabel = t('action.continue');
                        const chosen = await vscode.window.showWarningMessage(
                            t('msg.collectionTooLargeWarning', String(sizeMb)),
                            continueLabel,
                            t('action.cancel'),
                        );
                        if (chosen !== continueLabel) { return; }
                    }
                    const result = await vscode.window.withProgress(
                        { location: vscode.ProgressLocation.Notification, title: t('progress.shareCollection') },
                        () => shareViaGist(collection, folder.uri, context, buffer),
                    );
                    await addToShareHistory(context, result, collection.name);
                    const action = await vscode.window.showInformationMessage(
                        t('msg.collectionShared'),
                        t('action.copyLink'),
                        t('action.openGist'),
                    );
                    if (action === t('action.copyLink')) {
                        await vscode.env.clipboard.writeText(result.deepLinkUrl);
                        vscode.window.showInformationMessage(t('msg.deepLinkCopied', ''));
                    } else if (action === t('action.openGist')) {
                        await vscode.env.openExternal(vscode.Uri.parse(result.gistUrl));
                    }
                } catch (e) {
                    vscode.window.showErrorMessage(e instanceof Error ? e.message : String(e));
                }
            }
        }),

        vscode.commands.registerCommand('saropaLogCapture.clearShareHistory', async () => {
            await clearShareHistory(context);
            vscode.window.showInformationMessage(t('msg.shareHistoryCleared'));
        }),

        vscode.commands.registerCommand('saropaLogCapture.newCollectionFromSessions', async () => {
            if (!historyProvider) {
                vscode.window.showWarningMessage(t('msg.noSessionsToAdd'));
                return;
            }
            const items: readonly TreeItem[] = await historyProvider.getAllChildren();
            const sessions: { uri: vscode.Uri; filename: string }[] = [];
            for (const item of items) {
                if (isSplitGroup(item)) {
                    for (const part of item.parts) {
                        sessions.push({ uri: part.uri, filename: part.filename });
                    }
                } else {
                    const meta = item as SessionMetadata;
                    sessions.push({ uri: meta.uri, filename: meta.filename });
                }
            }
            if (sessions.length === 0) {
                vscode.window.showInformationMessage(t('msg.noSessionsToAdd'));
                return;
            }
            const folder = vscode.workspace.workspaceFolders?.[0];
            if (!folder) { return; }
            const picks = await vscode.window.showQuickPick(
                sessions.map((s) => ({ label: (s.filename || s.uri.path.split(/[/\\]/).pop()) ?? '', uri: s.uri })),
                { canPickMany: true, placeHolder: t('prompt.selectSessionsForCollection') },
            );
            if (!picks?.length) { return; }
            const name = await vscode.window.showInputBox({
                prompt: t('prompt.collectionName'),
                placeHolder: t('placeholder.collectionName'),
                validateInput: (v) => (!v || !v.trim() ? t('validation.nameRequired') : undefined),
            });
            if (!name?.trim()) { return; }
            try {
                const collection = await collectionStore.createCollection({ name: name.trim() });
                await collectionStore.setActiveCollectionId(collection.id);
                for (const p of picks) {
                    const relativePath = vscode.workspace.asRelativePath(p.uri, false);
                    const label = p.uri.path.split(/[/\\]/).pop() ?? relativePath;
                    await collectionStore.addSource(collection.id, {
                        type: 'session',
                        relativePath,
                        label,
                    });
                }
                await showCollectionPanel(collectionStore);
                vscode.window.showInformationMessage(t('msg.collectionCreated', name.trim()));
            } catch (e) {
                vscode.window.showErrorMessage(e instanceof Error ? e.message : String(e));
            }
        }),
    ];
}

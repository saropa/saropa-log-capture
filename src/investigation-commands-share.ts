/**
 * Investigation share commands: share (gist, file, LAN, upload, etc.), clear history, new from sessions.
 */

import * as vscode from 'vscode';
import { t } from './l10n';
import { exportInvestigationToSlc, exportInvestigationToBuffer } from './modules/export/slc-bundle';
import { shareViaGist } from './modules/share/gist-uploader';
import { getShareHistory, addToShareHistory, clearShareHistory } from './modules/share/share-history';
import { startShareServer } from './modules/share/lan-server';
import { uploadBufferToPutUrl } from './modules/share/upload-url';
import { saveToSharedFolder } from './modules/share/shared-folder';
import { showInvestigationPanel } from './ui/investigation/investigation-panel';
import { isSplitGroup, type SessionMetadata, type TreeItem } from './ui/session/session-history-grouping';
import type { InvestigationStore } from './modules/investigation/investigation-store';

export interface ShareCommandsDeps {
    readonly context: vscode.ExtensionContext;
    readonly investigationStore: InvestigationStore;
    readonly historyProvider?: { getAllChildren(): Promise<readonly TreeItem[]> };
}

export function registerShareCommands(deps: ShareCommandsDeps): vscode.Disposable[] {
    const { context, investigationStore, historyProvider } = deps;

    return [
        vscode.commands.registerCommand('saropaLogCapture.shareInvestigation', async () => {
            const investigation = await investigationStore.getActiveInvestigation();
            if (!investigation) {
                vscode.window.showWarningMessage(t('msg.noActiveInvestigation'));
                return;
            }
            if (investigation.sources.length === 0) {
                vscode.window.showWarningMessage(t('msg.noSourcesInInvestigation'));
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

            const choice = await vscode.window.showQuickPick(items, { title: t('title.shareInvestigation') });
            if (!choice) { return; }

            if (choice.value === 'clear-history') {
                await clearShareHistory(context);
                vscode.window.showInformationMessage(t('msg.shareHistoryCleared'));
                return;
            }

            if (choice.value === 'recent') {
                const picked = await vscode.window.showQuickPick(
                    recent.map((e) => ({
                        label: e.investigationName,
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
                await vscode.commands.executeCommand('saropaLogCapture.exportInvestigation');
                return;
            }

            if (choice.value === 'copy-deep-link-local') {
                try {
                    const outUri = await vscode.window.withProgress(
                        { location: vscode.ProgressLocation.Notification, title: t('progress.exportInvestigation') },
                        () => exportInvestigationToSlc(investigation, folder.uri),
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
                        { location: vscode.ProgressLocation.Notification, title: t('progress.shareInvestigation') },
                        () => startShareServer(investigation, folder.uri),
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
                        { location: vscode.ProgressLocation.Notification, title: t('progress.shareInvestigation') },
                        () => exportInvestigationToBuffer(investigation, folder.uri),
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
                        { location: vscode.ProgressLocation.Notification, title: t('progress.shareInvestigation') },
                        () => saveToSharedFolder(investigation, folder.uri, sharedFolderPath),
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
                        { location: vscode.ProgressLocation.Notification, title: t('progress.shareInvestigation') },
                        () => exportInvestigationToBuffer(investigation, folder.uri),
                    );
                    const sizeMb = Math.round(buffer.length / (1024 * 1024));
                    if (sizeMb > sizeLimitWarnMb) {
                        const continueLabel = t('action.continue');
                        const chosen = await vscode.window.showWarningMessage(
                            t('msg.investigationTooLargeWarning', String(sizeMb)),
                            continueLabel,
                            t('action.cancel'),
                        );
                        if (chosen !== continueLabel) { return; }
                    }
                    const result = await vscode.window.withProgress(
                        { location: vscode.ProgressLocation.Notification, title: t('progress.shareInvestigation') },
                        () => shareViaGist(investigation, folder.uri, context, buffer),
                    );
                    await addToShareHistory(context, result, investigation.name);
                    const action = await vscode.window.showInformationMessage(
                        t('msg.investigationShared'),
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

        vscode.commands.registerCommand('saropaLogCapture.newInvestigationFromSessions', async () => {
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
                { canPickMany: true, placeHolder: t('prompt.selectSessionsForInvestigation') },
            );
            if (!picks?.length) { return; }
            const name = await vscode.window.showInputBox({
                prompt: t('prompt.investigationName'),
                placeHolder: t('placeholder.investigationName'),
                validateInput: (v) => (!v || !v.trim() ? t('validation.nameRequired') : undefined),
            });
            if (!name?.trim()) { return; }
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
                await showInvestigationPanel(investigationStore);
                vscode.window.showInformationMessage(t('msg.investigationCreated', name.trim()));
            } catch (e) {
                vscode.window.showErrorMessage(e instanceof Error ? e.message : String(e));
            }
        }),
    ];
}

/**
 * Investigation mode commands: create, open, switch, add sources, export.
 */

import * as vscode from 'vscode';
import { t } from './l10n';
import { InvestigationStore } from './modules/investigation/investigation-store';
import { exportInvestigationToSlc, exportInvestigationToBuffer } from './modules/export/slc-bundle';
import { shareViaGist } from './modules/share/gist-uploader';
import { getShareHistory, addToShareHistory, clearShareHistory } from './modules/share/share-history';
import { startShareServer } from './modules/share/lan-server';
import { uploadBufferToPutUrl } from './modules/share/upload-url';
import { saveToSharedFolder } from './modules/share/shared-folder';
import { showInvestigationPanel, disposeInvestigationPanel, refreshInvestigationPanelIfOpen } from './ui/investigation/investigation-panel';
import type { Investigation } from './modules/investigation/investigation-types';
import { isSplitGroup, type SessionMetadata, type TreeItem } from './ui/session/session-history-grouping';

export interface InvestigationCommandDeps {
    readonly context: vscode.ExtensionContext;
    readonly investigationStore: InvestigationStore;
    readonly historyProvider?: { getAllChildren(): Promise<readonly TreeItem[]> };
}

export function registerInvestigationCommands(deps: InvestigationCommandDeps): vscode.Disposable[] {
    const { context, investigationStore, historyProvider } = deps;

    return [
        vscode.commands.registerCommand('saropaLogCapture.createInvestigation', async () => {
            const name = await vscode.window.showInputBox({
                prompt: t('prompt.investigationName'),
                placeHolder: t('placeholder.investigationName'),
                validateInput: (value) => {
                    if (!value || value.trim().length === 0) {
                        return t('validation.nameRequired');
                    }
                    if (value.length > 100) {
                        return t('validation.nameTooLong');
                    }
                    return undefined;
                },
            });
            if (!name) { return; }

            try {
                const investigation = await investigationStore.createInvestigation({ name });
                await investigationStore.setActiveInvestigationId(investigation.id);
                await showInvestigationPanel(investigationStore);
                vscode.window.showInformationMessage(t('msg.investigationCreated', name));
            } catch (e) {
                vscode.window.showErrorMessage(t('msg.investigationCreateFailed', e instanceof Error ? e.message : String(e)));
            }
        }),

        vscode.commands.registerCommand('saropaLogCapture.openInvestigation', async () => {
            const investigations = await investigationStore.listInvestigations();
            if (investigations.length === 0) {
                const create = await vscode.window.showInformationMessage(
                    t('msg.noInvestigations'),
                    t('action.createInvestigation'),
                );
                if (create === t('action.createInvestigation')) {
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
                placeHolder: t('prompt.selectInvestigation'),
                matchOnDescription: true,
                matchOnDetail: true,
            });

            if (picked) {
                await investigationStore.setActiveInvestigationId(picked.investigation.id);
                await showInvestigationPanel(investigationStore);
            }
        }),

        vscode.commands.registerCommand('saropaLogCapture.closeInvestigation', async () => {
            await investigationStore.setActiveInvestigationId(undefined);
            disposeInvestigationPanel();
        }),

        vscode.commands.registerCommand('saropaLogCapture.switchInvestigation', async () => {
            await vscode.commands.executeCommand('saropaLogCapture.openInvestigation');
        }),

        vscode.commands.registerCommand('saropaLogCapture.addToInvestigation', async (item?: { uri: vscode.Uri }) => {
            let investigation = await investigationStore.getActiveInvestigation();

            if (!investigation) {
                const investigations = await investigationStore.listInvestigations();
                if (investigations.length === 0) {
                    const name = await vscode.window.showInputBox({
                        prompt: t('prompt.investigationName'),
                        placeHolder: t('placeholder.investigationName'),
                    });
                    if (!name) { return; }
                    investigation = await investigationStore.createInvestigation({ name });
                    await investigationStore.setActiveInvestigationId(investigation.id);
                } else {
                    const items: { label: string; investigation: Investigation | null }[] = investigations.map(inv => ({
                        label: inv.name,
                        investigation: inv,
                    }));
                    items.push({ label: `$(add) ${t('action.createNew')}`, investigation: null });

                    const picked = await vscode.window.showQuickPick(items, {
                        placeHolder: t('prompt.selectInvestigationToAdd'),
                    });
                    if (!picked) { return; }

                    if (picked.investigation === null) {
                        const name = await vscode.window.showInputBox({
                            prompt: t('prompt.investigationName'),
                            placeHolder: t('placeholder.investigationName'),
                        });
                        if (!name) { return; }
                        investigation = await investigationStore.createInvestigation({ name });
                    } else {
                        investigation = picked.investigation;
                    }
                    await investigationStore.setActiveInvestigationId(investigation.id);
                }
            }

            let uri = item?.uri;
            if (!uri) {
                const editor = vscode.window.activeTextEditor;
                uri = editor?.document.uri;
            }

            if (!uri) {
                vscode.window.showWarningMessage(t('msg.noFileToAdd'));
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
                await refreshInvestigationPanelIfOpen();
                vscode.window.showInformationMessage(t('msg.sourceAddedToInvestigation', label, investigation.name));
            } catch (e) {
                vscode.window.showErrorMessage(e instanceof Error ? e.message : String(e));
            }
        }),

        vscode.commands.registerCommand('saropaLogCapture.removeFromInvestigation', async (item?: { path: string }) => {
            const investigation = await investigationStore.getActiveInvestigation();
            if (!investigation) {
                vscode.window.showWarningMessage(t('msg.noActiveInvestigation'));
                return;
            }

            if (item?.path) {
                await investigationStore.removeSource(investigation.id, item.path);
                await refreshInvestigationPanelIfOpen();
                return;
            }

            if (investigation.sources.length === 0) {
                vscode.window.showInformationMessage(t('msg.noSourcesInInvestigation'));
                return;
            }

            const items = investigation.sources.map(s => ({
                label: s.label,
                description: s.type,
                path: s.relativePath,
            }));

            const picked = await vscode.window.showQuickPick(items, {
                placeHolder: t('prompt.selectSourceToRemove'),
            });

            if (picked) {
                await investigationStore.removeSource(investigation.id, picked.path);
                await refreshInvestigationPanelIfOpen();
                vscode.window.showInformationMessage(t('msg.sourceRemovedFromInvestigation', picked.label));
            }
        }),

        vscode.commands.registerCommand('saropaLogCapture.deleteInvestigation', async () => {
            const investigation = await investigationStore.getActiveInvestigation();
            if (!investigation) {
                const investigations = await investigationStore.listInvestigations();
                if (investigations.length === 0) {
                    vscode.window.showInformationMessage(t('msg.noInvestigations'));
                    return;
                }

                const items = investigations.map(inv => ({
                    label: inv.name,
                    description: `${inv.sources.length} sources`,
                    investigation: inv,
                }));

                const picked = await vscode.window.showQuickPick(items, {
                    placeHolder: t('prompt.selectInvestigationToDelete'),
                });

                if (!picked) { return; }

                const confirm = await vscode.window.showWarningMessage(
                    t('msg.deleteInvestigationConfirm', picked.investigation.name),
                    { modal: true },
                    t('action.delete'),
                );
                if (confirm === t('action.delete')) {
                    await investigationStore.deleteInvestigation(picked.investigation.id);
                    vscode.window.showInformationMessage(t('msg.investigationDeleted', picked.investigation.name));
                }
                return;
            }

            const confirm = await vscode.window.showWarningMessage(
                t('msg.deleteInvestigationConfirm', investigation.name),
                { modal: true },
                t('action.delete'),
            );
            if (confirm === t('action.delete')) {
                await investigationStore.deleteInvestigation(investigation.id);
                disposeInvestigationPanel();
                vscode.window.showInformationMessage(t('msg.investigationDeleted', investigation.name));
            }
        }),

        vscode.commands.registerCommand('saropaLogCapture.exportInvestigation', async () => {
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

            try {
                const outUri = await vscode.window.withProgress(
                    { location: vscode.ProgressLocation.Notification, title: t('progress.exportInvestigation') },
                    () => exportInvestigationToSlc(investigation, folder.uri),
                );
                if (outUri) {
                    const action = await vscode.window.showInformationMessage(
                        t('msg.exportedTo', outUri.fsPath.split(/[\\/]/).pop() ?? ''),
                        t('action.open'),
                    );
                    if (action === t('action.open')) {
                        await vscode.window.showTextDocument(outUri);
                    }
                }
            } catch (e) {
                vscode.window.showErrorMessage(e instanceof Error ? e.message : String(e));
            }
        }),

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
                { label: '$(link) ' + t('action.copyDeepLinkLocal'), value: 'copy-deep-link-local' },
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
                        vscode.window.showInformationMessage(t('msg.deepLinkCopied', ''));
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

/**
 * Investigation mode commands: create, open, switch, add sources, delete.
 * Share, export, and new-from-sessions are in investigation-commands-share and investigation-commands-export.
 */

import * as vscode from 'vscode';
import { t } from './l10n';
import { InvestigationStore } from './modules/investigation/investigation-store';
import { showInvestigationPanel, disposeInvestigationPanel, refreshInvestigationPanelIfOpen } from './ui/investigation/investigation-panel';
import type { TreeItem } from './ui/session/session-history-grouping';
import type { Investigation } from './modules/investigation/investigation-types';
import { registerShareCommands } from './investigation-commands-share';
import { registerExportInvestigationCommand } from './investigation-commands-export';

export interface InvestigationCommandDeps {
    readonly context: vscode.ExtensionContext;
    readonly investigationStore: InvestigationStore;
    readonly historyProvider?: { getAllChildren(): Promise<readonly TreeItem[]> };
}

export function registerInvestigationCommands(deps: InvestigationCommandDeps): vscode.Disposable[] {
    const { context, investigationStore, historyProvider } = deps;

    const shareAndExport = [
        registerExportInvestigationCommand(investigationStore),
        ...registerShareCommands({ context, investigationStore, historyProvider }),
    ];

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

        ...shareAndExport,
    ];
}

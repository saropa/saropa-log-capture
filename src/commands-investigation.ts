/**
 * Investigation mode commands: create, open, switch, add sources, delete.
 * Share, export, and new-from-sessions are in investigation-commands-share and investigation-commands-export.
 */

import * as vscode from 'vscode';
import { t } from './l10n';
import { InvestigationStore } from './modules/investigation/investigation-store';
import { showInvestigationPanel, disposeInvestigationPanel, refreshInvestigationPanelIfOpen } from './ui/investigation/investigation-panel';
import type { TreeItem } from './ui/session/session-history-grouping';
import { registerShareCommands } from './investigation-commands-share';
import { registerExportInvestigationCommand } from './investigation-commands-export';
import { getInvestigationsListPayload } from './ui/provider/viewer-message-handler-investigation';
import {
    formatSignalItemLine,
    resolveOrPickInvestigation,
} from './investigation-commands-helpers';
import { tryPinSaropaLintsViolationsSnapshot } from './commands-investigation-lints';

import type { AddSignalItemToCasePayload } from './investigation-commands-helpers';

export type { AddSignalItemToCasePayload } from './investigation-commands-helpers';

export interface InvestigationCommandDeps {
    readonly context: vscode.ExtensionContext;
    readonly investigationStore: InvestigationStore;
    readonly historyProvider?: { getAllChildren(): Promise<readonly TreeItem[]> };
    /** Used to open the viewer's Signal panel to the Cases tab after add/create/open. */
    readonly viewerProvider?: { postMessage(message: unknown): void };
}

export function registerInvestigationCommands(deps: InvestigationCommandDeps): vscode.Disposable[] {
    const { context, investigationStore, historyProvider, viewerProvider } = deps;

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
                viewerProvider?.postMessage({ type: 'openSignalPanel', tab: 'cases' });
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
                viewerProvider?.postMessage({ type: 'openSignalPanel', tab: 'cases' });
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
            const investigation = await resolveOrPickInvestigation(investigationStore);
            if (!investigation) { return; }

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

                // Phase 5 (optional): include a lint snapshot in exported bundles.
                // We pin the Saropa Lints `violations.json` so exported `.slc` bundles can
                // still show lint investigations even if the workspace later changes.
                if (isSession) {
                    const wsRoot = vscode.workspace.workspaceFolders?.[0]?.uri;
                    if (wsRoot) {
                        await tryPinSaropaLintsViolationsSnapshot(
                            investigationStore,
                            investigation.id,
                            investigation.sources,
                            wsRoot,
                        );
                    }
                }

                await refreshInvestigationPanelIfOpen();
                viewerProvider?.postMessage({ type: 'openSignalPanel', tab: 'cases' });
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

        vscode.commands.registerCommand('saropaLogCapture.addSignalItemToCase', async (payload?: AddSignalItemToCasePayload) => {
            const line = formatSignalItemLine(payload);
            if (!line) {
                vscode.window.showWarningMessage(t('msg.nothingToAddToCase'));
                return;
            }
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
                description: inv.id === activeId ? '$(check) Active' : undefined,
                investigation: inv,
            }));
            const picked = await vscode.window.showQuickPick(items, {
                placeHolder: t('prompt.selectInvestigation'),
                matchOnDescription: true,
            });
            if (!picked) { return; }
            const inv = picked.investigation;
            const currentNotes = inv.notes ?? '';
            const newNotes = currentNotes ? `${currentNotes}\n${line}` : line;
            try {
                await investigationStore.updateNotes(inv.id, newNotes);
                await investigationStore.setActiveInvestigationId(inv.id);
                await showInvestigationPanel(investigationStore);
                viewerProvider?.postMessage({ type: 'openSignalPanel', tab: 'cases' });
                const listPayload = await getInvestigationsListPayload(investigationStore);
                viewerProvider?.postMessage(listPayload);
                viewerProvider?.postMessage({ type: 'addToCaseCompleted' });
                vscode.window.showInformationMessage(t('msg.sourceAddedToInvestigation', line.slice(0, 50), inv.name));
            } catch (e) {
                vscode.window.showErrorMessage(e instanceof Error ? e.message : String(e));
            }
        }),

        ...shareAndExport,
    ];
}


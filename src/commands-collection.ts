/**
 * Collection mode commands: create, open, switch, add sources, delete.
 * Share, export, and new-from-sessions are in collection-commands-share and collection-commands-export.
 */

import * as vscode from 'vscode';
import { t } from './l10n';
import { CollectionStore } from './modules/collection/collection-store';
import { showCollectionPanel, disposeCollectionPanel, refreshCollectionPanelIfOpen } from './ui/collection/collection-panel';
import type { TreeItem } from './ui/session/session-history-grouping';
import { registerShareCommands } from './collection-commands-share';
import { registerExportCollectionCommand } from './collection-commands-export';
import { getCollectionsListPayload } from './ui/provider/viewer-message-handler-collection';
import {
    formatSignalItemLine,
    generateCollectionName,
    resolveOrPickCollection,
} from './collection-commands-helpers';
import { tryPinSaropaLintsViolationsSnapshot } from './commands-collection-lints';

import type { AddSignalItemToCollectionPayload } from './collection-commands-helpers';

export type { AddSignalItemToCollectionPayload } from './collection-commands-helpers';

export interface CollectionCommandDeps {
    readonly context: vscode.ExtensionContext;
    readonly collectionStore: CollectionStore;
    readonly historyProvider?: { getAllChildren(): Promise<readonly TreeItem[]> };
    /** Used to open the viewer's Collections panel after add/create/open. */
    readonly viewerProvider?: { postMessage(message: unknown): void };
}

export function registerCollectionCommands(deps: CollectionCommandDeps): vscode.Disposable[] {
    const { context, collectionStore, historyProvider, viewerProvider } = deps;

    const shareAndExport = [
        registerExportCollectionCommand(collectionStore),
        ...registerShareCommands({ context, collectionStore, historyProvider }),
    ];

    return [
        vscode.commands.registerCommand('saropaLogCapture.createCollection', async () => {
            const name = await vscode.window.showInputBox({
                prompt: t('prompt.collectionName'),
                placeHolder: t('placeholder.collectionName'),
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
                const collection = await collectionStore.createCollection({ name });
                await collectionStore.setActiveCollectionId(collection.id);
                await showCollectionPanel(collectionStore);
                viewerProvider?.postMessage({ type: 'openCollectionsPanel' });
                vscode.window.showInformationMessage(t('msg.collectionCreated', name));
            } catch (e) {
                vscode.window.showErrorMessage(t('msg.collectionCreateFailed', e instanceof Error ? e.message : String(e)));
            }
        }),

        vscode.commands.registerCommand('saropaLogCapture.openCollection', async () => {
            const collections = await collectionStore.listCollections();
            if (collections.length === 0) {
                const create = await vscode.window.showInformationMessage(
                    t('msg.noCollections'),
                    t('action.createCollection'),
                );
                if (create === t('action.createCollection')) {
                    await vscode.commands.executeCommand('saropaLogCapture.createCollection');
                }
                return;
            }

            const activeId = await collectionStore.getActiveCollectionId();
            const items = collections.map(inv => ({
                label: inv.name,
                description: inv.id === activeId ? '$(check) Active' : `${inv.sources.length} sources`,
                detail: inv.notes?.slice(0, 100),
                collection: inv,
            }));

            const picked = await vscode.window.showQuickPick(items, {
                placeHolder: t('prompt.selectCollection'),
                matchOnDescription: true,
                matchOnDetail: true,
            });

            if (picked) {
                await collectionStore.setActiveCollectionId(picked.collection.id);
                await showCollectionPanel(collectionStore);
                viewerProvider?.postMessage({ type: 'openCollectionsPanel' });
            }
        }),

        vscode.commands.registerCommand('saropaLogCapture.closeCollection', async () => {
            await collectionStore.setActiveCollectionId(undefined);
            disposeCollectionPanel();
        }),

        vscode.commands.registerCommand('saropaLogCapture.switchCollection', async () => {
            await vscode.commands.executeCommand('saropaLogCapture.openCollection');
        }),

        vscode.commands.registerCommand('saropaLogCapture.addToCollection', async (item?: { uri: vscode.Uri }) => {
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

            /* Auto-generate a collection name from the filename:
             * "flutter_debug_2024-01-15.log" → "Flutter Debug 2024-01-15" */
            const suggestedName = generateCollectionName(label);
            const collection = await resolveOrPickCollection(collectionStore, suggestedName);
            if (!collection) { return; }
            const isSession = uri.fsPath.endsWith('.log');

            try {
                await collectionStore.addSource(collection.id, {
                    type: isSession ? 'session' : 'file',
                    relativePath,
                    label,
                });

                // Phase 5 (optional): include a lint snapshot in exported bundles.
                // We pin the Saropa Lints `violations.json` so exported `.slc` bundles can
                // still show lint collections even if the workspace later changes.
                if (isSession) {
                    const wsRoot = vscode.workspace.workspaceFolders?.[0]?.uri;
                    if (wsRoot) {
                        await tryPinSaropaLintsViolationsSnapshot(
                            collectionStore,
                            collection.id,
                            collection.sources,
                            wsRoot,
                        );
                    }
                }

                await refreshCollectionPanelIfOpen();
                viewerProvider?.postMessage({ type: 'openCollectionsPanel' });
                vscode.window.showInformationMessage(t('msg.sourceAddedToCollection', label, collection.name));
            } catch (e) {
                vscode.window.showErrorMessage(e instanceof Error ? e.message : String(e));
            }
        }),

        vscode.commands.registerCommand('saropaLogCapture.removeFromCollection', async (item?: { path: string }) => {
            const collection = await collectionStore.getActiveCollection();
            if (!collection) {
                vscode.window.showWarningMessage(t('msg.noActiveCollection'));
                return;
            }

            if (item?.path) {
                await collectionStore.removeSource(collection.id, item.path);
                await refreshCollectionPanelIfOpen();
                return;
            }

            if (collection.sources.length === 0) {
                vscode.window.showInformationMessage(t('msg.noSourcesInCollection'));
                return;
            }

            const items = collection.sources.map(s => ({
                label: s.label,
                description: s.type,
                path: s.relativePath,
            }));

            const picked = await vscode.window.showQuickPick(items, {
                placeHolder: t('prompt.selectSourceToRemove'),
            });

            if (picked) {
                await collectionStore.removeSource(collection.id, picked.path);
                await refreshCollectionPanelIfOpen();
                vscode.window.showInformationMessage(t('msg.sourceRemovedFromCollection', picked.label));
            }
        }),

        vscode.commands.registerCommand('saropaLogCapture.deleteCollection', async () => {
            const collection = await collectionStore.getActiveCollection();
            if (!collection) {
                const collections = await collectionStore.listCollections();
                if (collections.length === 0) {
                    vscode.window.showInformationMessage(t('msg.noCollections'));
                    return;
                }

                const items = collections.map(inv => ({
                    label: inv.name,
                    description: `${inv.sources.length} sources`,
                    collection: inv,
                }));

                const picked = await vscode.window.showQuickPick(items, {
                    placeHolder: t('prompt.selectCollectionToDelete'),
                });

                if (!picked) { return; }

                const confirm = await vscode.window.showWarningMessage(
                    t('msg.deleteCollectionConfirm', picked.collection.name),
                    { modal: true },
                    t('action.delete'),
                );
                if (confirm === t('action.delete')) {
                    await collectionStore.deleteCollection(picked.collection.id);
                    vscode.window.showInformationMessage(t('msg.collectionDeleted', picked.collection.name));
                }
                return;
            }

            const confirm = await vscode.window.showWarningMessage(
                t('msg.deleteCollectionConfirm', collection.name),
                { modal: true },
                t('action.delete'),
            );
            if (confirm === t('action.delete')) {
                await collectionStore.deleteCollection(collection.id);
                disposeCollectionPanel();
                vscode.window.showInformationMessage(t('msg.collectionDeleted', collection.name));
            }
        }),

        vscode.commands.registerCommand('saropaLogCapture.addSignalItemToCollection', async (payload?: AddSignalItemToCollectionPayload) => {
            const line = formatSignalItemLine(payload);
            if (!line) {
                vscode.window.showWarningMessage(t('msg.nothingToAddToCollection'));
                return;
            }
            const collections = await collectionStore.listCollections();
            if (collections.length === 0) {
                const create = await vscode.window.showInformationMessage(
                    t('msg.noCollections'),
                    t('action.createCollection'),
                );
                if (create === t('action.createCollection')) {
                    await vscode.commands.executeCommand('saropaLogCapture.createCollection');
                }
                return;
            }
            const activeId = await collectionStore.getActiveCollectionId();
            const items = collections.map(inv => ({
                label: inv.name,
                description: inv.id === activeId ? '$(check) Active' : undefined,
                collection: inv,
            }));
            const picked = await vscode.window.showQuickPick(items, {
                placeHolder: t('prompt.selectCollection'),
                matchOnDescription: true,
            });
            if (!picked) { return; }
            const inv = picked.collection;
            const currentNotes = inv.notes ?? '';
            const newNotes = currentNotes ? `${currentNotes}\n${line}` : line;
            try {
                await collectionStore.updateNotes(inv.id, newNotes);
                await collectionStore.setActiveCollectionId(inv.id);
                await showCollectionPanel(collectionStore);
                viewerProvider?.postMessage({ type: 'openCollectionsPanel' });
                const listPayload = await getCollectionsListPayload(collectionStore);
                viewerProvider?.postMessage(listPayload);
                viewerProvider?.postMessage({ type: 'addToCollectionCompleted' });
                vscode.window.showInformationMessage(t('msg.sourceAddedToCollection', line.slice(0, 50), inv.name));
            } catch (e) {
                vscode.window.showErrorMessage(e instanceof Error ? e.message : String(e));
            }
        }),

        ...shareAndExport,
    ];
}


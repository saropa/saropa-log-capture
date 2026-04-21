/**
 * Export command helpers: HTML/file export wrappers, Build/CI token commands, SLC import.
 * Extracted to keep commands-export.ts under the line limit.
 */

import * as vscode from 'vscode';
import { t } from './l10n';
import type { Collection } from './modules/collection/collection-types';
import type { CollectionStore } from './modules/collection/collection-store';
import type { SessionHistoryProvider } from './ui/session/session-history-provider';

export interface CiTokenCmdOptions {
    commandId: string;
    label: string;
    setFn?: (ctx: vscode.ExtensionContext, value: string) => Promise<void>;
    clearFn?: (ctx: vscode.ExtensionContext) => Promise<void>;
}

export function buildCiTokenCmd(
    context: vscode.ExtensionContext,
    opts: CiTokenCmdOptions,
): vscode.Disposable {
    const { commandId, label, setFn, clearFn } = opts;
    return vscode.commands.registerCommand(`saropaLogCapture.${commandId}`, async () => {
        if (setFn) {
            const token = await vscode.window.showInputBox({
                prompt: `Build/CI: enter ${label} token`,
                password: true,
                placeHolder: 'Token or PAT',
            });
            if (token === undefined) { return; }
            const trimmed = token.trim();
            if (!trimmed) {
                void vscode.window.showWarningMessage('Empty value not stored.');
                return;
            }
            await setFn(context, trimmed);
            void vscode.window.showInformationMessage(`Build/CI: ${label} token stored.`);
        } else if (clearFn) {
            await clearFn(context);
            void vscode.window.showInformationMessage(`Build/CI: ${label} token cleared.`);
        }
    });
}

export function htmlExportCmd(
    name: string,
    fn: (uri: vscode.Uri) => Promise<vscode.Uri>,
): vscode.Disposable {
    return vscode.commands.registerCommand(`saropaLogCapture.${name}`,
        async (item: { uri: vscode.Uri }) => {
            if (!item?.uri) { return; }
            await vscode.env.openExternal(await fn(item.uri));
        });
}

export function fileExportCmd(
    name: string,
    fn: (uri: vscode.Uri) => Promise<vscode.Uri>,
): vscode.Disposable {
    return vscode.commands.registerCommand(`saropaLogCapture.${name}`,
        async (item: { uri: vscode.Uri }) => {
            if (!item?.uri) { return; }
            const outUri = await fn(item.uri);
            const action = await vscode.window.showInformationMessage(
                t('msg.exportedTo', outUri.fsPath.split(/[\\/]/).pop() ?? ''),
                t('action.open'),
            );
            if (action === t('action.open')) { await vscode.window.showTextDocument(outUri); }
        });
}

/** Import a collection from an SLC bundle result into the store. */
export async function importCollectionFromSlc(
    inv: Collection,
    store: CollectionStore,
    historyProvider: SessionHistoryProvider,
): Promise<void> {
    const created = await store.createCollection({ name: inv.name, notes: inv.notes });
    try {
        for (const src of inv.sources) {
            if (src.type === 'group') {
                await store.addSource(created.id, { type: 'group', groupId: src.groupId, label: src.label });
            } else {
                await store.addSource(created.id, { type: src.type, relativePath: src.relativePath, label: src.label });
            }
        }
        await store.setActiveCollectionId(created.id);
        historyProvider.refresh();
        await vscode.commands.executeCommand('saropaLogCapture.openCollection');
        vscode.window.showInformationMessage(t('msg.collectionImported', inv.name));
    } catch (e) {
        await store.deleteCollection(created.id).catch(() => {});
        vscode.window.showErrorMessage(e instanceof Error ? e.message : String(e));
    }
}

/**
 * Collection export command: export active collection to .slc file.
 */

import * as vscode from 'vscode';
import { t } from './l10n';
import { exportCollectionToSlc } from './modules/export/slc-bundle';
import type { CollectionStore } from './modules/collection/collection-store';

export function registerExportCollectionCommand(collectionStore: CollectionStore): vscode.Disposable {
    return vscode.commands.registerCommand('saropaLogCapture.exportCollection', async () => {
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

        try {
            const outUri = await vscode.window.withProgress(
                { location: vscode.ProgressLocation.Notification, title: t('progress.exportCollection') },
                () => exportCollectionToSlc(collection, folder.uri),
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
    });
}

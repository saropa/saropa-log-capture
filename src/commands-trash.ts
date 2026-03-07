/** Trash management command registrations. */

import * as vscode from 'vscode';
import { t } from './l10n';
import { getConfig, getLogDirectoryUri, readTrackedFiles } from './modules/config/config';
import { SessionMetadataStore } from './modules/session/session-metadata';
import { SessionHistoryProvider } from './ui/session/session-history-provider';
import { getGlobalProjectIndexer } from './modules/project-indexer/project-indexer';

/** Register trash-related commands. */
export function trashCommands(
    historyProvider: SessionHistoryProvider,
    getCurrentFileUri: () => vscode.Uri | undefined,
): vscode.Disposable[] {
    const metaStore = historyProvider.getMetaStore();
    return [
        vscode.commands.registerCommand('saropaLogCapture.trashSession',
          async (item?: { uri: vscode.Uri; filename: string }) => {
            const uri = item?.uri ?? getCurrentFileUri();
            if (!uri) { return; }
            await metaStore.setTrashed(uri, true);
            if (getConfig().projectIndex.enabled) {
                const idx = getGlobalProjectIndexer();
                if (idx) { idx.removeEntry('reports', vscode.workspace.asRelativePath(uri).replace(/\\/g, '/')).catch(() => {}); }
            }
            historyProvider.invalidateMeta(uri);
            historyProvider.refresh();
        }),
        vscode.commands.registerCommand('saropaLogCapture.restoreSession',
          async (item?: { uri: vscode.Uri; filename: string }) => {
            const uri = item?.uri ?? getCurrentFileUri();
            if (!uri) { return; }
            await metaStore.setTrashed(uri, false);
            if (getConfig().projectIndex.enabled) {
                const idx = getGlobalProjectIndexer();
                if (idx) {
                    metaStore.loadMetadata(uri).then((meta) => idx.upsertReportEntryFromMeta(uri, meta)).catch(() => {});
                }
            }
            historyProvider.invalidateMeta(uri);
            historyProvider.refresh();
        }),
        vscode.commands.registerCommand('saropaLogCapture.emptyTrash', async () => {
            const count = await emptyTrash(metaStore);
            if (count === 0) { vscode.window.showInformationMessage(t('msg.trashEmpty')); }
            if (count > 0) { historyProvider.refresh(); }
        }),
        vscode.commands.registerCommand('saropaLogCapture.toggleTrash', () => {
            const show = !historyProvider.getShowTrash();
            historyProvider.setShowTrash(show);
        }),
    ];
}

async function emptyTrash(metaStore: SessionMetadataStore): Promise<number> {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) { return 0; }
    const logDir = getLogDirectoryUri(folder);
    const { fileTypes, includeSubfolders } = getConfig();
    const files = await readTrackedFiles(logDir, fileTypes, includeSubfolders);
    const trashed: vscode.Uri[] = [];
    for (const rel of files) {
        const uri = vscode.Uri.joinPath(logDir, rel);
        const meta = await metaStore.loadMetadata(uri);
        if (meta.trashed) { trashed.push(uri); }
    }
    if (trashed.length === 0) { return 0; }
    const answer = await vscode.window.showWarningMessage(
        t('msg.deleteTrashConfirm', String(trashed.length)),
        { modal: true },
        t('action.delete'),
    );
    if (answer !== t('action.delete')) { return -1; }
    let deleted = 0;
    for (const uri of trashed) {
        try {
            await vscode.workspace.fs.delete(uri);
            await metaStore.deleteMetadata(uri);
            deleted++;
        } catch { /* file may be locked */ }
    }
    vscode.window.showInformationMessage(t('msg.permanentlyDeletedFromTrash', String(deleted)));
    return deleted;
}

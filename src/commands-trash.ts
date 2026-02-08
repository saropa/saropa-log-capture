/** Trash management command registrations. */

import * as vscode from 'vscode';
import { getConfig, getLogDirectoryUri, readTrackedFiles } from './modules/config';
import { SessionMetadataStore } from './modules/session-metadata';
import { SessionHistoryProvider } from './ui/session-history-provider';

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
            historyProvider.invalidateMeta(uri);
            historyProvider.refresh();
        }),
        vscode.commands.registerCommand('saropaLogCapture.restoreSession',
          async (item?: { uri: vscode.Uri; filename: string }) => {
            const uri = item?.uri ?? getCurrentFileUri();
            if (!uri) { return; }
            await metaStore.setTrashed(uri, false);
            historyProvider.invalidateMeta(uri);
            historyProvider.refresh();
        }),
        vscode.commands.registerCommand('saropaLogCapture.emptyTrash', async () => {
            const count = await emptyTrash(metaStore);
            if (count === 0) { vscode.window.showInformationMessage('Trash is empty.'); }
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
        `Permanently delete ${trashed.length} trashed file(s)? This cannot be undone.`,
        { modal: true }, 'Delete',
    );
    if (answer !== 'Delete') { return -1; }
    let deleted = 0;
    for (const uri of trashed) {
        try {
            const metaUri = metaStore.getMetaUri(uri);
            await vscode.workspace.fs.delete(uri);
            try { await vscode.workspace.fs.delete(metaUri); } catch { /* sidecar may not exist */ }
            deleted++;
        } catch { /* file may be locked */ }
    }
    vscode.window.showInformationMessage(`Permanently deleted ${deleted} file(s) from trash.`);
    return deleted;
}

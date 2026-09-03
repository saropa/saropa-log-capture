import * as vscode from 'vscode';
import { t } from '../../l10n';
import { getConfig, getLogDirectoryUri, readTrackedFiles } from '../config/config';
import { cleanupDeletedSessionMetadata, type SessionMetadataStore } from '../session/session-metadata';

/**
 * Show a quick pick to bulk-delete session files from the reports directory.
 *
 * @param metaStore - Shared metadata store. Passed in (rather than resolved here) so the
 * single-file delete (commands-session.ts) and empty-trash (commands-trash.ts) paths all
 * clean up through the same `cleanupDeletedSessionMetadata()` call — bug_016 found this
 * bulk-delete path was the one deletion path NOT doing so, orphaning metadata/search-index
 * entries for every file removed here.
 */
export async function handleDeleteCommand(metaStore: SessionMetadataStore): Promise<void> {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) {
        return;
    }

    const logDirUri = getLogDirectoryUri(folder);

    const { fileTypes, includeSubfolders } = getConfig();
    const logFiles = (await readTrackedFiles(logDirUri, fileTypes, includeSubfolders))
        .sort()
        .reverse();

    if (logFiles.length === 0) {
        vscode.window.showInformationMessage(t('msg.noSessionFiles'));
        return;
    }

    const selected = await vscode.window.showQuickPick(logFiles, {
        placeHolder: t('prompt.selectSessionsToDelete'),
        canPickMany: true,
    });

    if (selected && selected.length > 0) {
        for (const file of selected) {
            const uri = vscode.Uri.joinPath(logDirUri, file);
            await vscode.workspace.fs.delete(uri);
            // bug_016: bulk delete used to skip metadata/search-index cleanup, unlike the
            // single-file delete and empty-trash paths — orphaning entries that then showed
            // up as phantom sidebar rows for every file removed through this quick pick.
            await cleanupDeletedSessionMetadata(uri, metaStore);
        }
        vscode.window.showInformationMessage(t('msg.deletedSessionFiles', String(selected.length)));
    }
}

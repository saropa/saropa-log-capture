import * as vscode from 'vscode';
import { getConfig, isTrackedFile } from './config';
import type { SessionMetadataStore } from './session-metadata';

const datePrefixPattern = /^(\d{8})_/;

/**
 * Move top-level log files with a yyyymmdd_ prefix into date subfolders.
 * Updates central metadata store when metaStore is provided.
 * @returns The number of files moved.
 */
export async function organizeLogFiles(
    logDirUri: vscode.Uri,
    metaStore?: SessionMetadataStore,
): Promise<number> {
    const { fileTypes } = getConfig();

    let entries: [string, vscode.FileType][];
    try {
        entries = await vscode.workspace.fs.readDirectory(logDirUri);
    } catch {
        return 0;
    }

    const topLevelFiles = entries
        .filter(([name, type]) => type === vscode.FileType.File && isTrackedFile(name, fileTypes))
        .map(([name]) => name);

    let moved = 0;
    for (const name of topLevelFiles) {
        const match = datePrefixPattern.exec(name);
        if (!match) { continue; }

        const dateFolder = match[1];
        const destDir = vscode.Uri.joinPath(logDirUri, dateFolder);
        await vscode.workspace.fs.createDirectory(destDir);

        const srcUri = vscode.Uri.joinPath(logDirUri, name);
        const destUri = vscode.Uri.joinPath(destDir, name);
        const meta = metaStore ? await metaStore.loadMetadata(srcUri) : {};
        await vscode.workspace.fs.rename(srcUri, destUri, { overwrite: true });
        if (metaStore && Object.keys(meta).length > 0) {
            await metaStore.saveMetadata(destUri, meta);
            await metaStore.deleteMetadata(srcUri);
        }
        moved++;
    }

    return moved;
}


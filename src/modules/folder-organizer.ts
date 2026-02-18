import * as vscode from 'vscode';
import { getConfig, isTrackedFile } from './config';

const datePrefixPattern = /^(\d{8})_/;

/**
 * Move top-level log files with a yyyymmdd_ prefix into date subfolders.
 * Also moves companion .meta.json sidecar files.
 * @returns The number of files moved.
 */
export async function organizeLogFiles(
    logDirUri: vscode.Uri,
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
        await vscode.workspace.fs.rename(srcUri, destUri, { overwrite: true });
        moved++;

        await moveSidecar(logDirUri, destDir, name);
    }

    return moved;
}

/** Move the .meta.json sidecar if it exists alongside the log file. */
async function moveSidecar(
    srcDir: vscode.Uri,
    destDir: vscode.Uri,
    logFileName: string,
): Promise<void> {
    const dotIdx = logFileName.lastIndexOf('.');
    if (dotIdx === -1) { return; }
    const sidecarName = logFileName.slice(0, dotIdx) + '.meta.json';
    const srcUri = vscode.Uri.joinPath(srcDir, sidecarName);
    const destUri = vscode.Uri.joinPath(destDir, sidecarName);
    try {
        await vscode.workspace.fs.rename(srcUri, destUri, { overwrite: true });
    } catch {
        // Sidecar may not exist — that's fine.
    }
}

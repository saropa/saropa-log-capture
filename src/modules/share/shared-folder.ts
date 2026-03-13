/**
 * Save investigation .slc to a shared folder path (team namespace). Path can be local or network.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import type { Investigation } from '../investigation/investigation-types';
import { exportInvestigationToBuffer } from '../export/slc-bundle';

/**
 * Save investigation bundle to sharedFolderPath. Path is used as-is if absolute; otherwise relative to workspace root.
 * Returns the file URI written.
 */
export async function saveToSharedFolder(
    investigation: Investigation,
    workspaceUri: vscode.Uri,
    sharedFolderPath: string,
): Promise<vscode.Uri> {
    const buffer = await exportInvestigationToBuffer(investigation, workspaceUri);
    const safeName = (investigation.name.replace(/[^a-zA-Z0-9_\- .]/g, '_').trim() || 'investigation') + '.slc';
    const isAbsolute = path.isAbsolute(sharedFolderPath);
    const dirUri = isAbsolute
        ? vscode.Uri.file(sharedFolderPath)
        : vscode.Uri.joinPath(workspaceUri, sharedFolderPath);
    const fileUri = vscode.Uri.joinPath(dirUri, safeName);
    await vscode.workspace.fs.writeFile(fileUri, buffer);
    return fileUri;
}

/**
 * Save collection .slc to a shared folder path (team namespace). Path can be local or network.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import type { Collection } from '../collection/collection-types';
import { exportCollectionToBuffer } from '../export/slc-bundle';

/**
 * Save collection bundle to sharedFolderPath. Path is used as-is if absolute; otherwise relative to workspace root.
 * Returns the file URI written.
 */
export async function saveToSharedFolder(
    collection: Collection,
    workspaceUri: vscode.Uri,
    sharedFolderPath: string,
): Promise<vscode.Uri> {
    const buffer = await exportCollectionToBuffer(collection, workspaceUri);
    const safeName = (collection.name.replace(/[^a-zA-Z0-9_\- .]/g, '_').trim() || 'collection') + '.slc';
    const isAbsolute = path.isAbsolute(sharedFolderPath);
    const dirUri = isAbsolute
        ? vscode.Uri.file(sharedFolderPath)
        : vscode.Uri.joinPath(workspaceUri, sharedFolderPath);
    const fileUri = vscode.Uri.joinPath(dirUri, safeName);
    await vscode.workspace.fs.writeFile(fileUri, buffer);
    return fileUri;
}

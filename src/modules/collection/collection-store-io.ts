/**
 * Collection file I/O. Load/save .saropa/collections.json.
 * Extracted to keep collection-store.ts under the line limit.
 */

import * as vscode from 'vscode';
import type { CollectionsFile } from './collection-types';

export const COLLECTIONS_FILENAME = 'collections.json';
export const SAROPA_FOLDER = '.saropa';

export function getCollectionsFileUri(): vscode.Uri | undefined {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) { return undefined; }
    return vscode.Uri.joinPath(folder.uri, SAROPA_FOLDER, COLLECTIONS_FILENAME);
}

export async function loadCollectionsFile(): Promise<CollectionsFile> {
    const uri = getCollectionsFileUri();
    if (!uri) {
        return { version: 1, collections: [] };
    }
    try {
        const data = await vscode.workspace.fs.readFile(uri);
        const json = JSON.parse(Buffer.from(data).toString('utf-8')) as CollectionsFile;
        if (json.version !== 1 || !Array.isArray(json.collections)) {
            return { version: 1, collections: [] };
        }
        return json;
    } catch {
        return { version: 1, collections: [] };
    }
}

export async function saveCollectionsFile(file: CollectionsFile): Promise<void> {
    const uri = getCollectionsFileUri();
    if (!uri) { return; }
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) { return; }
    const saropaDir = vscode.Uri.joinPath(folder.uri, SAROPA_FOLDER);
    try {
        await vscode.workspace.fs.createDirectory(saropaDir);
    } catch { /* may exist */ }
    const content = JSON.stringify(file, null, 2);
    await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf-8'));
}

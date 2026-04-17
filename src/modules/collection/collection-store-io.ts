/**
 * Investigation file I/O. Load/save .saropa/investigations.json.
 * Extracted to keep investigation-store.ts under the line limit.
 */

import * as vscode from 'vscode';
import type { InvestigationsFile } from './investigation-types';

export const INVESTIGATIONS_FILENAME = 'investigations.json';
export const SAROPA_FOLDER = '.saropa';

export function getInvestigationsFileUri(): vscode.Uri | undefined {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) { return undefined; }
    return vscode.Uri.joinPath(folder.uri, SAROPA_FOLDER, INVESTIGATIONS_FILENAME);
}

export async function loadInvestigationsFile(): Promise<InvestigationsFile> {
    const uri = getInvestigationsFileUri();
    if (!uri) {
        return { version: 1, investigations: [] };
    }
    try {
        const data = await vscode.workspace.fs.readFile(uri);
        const json = JSON.parse(Buffer.from(data).toString('utf-8')) as InvestigationsFile;
        if (json.version !== 1 || !Array.isArray(json.investigations)) {
            return { version: 1, investigations: [] };
        }
        return json;
    } catch {
        return { version: 1, investigations: [] };
    }
}

export async function saveInvestigationsFile(file: InvestigationsFile): Promise<void> {
    const uri = getInvestigationsFileUri();
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

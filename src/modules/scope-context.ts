/**
 * Builds scope context for the source scope filter.
 *
 * Computes the active file path, workspace folder, package root, and
 * directory — all normalized to forward-slash lowercase for cross-platform
 * comparison in the webview.
 */

import * as vscode from 'vscode';
import { detectPackageRoot } from './package-detector';

/** Scope context sent to the webview for source scope filtering. */
export interface ScopeContext {
    readonly activeFilePath: string | null;
    readonly workspaceFolder: string | null;
    readonly packageRoot: string | null;
    readonly activeDirectory: string | null;
}

function normalizePath(uri: vscode.Uri): string {
    return uri.path.replace(/\\/g, '/').toLowerCase();
}

/** Build scope context from the active text editor. */
export async function buildScopeContext(
    editor: vscode.TextEditor | undefined,
): Promise<ScopeContext> {
    if (!editor) {
        return { activeFilePath: null, workspaceFolder: null, packageRoot: null, activeDirectory: null };
    }
    const fileUri = editor.document.uri;
    const wsFolder = vscode.workspace.getWorkspaceFolder(fileUri);
    const dirUri = vscode.Uri.joinPath(fileUri, '..');

    let packageRoot: string | null = null;
    if (wsFolder) {
        const pkgUri = await detectPackageRoot(fileUri, wsFolder.uri);
        if (pkgUri) { packageRoot = normalizePath(pkgUri); }
    }

    return {
        activeFilePath: normalizePath(fileUri),
        workspaceFolder: wsFolder ? normalizePath(wsFolder.uri) : null,
        packageRoot,
        activeDirectory: normalizePath(dirUri),
    };
}

import * as vscode from 'vscode';

/**
 * Resolve a file path from log output to a workspace URI.
 * Handles absolute paths, Windows drive letters, and Dart package URIs.
 */
export function resolveSourceUri(filePath: string): vscode.Uri | undefined {
    if (!filePath) {
        return undefined;
    }
    // Absolute path or drive letter (C:\...).
    if (filePath.match(/^([/\\]|[a-zA-Z]:)/)) {
        return vscode.Uri.file(filePath);
    }
    // Dart package URI (package:foo/bar.dart) — strip prefix, resolve relative.
    const stripped = filePath.replace(/^package:[^/]+\//, '');
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (folder) {
        return vscode.Uri.joinPath(folder.uri, stripped);
    }
    return undefined;
}

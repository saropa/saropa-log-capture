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
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) {
        return undefined;
    }
    // Dart package URI (package:foo/bar.dart): the package: scheme maps to the package's lib/ dir,
    // so package:foo/bar.dart → <packageRoot>/lib/bar.dart. Resolving to <root>/bar.dart (the old
    // behavior) pointed at a file that doesn't exist. Assumes the open folder is the app's package
    // root; dependency packages (in the pub cache) aren't resolved here.
    const pkgMatch = filePath.match(/^package:[^/]+\/(.+)$/);
    if (pkgMatch) {
        return vscode.Uri.joinPath(folder.uri, 'lib', pkgMatch[1]);
    }
    // Plain relative path — join as-is.
    return vscode.Uri.joinPath(folder.uri, filePath);
}

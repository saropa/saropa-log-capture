/**
 * Workspace path resolution for integrations.
 * Uses Uri.joinPath for workspace-relative paths so resolution is correct
 * in Remote - SSH, WSL, and Dev Containers (Task 90).
 */

import * as vscode from 'vscode';
import * as path from 'path';

/**
 * Substitute ${workspaceFolder} in a path template with the workspace root path.
 * Used by integrations that accept path settings with variable substitution.
 */
export function substituteWorkspaceFolder(template: string, workspaceFolder: vscode.WorkspaceFolder): string {
    const workspacePath = resolveWorkspaceFileUri(workspaceFolder, '.').fsPath;
    return path.normalize(template.replace(/\$\{workspaceFolder\}/gi, workspacePath));
}

/**
 * Resolve a path (absolute or workspace-relative) to a file URI.
 * Relative paths are normalized with forward slashes and resolved via
 * workspaceFolder.uri so they work in remote workspaces.
 */
export function resolveWorkspaceFileUri(
    workspaceFolder: vscode.WorkspaceFolder,
    pathOrRelative: string,
): vscode.Uri {
    return path.isAbsolute(pathOrRelative)
        ? vscode.Uri.file(pathOrRelative)
        : vscode.Uri.joinPath(workspaceFolder.uri, pathOrRelative.replace(/\\/g, '/'));
}

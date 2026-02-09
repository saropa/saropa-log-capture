/**
 * Detects the nearest package root by walking up from a file to find
 * a manifest file (pubspec.yaml, package.json, Cargo.toml, etc.).
 */

import * as vscode from 'vscode';

const manifestFiles = [
    'pubspec.yaml',
    'package.json',
    'Cargo.toml',
    'go.mod',
    'pyproject.toml',
    'pom.xml',
    'build.gradle',
    'build.gradle.kts',
];

/** Walk up from fileUri to find the nearest ancestor with a package manifest. */
export async function detectPackageRoot(
    fileUri: vscode.Uri,
    stopAt: vscode.Uri,
): Promise<vscode.Uri | undefined> {
    let dir = vscode.Uri.joinPath(fileUri, '..');
    const stopPath = stopAt.path.toLowerCase();

    while (dir.path.toLowerCase().startsWith(stopPath)) {
        for (const name of manifestFiles) {
            const candidate = vscode.Uri.joinPath(dir, name);
            try {
                await vscode.workspace.fs.stat(candidate);
                return dir;
            } catch {
                // File doesn't exist — continue
            }
        }
        const parent = vscode.Uri.joinPath(dir, '..');
        if (parent.path === dir.path) { break; }
        dir = parent;
    }
    return undefined;
}

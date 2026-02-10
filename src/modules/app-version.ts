/** Auto-detect app version from workspace project files. */

import * as vscode from 'vscode';

let cachedVersion: { value: string | undefined; expires: number } | undefined;
const cacheTtl = 5 * 60_000;

/** Auto-detect app version from pubspec.yaml, build.gradle, or package.json. Cached for 5 min. */
export async function detectAppVersion(): Promise<string | undefined> {
    const cfg = vscode.workspace.getConfiguration('saropaLogCapture.firebase');
    const manual = cfg.get<string>('versionFilter', '');
    if (manual) { return manual; }
    if (cachedVersion && Date.now() < cachedVersion.expires) { return cachedVersion.value; }
    const version = await tryPubspec() ?? await tryGradle() ?? await tryPackageJson();
    cachedVersion = { value: version, expires: Date.now() + cacheTtl };
    return version;
}

/** Clear the version cache (useful after project file edits). */
export function clearVersionCache(): void { cachedVersion = undefined; }

/** Try to read version from pubspec.yaml (Flutter/Dart). */
async function tryPubspec(): Promise<string | undefined> {
    const files = await vscode.workspace.findFiles('**/pubspec.yaml', '**/node_modules/**', 1);
    if (files.length === 0) { return undefined; }
    try {
        const raw = Buffer.from(await vscode.workspace.fs.readFile(files[0])).toString('utf-8');
        const match = raw.match(/^version:\s*(.+)/m);
        return match ? match[1].trim().split('+')[0] : undefined;
    } catch { return undefined; }
}

/** Try to read versionName from build.gradle (Android). */
async function tryGradle(): Promise<string | undefined> {
    const files = await vscode.workspace.findFiles('**/app/build.gradle', '**/node_modules/**', 1);
    if (files.length === 0) { return undefined; }
    try {
        const raw = Buffer.from(await vscode.workspace.fs.readFile(files[0])).toString('utf-8');
        const match = raw.match(/versionName\s+["']([^"']+)["']/);
        return match ? match[1] : undefined;
    } catch { return undefined; }
}

/** Try to read version from package.json (Node/JS). */
async function tryPackageJson(): Promise<string | undefined> {
    const files = await vscode.workspace.findFiles('package.json', '**/node_modules/**', 1);
    if (files.length === 0) { return undefined; }
    try {
        const raw = Buffer.from(await vscode.workspace.fs.readFile(files[0])).toString('utf-8');
        const json = JSON.parse(raw) as { version?: string };
        return json.version || undefined;
    } catch { return undefined; }
}

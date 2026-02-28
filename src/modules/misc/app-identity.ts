/** Auto-detect app package name from workspace project files. */

import * as vscode from 'vscode';

let cachedPackage: { value: string | undefined; expires: number } | undefined;
const cacheTtl = 5 * 60_000;

/** Auto-detect package name from google-services.json, AndroidManifest.xml, or pubspec.yaml. Cached for 5 min. */
export async function detectPackageName(): Promise<string | undefined> {
    const manual = vscode.workspace.getConfiguration('saropaLogCapture.firebase').get<string>('packageName', '');
    if (manual) { return manual; }
    if (cachedPackage && Date.now() < cachedPackage.expires) { return cachedPackage.value; }
    const name = await tryGoogleServices() ?? await tryManifest() ?? await tryPubspec();
    cachedPackage = { value: name, expires: Date.now() + cacheTtl };
    return name;
}

/** Clear the package name cache. */
export function clearPackageNameCache(): void { cachedPackage = undefined; }

/** Try google-services.json → client[0].client_info.android_client_info.package_name. */
async function tryGoogleServices(): Promise<string | undefined> {
    const files = await vscode.workspace.findFiles('**/google-services.json', '**/node_modules/**', 1);
    if (files.length === 0) { return undefined; }
    try {
        const raw = Buffer.from(await vscode.workspace.fs.readFile(files[0])).toString('utf-8');
        const json = JSON.parse(raw);
        const pkg: unknown = json?.client?.[0]?.client_info?.android_client_info?.package_name;
        return typeof pkg === 'string' && pkg ? pkg : undefined;
    } catch { return undefined; }
}

/** Try AndroidManifest.xml → package="..." attribute. */
async function tryManifest(): Promise<string | undefined> {
    const files = await vscode.workspace.findFiles('**/AndroidManifest.xml', '**/node_modules/**', 1);
    if (files.length === 0) { return undefined; }
    try {
        const raw = Buffer.from(await vscode.workspace.fs.readFile(files[0])).toString('utf-8');
        const match = raw.match(/\bpackage\s*=\s*"([^"]+)"/);
        return match ? match[1] : undefined;
    } catch { return undefined; }
}

/** Try pubspec.yaml → name: field (Flutter/Dart package name). */
async function tryPubspec(): Promise<string | undefined> {
    const files = await vscode.workspace.findFiles('**/pubspec.yaml', '**/node_modules/**', 1);
    if (files.length === 0) { return undefined; }
    try {
        const raw = Buffer.from(await vscode.workspace.fs.readFile(files[0])).toString('utf-8');
        const match = raw.match(/^name:\s*(.+)/m);
        return match ? match[1].trim() : undefined;
    } catch { return undefined; }
}

/**
 * Whether the current workspace is a deployable app that could actually have
 * Firebase Crashlytics data, as opposed to a library / package project (a Dart
 * package, an npm library) that never ships an app and so will never have crash
 * issues to read.
 *
 * Crashlytics is enabled by default in `integrations.adapters`, so without this
 * gate the sidebar icon and its "Add google-services.json…" setup hint appear on
 * EVERY workspace — including pure packages where the suggestion is noise the user
 * can never act on. Gating on app evidence keeps the feature passive on those
 * projects (it stays fully available the moment real app config appears).
 *
 * App evidence is any ONE of (cheapest signal first):
 *   1. Explicit `saropaLogCapture.firebase.*` settings (projectId / appId /
 *      packageName) — the user has pointed the extension at a real app.
 *   2. A `google-services.json` anywhere in the workspace (Android / Flutter app).
 *   3. An `AndroidManifest.xml` anywhere in the workspace (native Android app).
 *
 * Result is cached (short TTL) because it is read on every adapter broadcast; the
 * cache is cleared when firebase settings or workspace folders change.
 */

import * as vscode from 'vscode';

const nodeModulesExclude = '**/node_modules/**';
const cacheTtl = 5 * 60_000;

let cached: { value: boolean; expires: number } | undefined;

/** True when explicit firebase.* settings name a real app (no file scan needed). */
function hasFirebaseSettings(): boolean {
    const cfg = vscode.workspace.getConfiguration('saropaLogCapture.firebase');
    const projectId = cfg.get<string>('projectId', '');
    const appId = cfg.get<string>('appId', '');
    const packageName = cfg.get<string>('packageName', '');
    return Boolean(projectId || appId || packageName);
}

/** True when an Android app marker file exists in the workspace. */
async function hasAndroidAppFile(): Promise<boolean> {
    // Both searches run in parallel; maxResults 1 keeps each scan cheap on large repos.
    const [gsj, manifest] = await Promise.all([
        vscode.workspace.findFiles('**/google-services.json', nodeModulesExclude, 1),
        vscode.workspace.findFiles('**/AndroidManifest.xml', nodeModulesExclude, 1),
    ]);
    return gsj.length > 0 || manifest.length > 0;
}

/**
 * Whether to surface Crashlytics for this workspace. Settings are checked first so
 * a configured project never pays for a file scan; only an unconfigured workspace
 * touches the filesystem.
 */
export async function isCrashlyticsApplicable(): Promise<boolean> {
    if (cached && Date.now() < cached.expires) { return cached.value; }
    const value = hasFirebaseSettings() || (await hasAndroidAppFile());
    cached = { value, expires: Date.now() + cacheTtl };
    return value;
}

/** Drop the cached result so the next check re-detects (config / folder changes). */
export function clearCrashlyticsApplicabilityCache(): void {
    cached = undefined;
}

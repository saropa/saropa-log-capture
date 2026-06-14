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
 *   2. A real `google-services.json` (Android / Flutter app) — excluding a
 *      package's bundled `example/` app, see workspace-app-detection.
 *   3. An Android application module (`android/app/…`) — likewise excluding
 *      example apps and plugin library manifests.
 *
 * Detection is delegated to (and cached by) workspace-app-detection so the same
 * app-vs-package judgment is shared with the other app-only surfaces (adb logcat).
 */

import * as vscode from 'vscode';
import {
    hasAndroidApp,
    hasGoogleServicesConfig,
    clearWorkspaceAppDetectionCache,
} from '../misc/workspace-app-detection';

/** True when explicit firebase.* settings name a real app (no file scan needed). */
function hasFirebaseSettings(): boolean {
    const cfg = vscode.workspace.getConfiguration('saropaLogCapture.firebase');
    const projectId = cfg.get<string>('projectId', '');
    const appId = cfg.get<string>('appId', '');
    const packageName = cfg.get<string>('packageName', '');
    return Boolean(projectId || appId || packageName);
}

/**
 * Whether to surface Crashlytics for this workspace. Settings are checked first so
 * a configured project never pays for a file scan; only an unconfigured workspace
 * touches the filesystem (and those scans are cached).
 */
export async function isCrashlyticsApplicable(): Promise<boolean> {
    if (hasFirebaseSettings()) { return true; }
    const [gsj, androidApp] = await Promise.all([hasGoogleServicesConfig(), hasAndroidApp()]);
    return gsj || androidApp;
}

/** Drop the cached app-detection result so the next check re-detects. */
export function clearCrashlyticsApplicabilityCache(): void {
    clearWorkspaceAppDetectionCache();
}

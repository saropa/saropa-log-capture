/**
 * Shared "is this a deployable / debuggable app?" detection, used to gate the
 * app- and device-oriented integration surfaces (Crashlytics, adb logcat) so they
 * never nag on a library / package project.
 *
 * The subtle failure this guards against: a published Dart/Flutter PACKAGE is not
 * an app, but it still ships an `example/` demo app — so a naive recursive search
 * for "AndroidManifest.xml" matches the example app's manifest under
 * `example/android/app/` and wrongly classifies the package as an app. Both
 * searches therefore EXCLUDE `example/` (and build / tooling trees), and the
 * manifest search requires the Android application module path (`android/app/`) so
 * a plugin's library manifest (under `android/src/main/`) and an example app are
 * both rejected. The remaining matches are real app modules.
 *
 * Results are cached (short TTL) because these run on adapter broadcasts / prep
 * checks; the cache is cleared when firebase settings or workspace folders change.
 */

import * as vscode from 'vscode';

// Anything under these trees is a dependency, a build artifact, or a package's
// bundled demo — none of which make THIS workspace an app.
const excludeGlob = '{**/node_modules/**,**/example/**,**/.dart_tool/**,**/build/**}';
const cacheTtl = 5 * 60_000;

let androidAppCache: { value: boolean; expires: number } | undefined;
let googleServicesCache: { value: boolean; expires: number } | undefined;

/**
 * True when the workspace contains an Android APPLICATION module
 * (`…/android/app/…/AndroidManifest.xml`) — not a plugin's library manifest and
 * not a package's `example/` app. This is the signal that there is something
 * adb logcat could actually attach to.
 */
export async function hasAndroidApp(): Promise<boolean> {
    if (androidAppCache && Date.now() < androidAppCache.expires) { return androidAppCache.value; }
    const files = await vscode.workspace.findFiles('**/android/app/**/AndroidManifest.xml', excludeGlob, 1);
    const value = files.length > 0;
    androidAppCache = { value, expires: Date.now() + cacheTtl };
    return value;
}

/** True when a real `google-services.json` exists (outside example / build trees). */
export async function hasGoogleServicesConfig(): Promise<boolean> {
    if (googleServicesCache && Date.now() < googleServicesCache.expires) { return googleServicesCache.value; }
    const files = await vscode.workspace.findFiles('**/google-services.json', excludeGlob, 1);
    const value = files.length > 0;
    googleServicesCache = { value, expires: Date.now() + cacheTtl };
    return value;
}

/** Drop cached results so the next check re-detects (config / folder changes). */
export function clearWorkspaceAppDetectionCache(): void {
    androidAppCache = undefined;
    googleServicesCache = undefined;
}

/** Firebase Crashlytics integration — queries crash data via REST API with gcloud or service account auth. */

import * as path from 'path';
import * as vscode from 'vscode';
import { runCmd, readIssueHistory } from './crashlytics-io';
import { resolveGcloudCmd, resetGcloudLocatorCache } from './gcloud-locator';
import { getAccessTokenFromServiceAccount } from './crashlytics-service-account';
import { detectPackageName } from '../misc/app-identity';
import { deriveIssueSignals } from './crashlytics-issue-signals';
import { fetchIssueBreakdown, fetchIssueFilterIndex, type IssueBreakdown, type IssueFilterIndex } from './play-reporting-metrics';
import { logCrashlytics, classifyGcloudError, classifyTokenError, firebaseConfigSetupHint, type DiagnosticDetails } from './crashlytics-diagnostics';
import type { CrashlyticsIssueEvents, CrashlyticsEventDetail, FirebaseContext, FirebaseConfig, SetupChecklist } from './crashlytics-types';
export type { CrashlyticsIssue, CrashlyticsStackFrame, CrashlyticsEventDetail, CrashlyticsIssueEvents, FirebaseContext, SetupChecklist, SetupStepStatus } from './crashlytics-types';
import {
    queryTopIssues,
    getCrashEvents as apiGetCrashEvents,
    clearApiCache, getLastApiDiagnostic,
} from './crashlytics-api';

let gcloudAvailable: boolean | undefined;
let cachedToken: { token: string; expires: number } | undefined;
let lastDiagnostic: DiagnosticDetails | undefined;
const tokenTtl = 30 * 60_000;

async function isGcloudAvailable(): Promise<boolean> {
    if (gcloudAvailable !== undefined) { return gcloudAvailable; }
    try {
        // resolveGcloudCmd() returns an absolute install path when one exists on disk, so a stale PATH
        // (gcloud installed after VS Code launched) no longer breaks the check. (bug_008)
        const cmd = resolveGcloudCmd();
        await runCmd(cmd, ['--version']);
        gcloudAvailable = true;
        logCrashlytics('info', cmd === 'gcloud' ? 'Google Cloud CLI found on PATH' : `Google Cloud CLI found at ${cmd}`);
    } catch (err) {
        gcloudAvailable = false;
        lastDiagnostic = classifyGcloudError(err);
        logCrashlytics('error', `gcloud check: ${lastDiagnostic.message}`);
    }
    return gcloudAvailable;
}

/** Last diagnostic captured by gcloud/token/config steps (for the connection validator's report). */
export function getLastDiagnostic(): DiagnosticDetails | undefined { return lastDiagnostic; }

/** Resolve service account key path (absolute or relative to workspace root). */
function resolveServiceAccountKeyPath(configuredPath: string): string | undefined {
    const trimmed = configuredPath.trim();
    if (!trimmed) { return undefined; }
    if (path.isAbsolute(trimmed)) { return trimmed; }
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) { return path.resolve(trimmed); }
    return path.join(folder.uri.fsPath, trimmed);
}

/** Get an access token: service account key file if configured, else gcloud ADC (cached 30 min). */
export async function getAccessToken(): Promise<string | undefined> {
    if (cachedToken && Date.now() < cachedToken.expires) { return cachedToken.token; }
    const cfg = vscode.workspace.getConfiguration('saropaLogCapture.firebase');
    const serviceAccountPath = cfg.get<string>('serviceAccountKeyPath', '');
    const resolvedPath = resolveServiceAccountKeyPath(serviceAccountPath);
    if (resolvedPath) {
        const token = await getAccessTokenFromServiceAccount(resolvedPath);
        if (token) {
            cachedToken = { token, expires: Date.now() + tokenTtl };
            return token;
        }
        lastDiagnostic = { step: 'token', errorType: 'auth', message: 'Service account key failed. Check path and file contents, or use gcloud.', checkedAt: Date.now() };
    }
    try {
        const token = await runCmd(resolveGcloudCmd(), ['auth', 'application-default', 'print-access-token']);
        if (!token) {
            lastDiagnostic = { step: 'token', errorType: 'auth', message: 'gcloud returned empty token', checkedAt: Date.now() };
            logCrashlytics('error', 'gcloud returned empty access token');
            return undefined;
        }
        cachedToken = { token, expires: Date.now() + tokenTtl };
        logCrashlytics('info', 'Access token retrieved');
        return token;
    } catch (err) {
        lastDiagnostic = classifyTokenError(err);
        logCrashlytics('error', `Token fetch: ${lastDiagnostic.message}`);
        return undefined;
    }
}

/** Detect Firebase config from workspace google-services.json or extension settings. */
export async function detectFirebaseConfig(): Promise<FirebaseConfig | undefined> {
    const cfg = vscode.workspace.getConfiguration('saropaLogCapture.firebase');
    const projectId = cfg.get<string>('projectId', '');
    const appId = cfg.get<string>('appId', '');
    if (projectId && appId) {
        logCrashlytics('info', `Config from settings: project=${projectId}`);
        return { projectId, appId };
    }
    return scanGoogleServicesJson(projectId, appId);
}

const nodeModulesExclude = '**/node_modules/**';

/** Prefer android/app/ for Flutter/Android; then any google-services.json. Runs both searches in parallel. */
export async function findBestGoogleServicesJson(): Promise<vscode.Uri | undefined> {
    const [android, anyFiles] = await Promise.all([
        vscode.workspace.findFiles('**/android/**/google-services.json', nodeModulesExclude, 5),
        vscode.workspace.findFiles('**/google-services.json', nodeModulesExclude, 5),
    ]);
    return android.length > 0 ? android[0] : anyFiles[0];
}

async function scanGoogleServicesJson(fallbackProject: string, fallbackApp: string): Promise<FirebaseConfig | undefined> {
    const file = await findBestGoogleServicesJson();
    if (!file) {
        logCrashlytics('info', 'No google-services.json found in workspace (searched android/** and **)');
        lastDiagnostic = { step: 'config', errorType: 'config', message: `No google-services.json found. ${firebaseConfigSetupHint}`, checkedAt: Date.now() };
        return undefined;
    }
    try {
        const raw = await vscode.workspace.fs.readFile(file);
        const json = JSON.parse(Buffer.from(raw).toString('utf-8'));
        const projectId = fallbackProject || json.project_info?.project_id;
        const client = json.client?.[0];
        const appId = fallbackApp || client?.client_info?.mobilesdk_app_id;
        if (projectId && appId) {
            const rel = vscode.workspace.asRelativePath(file);
            logCrashlytics('info', `Config from ${rel}: project=${projectId}`);
            return { projectId, appId };
        }
        const missing = !projectId ? 'projectId' : 'appId';
        logCrashlytics('error', `google-services.json missing ${missing}`);
        lastDiagnostic = { step: 'config', errorType: 'config', message: `google-services.json found but missing ${missing}`, checkedAt: Date.now() };
        return undefined;
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logCrashlytics('error', `Failed to parse google-services.json: ${msg}`);
        lastDiagnostic = { step: 'config', errorType: 'config', message: `Failed to parse google-services.json`, technicalDetails: msg, checkedAt: Date.now() };
        return undefined;
    }
}

/** Clear all cached state so the next query re-checks gcloud, token, and issues. */
export function clearIssueListCache(): void {
    gcloudAvailable = undefined;
    cachedToken = undefined;
    lastDiagnostic = undefined;
    // Re-probe disk for gcloud too: the user may have just installed it (the common "fix" between
    // a failed and a successful check), so a cached "not found" must not stick. (bug_008)
    resetGcloudLocatorCache();
    clearApiCache();
}

/** Install page for the Google Cloud CLI (gcloud), required for Crashlytics API access. */
export const gcloudInstallUrl = 'https://docs.cloud.google.com/sdk/docs/install-sdk';

/** OS-specific one-liner to install gcloud (for copy/paste in terminal). Empty if no recommended command. */
export function getGcloudInstallCommand(): string {
    switch (process.platform) {
        case 'win32':
            return 'winget install -e --id Google.CloudSDK';
        case 'darwin':
            return 'brew install --cask google-cloud-sdk';
        default:
            return '';
    }
}

/** Lightweight readiness check (token + config only, no API call). For status bar. Uses getAccessToken so service-account-only works without gcloud. */
export async function getCrashlyticsStatus(): Promise<{ status: 'ready' | 'setup' }> {
    try {
        const token = await getAccessToken();
        if (!token) { return { status: 'setup' }; }
        const config = await detectFirebaseConfig();
        if (!config) { return { status: 'setup' }; }
        return { status: 'ready' };
    } catch {
        return { status: 'setup' };
    }
}

/** Query Firebase Crashlytics for issues matching error tokens. Never throws; returns a safe context on any failure. Token is tried first (service account or gcloud) so SA-only users never hit the gcloud step. */
export async function getFirebaseContext(errorTokens: readonly string[]): Promise<FirebaseContext> {
    const safeEmpty = (setupStep: FirebaseContext['setupStep'], setupHint: string, setupChecklist: SetupChecklist): FirebaseContext =>
        ({ available: false, setupStep, setupHint, setupChecklist, issues: [], diagnostics: lastDiagnostic });
    lastDiagnostic = undefined;
    try {
        const token = await getAccessToken();
        if (!token) {
            const cfg = vscode.workspace.getConfiguration('saropaLogCapture.firebase');
            const saPath = resolveServiceAccountKeyPath(cfg.get<string>('serviceAccountKeyPath', ''));
            if (saPath) {
                return safeEmpty('token', 'Service account key failed. Check path and file, or clear the setting to use gcloud.', { gcloud: 'ok', token: 'missing', config: 'pending' });
            }
            const gcloudOk = await isGcloudAvailable();
            if (!gcloudOk) {
                return safeEmpty('gcloud', `Install Google Cloud CLI from ${gcloudInstallUrl}`, { gcloud: 'missing', token: 'pending', config: 'pending' });
            }
            return safeEmpty('token', 'Run: gcloud auth application-default login', { gcloud: 'ok', token: 'missing', config: 'pending' });
        }
        const config = await detectFirebaseConfig();
        if (!config) {
            return safeEmpty('config', firebaseConfigSetupHint, { gcloud: 'ok', token: 'ok', config: 'missing' });
        }
        // The Crashlytics console deep link's `app/` segment is the platform-prefixed package name
        // (`android:com.example.app`), NOT the mobilesdk_app_id (`1:NNN:android:HEX`). Passing the
        // app id produced "This app does not exist or you do not have permission to view it" because
        // the console can't resolve that path segment (verified against the user's working URL,
        // 2026-06-12). The Play Reporting data source is Android-only, so the platform is `android`.
        // Omit the `/u/N/` account-index prefix on purpose — Google's redirect inserts the correct
        // account, whereas hardcoding `/u/0/` would send multi-account users to the wrong one.
        const packageName = await detectPackageName();
        const appSegment = packageName ? `android:${packageName}` : config.appId;
        const consoleUrl = `https://console.firebase.google.com/project/${config.projectId}/crashlytics/app/${appSegment}/issues`;
        const fullChecklist: SetupChecklist = { gcloud: 'ok', token: 'ok', config: 'ok' };
        try {
            // Layer locally-derived signals (repetitive / regressed) the API does not provide onto the
            // mapped issues. mapErrorIssue stays the faithful API mapper; signals are computed here.
            // queryTopIssues already recorded the current snapshot, so the history's last entry is
            // "now" and regression detection sees the full sequence.
            const rawIssues = await queryTopIssues(config, token, errorTokens);
            const issues = deriveIssueSignals(rawIssues, await readIssueHistory());
            logCrashlytics('info', `Fetched ${issues.length} Crashlytics issues`);
            // Surface the API diagnostic even when issues exist, so an offline cache-fallback is shown
            // as stale rather than masquerading as a fresh result. (offline cache)
            const diag = getLastApiDiagnostic() ?? (issues.length === 0 ? lastDiagnostic : undefined);
            return { available: true, issues, consoleUrl, queriedAt: Date.now(), diagnostics: diag, setupChecklist: fullChecklist };
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            logCrashlytics('error', `Issue query failed: ${msg}`);
            if (!lastDiagnostic) {
                lastDiagnostic = { step: 'api', errorType: 'network', message: msg, checkedAt: Date.now() };
            }
            return { available: true, issues: [], consoleUrl, queriedAt: Date.now(), diagnostics: lastDiagnostic, setupChecklist: fullChecklist };
        }
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logCrashlytics('error', `getFirebaseContext failed: ${msg}`);
        lastDiagnostic = { step: 'api', errorType: 'network', message: msg, checkedAt: Date.now() };
        return { available: false, setupStep: 'gcloud', setupHint: 'Unexpected error; check Output for Saropa Crashlytics', issues: [], diagnostics: lastDiagnostic, setupChecklist: { gcloud: 'missing', token: 'pending', config: 'pending' } };
    }
}

/** Fetch crash events for a specific issue, returning multi-event structure with pagination. */
export async function getCrashEventDetail(issueId: string): Promise<CrashlyticsEventDetail | undefined> {
    const multi = await getCrashEvents(issueId);
    return multi?.events[multi.currentIndex];
}

/** Fetch multiple crash events for an issue (cached). Never throws. */
export async function getCrashEvents(issueId: string): Promise<CrashlyticsIssueEvents | undefined> {
    try {
        const token = await getAccessToken();
        if (!token) { return undefined; }
        const config = await detectFirebaseConfig();
        if (!config) { return undefined; }
        return await apiGetCrashEvents(token, config, issueId);
    } catch {
        return undefined;
    }
}

/** True device/OS aggregates for an issue via the Play error-count metric set. Never throws. */
export async function getIssueBreakdown(issueId: string): Promise<IssueBreakdown | undefined> {
    try {
        const token = await getAccessToken();
        const config = await detectFirebaseConfig();
        const packageName = await detectPackageName();
        if (!token || !config || !packageName) { return undefined; }
        const timeRange = vscode.workspace.getConfiguration('saropaLogCapture.firebase').get<string>('timeRange', 'LAST_7_DAYS');
        return await fetchIssueBreakdown({ packageName, token, timeRange, quotaProject: config.projectId }, issueId);
    } catch {
        return undefined;
    }
}

/** Per-issue device/OS maps for the dashboard's local device & OS filters. Never throws. */
export async function getIssueFilterIndex(): Promise<IssueFilterIndex | undefined> {
    try {
        const token = await getAccessToken();
        const config = await detectFirebaseConfig();
        const packageName = await detectPackageName();
        if (!token || !config || !packageName) { return undefined; }
        const timeRange = vscode.workspace.getConfiguration('saropaLogCapture.firebase').get<string>('timeRange', 'LAST_7_DAYS');
        return await fetchIssueFilterIndex({ packageName, token, timeRange, quotaProject: config.projectId });
    } catch {
        return undefined;
    }
}

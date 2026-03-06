/** Firebase Crashlytics integration — queries crash data via REST API with gcloud auth. */

import * as vscode from 'vscode';
import { runCmd } from './crashlytics-io';
import { logCrashlytics, classifyGcloudError, classifyTokenError, firebaseConfigSetupHint, type DiagnosticDetails } from './crashlytics-diagnostics';
import type { CrashlyticsIssueEvents, CrashlyticsEventDetail, FirebaseContext, FirebaseConfig } from './crashlytics-types';
export type { CrashlyticsIssue, CrashlyticsStackFrame, CrashlyticsEventDetail, CrashlyticsIssueEvents, FirebaseContext } from './crashlytics-types';
import {
    queryTopIssues, updateIssueState as apiUpdateIssueState,
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
        await runCmd('gcloud', ['--version']);
        gcloudAvailable = true;
        logCrashlytics('info', 'Google Cloud CLI found');
    } catch (err) {
        gcloudAvailable = false;
        lastDiagnostic = classifyGcloudError(err);
        logCrashlytics('error', `gcloud check: ${lastDiagnostic.message}`);
    }
    return gcloudAvailable;
}

/** Get a gcloud access token (cached 30 min). */
export async function getAccessToken(): Promise<string | undefined> {
    if (cachedToken && Date.now() < cachedToken.expires) { return cachedToken.token; }
    try {
        const token = await runCmd('gcloud', ['auth', 'application-default', 'print-access-token']);
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
    clearApiCache();
}

/** Install page for the Google Cloud CLI (gcloud), required for Crashlytics API access. */
export const gcloudInstallUrl = 'https://docs.cloud.google.com/sdk/docs/install-sdk';

/** Query Firebase Crashlytics for issues matching error tokens. Never throws; returns a safe context on any failure. */
export async function getFirebaseContext(errorTokens: readonly string[]): Promise<FirebaseContext> {
    const safeEmpty = (setupStep: FirebaseContext['setupStep'], setupHint: string): FirebaseContext =>
        ({ available: false, setupStep, setupHint, issues: [], diagnostics: lastDiagnostic });
    lastDiagnostic = undefined;
    try {
        if (!(await isGcloudAvailable())) {
            return safeEmpty('gcloud', `Install Google Cloud CLI from ${gcloudInstallUrl}`);
        }
        const token = await getAccessToken();
        if (!token) {
            return safeEmpty('token', 'Run: gcloud auth application-default login');
        }
        const config = await detectFirebaseConfig();
        if (!config) {
            return safeEmpty('config', firebaseConfigSetupHint);
        }
        const consoleUrl = `https://console.firebase.google.com/project/${config.projectId}/crashlytics/app/${config.appId}/issues`;
        try {
            const issues = await queryTopIssues(config, token, errorTokens);
            logCrashlytics('info', `Fetched ${issues.length} Crashlytics issues`);
            const diag = issues.length === 0 ? (lastDiagnostic ?? getLastApiDiagnostic()) : undefined;
            return { available: true, issues, consoleUrl, queriedAt: Date.now(), diagnostics: diag };
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            logCrashlytics('error', `Issue query failed: ${msg}`);
            if (!lastDiagnostic) {
                lastDiagnostic = { step: 'api', errorType: 'network', message: msg, checkedAt: Date.now() };
            }
            return { available: true, issues: [], consoleUrl, queriedAt: Date.now(), diagnostics: lastDiagnostic };
        }
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logCrashlytics('error', `getFirebaseContext failed: ${msg}`);
        lastDiagnostic = { step: 'api', errorType: 'network', message: msg, checkedAt: Date.now() };
        return { available: false, setupStep: 'gcloud', setupHint: 'Unexpected error; check Output for Saropa Crashlytics', issues: [], diagnostics: lastDiagnostic };
    }
}

/** Update a Crashlytics issue state (close or mute). Returns true on success. Never throws. */
export async function updateIssueState(issueId: string, state: 'CLOSED' | 'MUTED'): Promise<boolean> {
    try {
        const token = await getAccessToken();
        if (!token) { return false; }
        const config = await detectFirebaseConfig();
        if (!config) { return false; }
        return await apiUpdateIssueState(config, token, issueId, state);
    } catch {
        return false;
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

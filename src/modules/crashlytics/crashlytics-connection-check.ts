/**
 * Step-by-step Crashlytics connection validator (plan 054, bug_008).
 *
 * Runs the four prerequisites in order — gcloud (or service account), authentication, Firebase config,
 * and a live API call — and returns a structured per-step report. Each failing step carries a
 * plain-language reason AND a concrete fix, so a user who has failed setup repeatedly sees exactly
 * which link broke and what to do, instead of one opaque "Command failed" dump.
 */

import * as vscode from 'vscode';
import { runCmd } from './crashlytics-io';
import { resolveGcloudCmd } from './gcloud-locator';
import { classifyGcloudError } from './crashlytics-diagnostics';
import {
    getAccessToken, detectFirebaseConfig, getLastDiagnostic, clearIssueListCache,
} from './firebase-crashlytics';
import { queryTopIssues, getLastApiDiagnostic } from './crashlytics-api';
import type { FirebaseConfig } from './crashlytics-types';

export type StepStatus = 'pass' | 'fail' | 'skipped';

export interface ConnectionStep {
    readonly id: 'gcloud' | 'auth' | 'config' | 'api';
    readonly label: string;
    readonly status: StepStatus;
    /** Plain-language outcome shown to the user. */
    readonly detail: string;
    /** Actionable next step when the status is 'fail'. */
    readonly fix?: string;
    /** Raw detail for the copyable report / output channel. */
    readonly technical?: string;
}

export interface ConnectionReport {
    readonly steps: readonly ConnectionStep[];
    readonly ok: boolean;
    readonly checkedAt: number;
}

const SERVICE_ACCOUNT_SETTING = 'saropaLogCapture.firebase.serviceAccountKeyPath';

function serviceAccountConfigured(): boolean {
    return vscode.workspace.getConfiguration('saropaLogCapture.firebase')
        .get<string>('serviceAccountKeyPath', '').trim().length > 0;
}

/** Step 1: gcloud reachable, or skipped because a service account key is configured. */
async function checkGcloud(): Promise<ConnectionStep> {
    if (serviceAccountConfigured()) {
        return { id: 'gcloud', label: 'Google Cloud CLI', status: 'skipped', detail: `Using a service account key (${SERVICE_ACCOUNT_SETTING}) — gcloud is not required.` };
    }
    const cmd = resolveGcloudCmd();
    try {
        const out = await runCmd(cmd, ['--version']);
        const where = cmd === 'gcloud' ? 'on PATH' : cmd;
        return { id: 'gcloud', label: 'Google Cloud CLI', status: 'pass', detail: `Found gcloud (${where}).`, technical: (out.split('\n')[0] ?? '').trim() };
    } catch (err) {
        const d = classifyGcloudError(err);
        return {
            id: 'gcloud', label: 'Google Cloud CLI', status: 'fail',
            detail: 'Google Cloud CLI was not found.',
            fix: 'Install it (winget install -e --id Google.CloudSDK), then FULLY quit and reopen VS Code so it picks up the new PATH — or set a service account key to skip gcloud entirely.',
            technical: d.technicalDetails ?? d.message,
        };
    }
}

/** Step 2: an access token can be obtained (via service account or gcloud ADC). */
async function checkAuth(gcloud: ConnectionStep): Promise<ConnectionStep> {
    if (gcloud.status === 'fail') {
        return { id: 'auth', label: 'Authentication', status: 'skipped', detail: 'Skipped — set up Google Cloud access first.' };
    }
    const token = await getAccessToken();
    if (token) {
        return { id: 'auth', label: 'Authentication', status: 'pass', detail: 'Signed in — access token obtained.' };
    }
    const d = getLastDiagnostic();
    return {
        id: 'auth', label: 'Authentication', status: 'fail',
        detail: d?.message ?? 'Could not obtain an access token.',
        fix: 'Run: gcloud auth application-default login (then test again). Or set a service account key.',
        technical: d?.technicalDetails,
    };
}

/** Step 3: a Firebase project + app ID resolve from google-services.json or settings. */
async function checkConfig(): Promise<{ step: ConnectionStep; config?: FirebaseConfig }> {
    const config = await detectFirebaseConfig();
    if (config) {
        return { step: { id: 'config', label: 'Firebase project', status: 'pass', detail: `project=${config.projectId}, app=${config.appId}` }, config };
    }
    const d = getLastDiagnostic();
    return {
        step: {
            id: 'config', label: 'Firebase project', status: 'fail',
            detail: d?.message ?? 'No Firebase project configured.',
            fix: 'Add google-services.json (e.g. android/app/), or set saropaLogCapture.firebase.projectId and .appId.',
        },
    };
}

/** Map a failing HTTP status to the most likely fix. */
function httpFix(status?: number): string {
    if (status === 403) { return 'Your Google account needs the Firebase Crashlytics Viewer role on this project.'; }
    if (status === 404) { return 'Project or app ID is wrong — verify in Firebase Console → Project Settings → General.'; }
    if (status === 401) { return 'Token is invalid or expired — re-run: gcloud auth application-default login.'; }
    return 'See the Saropa Log Capture output channel for the full response.';
}

/** Step 4: a live Crashlytics API call succeeds (distinguishes "no issues" from a real error). */
async function checkApi(auth: ConnectionStep, config?: FirebaseConfig): Promise<ConnectionStep> {
    if (auth.status !== 'pass' || !config) {
        return { id: 'api', label: 'Crashlytics API', status: 'skipped', detail: 'Skipped — sign-in and project must pass first.' };
    }
    const token = await getAccessToken();
    const issues = token ? await queryTopIssues(config, token, []) : [];
    const apiDiag = getLastApiDiagnostic();
    if (apiDiag) {
        return { id: 'api', label: 'Crashlytics API', status: 'fail', detail: apiDiag.message, fix: httpFix(apiDiag.httpStatus), technical: apiDiag.technicalDetails };
    }
    return { id: 'api', label: 'Crashlytics API', status: 'pass', detail: `Connected — ${issues.length} issue(s) returned.` };
}

/**
 * Run the full connection check and return a per-step report. Never throws — any unexpected error
 * surfaces as a failed step so the caller always has something actionable to show.
 */
export async function runConnectionCheck(): Promise<ConnectionReport> {
    clearIssueListCache();
    const steps: ConnectionStep[] = [];
    try {
        const gcloud = await checkGcloud();
        const auth = await checkAuth(gcloud);
        const { step: configStep, config } = await checkConfig();
        const api = await checkApi(auth, config);
        steps.push(gcloud, auth, configStep, api);
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        steps.push({ id: 'api', label: 'Connection check', status: 'fail', detail: 'Unexpected error during the connection check.', technical: message });
    }
    const ok = steps.length > 0 && steps.every(s => s.status !== 'fail') && steps.some(s => s.id === 'api' && s.status === 'pass');
    return { steps, ok, checkedAt: Date.now() };
}

/** Format a report as plain text for the output channel / copy-to-clipboard. */
export function formatConnectionReport(report: ConnectionReport): string {
    const icon = (s: StepStatus): string => (s === 'pass' ? '[PASS]' : s === 'fail' ? '[FAIL]' : '[SKIP]');
    const lines: string[] = [`Crashlytics connection check — ${report.ok ? 'CONNECTED' : 'NOT CONNECTED'}`, ''];
    for (const step of report.steps) {
        lines.push(`${icon(step.status)} ${step.label}: ${step.detail}`);
        if (step.fix) { lines.push(`        Fix: ${step.fix}`); }
        if (step.technical) { lines.push(`        Detail: ${step.technical}`); }
    }
    return lines.join('\n');
}

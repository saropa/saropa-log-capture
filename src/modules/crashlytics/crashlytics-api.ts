/**
 * Crashlytics issue / event queries.
 *
 * Data source: Google Play Developer Reporting `vitals.errors` (bug_008 W3). The
 * firebasecrashlytics.googleapis.com read endpoints this module used before are not a public API
 * (they return a frontend HTML 404), so reads now key off the Android package name via the Play
 * client. The `FirebaseConfig` (projectId/appId) is accepted for signature compatibility but unused.
 *
 * Silent-failure rule (bug_008): on any failure we set `lastApiDiagnostic` and return empty; callers
 * use getLastApiDiagnostic() to distinguish a real failure from a genuinely empty result.
 */

import * as vscode from 'vscode';
import { readCachedEvents, writeCacheEvents, readCachedIssues, writeCachedIssues, recordIssueSnapshot } from './crashlytics-io';
import { detectPackageName } from '../misc/app-identity';
import { fetchPlayErrorIssues, fetchPlayErrorReports } from './play-reporting-errors';
import { logCrashlytics, type DiagnosticDetails } from './crashlytics-diagnostics';
import type { CrashlyticsIssue, CrashlyticsIssueEvents, CrashlyticsEventDetail, FirebaseConfig } from './crashlytics-types';

const issueListTtl = 5 * 60_000;
const issuePageSize = 20;
const reportSampleLimit = 5;

let cachedIssues: { issues: CrashlyticsIssue[]; expires: number } | undefined;
let lastApiDiagnostic: DiagnosticDetails | undefined;

/** Last diagnostic from an API operation (for the caller's error reporting / validator). */
export function getLastApiDiagnostic(): DiagnosticDetails | undefined { return lastApiDiagnostic; }

/** Reset cached issues + diagnostic (called when the parent module clears all caches). */
export function clearApiCache(): void {
    cachedIssues = undefined;
    lastApiDiagnostic = undefined;
}

function getTimeRange(): string {
    return vscode.workspace.getConfiguration('saropaLogCapture.firebase').get<string>('timeRange', 'LAST_7_DAYS');
}

/** Filter issues by error tokens (title+subtitle substring); no tokens = keep all. Capped to the page. */
function filterByTokens(issues: readonly CrashlyticsIssue[], errorTokens: readonly string[]): CrashlyticsIssue[] {
    const lower = errorTokens.map(t => t.toLowerCase()).filter(t => t.length > 0);
    if (lower.length === 0) { return issues.slice(0, issuePageSize); }
    return issues
        .filter(i => { const hay = `${i.title} ${i.subtitle}`.toLowerCase(); return lower.some(t => hay.includes(t)); })
        .slice(0, issuePageSize);
}

/**
 * Top error issues via Play Developer Reporting. `config.projectId` is the quota project sent as
 * X-Goog-User-Project (required for user ADC). Never throws; on failure sets lastApiDiagnostic and [].
 */
export async function queryTopIssues(config: FirebaseConfig, token: string, errorTokens: readonly string[]): Promise<CrashlyticsIssue[]> {
    if (cachedIssues && Date.now() < cachedIssues.expires) {
        return filterByTokens(cachedIssues.issues, errorTokens);
    }
    const packageName = await detectPackageName();
    if (!packageName || typeof token !== 'string') {
        lastApiDiagnostic = { step: 'config', errorType: 'config', checkedAt: Date.now(), message: 'No Android package name found — add google-services.json / AndroidManifest, or set saropaLogCapture.firebase.packageName.' };
        return [];
    }
    const { data, diagnostic } = await fetchPlayErrorIssues({ packageName, token, timeRange: getTimeRange(), quotaProject: config?.projectId ?? '' }, issuePageSize);
    if (diagnostic) {
        // Couldn't refresh (offline / API error): serve the last persisted list so issues stay
        // visible, and flag it as stale rather than showing an empty list. (offline cache)
        const cachedDisk = await readCachedIssues();
        if (cachedDisk && cachedDisk.length > 0) {
            lastApiDiagnostic = { step: 'api', errorType: diagnostic.errorType, checkedAt: Date.now(), message: 'Showing cached issues — could not refresh (offline or API error).' };
            cachedIssues = { issues: cachedDisk, expires: Date.now() + issueListTtl };
            return filterByTokens(cachedDisk, errorTokens);
        }
        lastApiDiagnostic = diagnostic;
        logCrashlytics('error', `Play errorIssues: ${diagnostic.message}`);
        return [];
    }
    lastApiDiagnostic = undefined;
    writeCachedIssues(data).catch(() => {});
    // Record a compact timestamped snapshot so regression / new-issue detection has a baseline.
    recordIssueSnapshot(data).catch(() => {});
    cachedIssues = { issues: data, expires: Date.now() + issueListTtl };
    return filterByTokens(data, errorTokens);
}

/** First sampled event (stack) for an issue. */
export async function getCrashEventDetail(token: string, config: FirebaseConfig, issueId: string): Promise<CrashlyticsEventDetail | undefined> {
    const multi = await getCrashEvents(token, config, issueId);
    return multi?.events[multi.currentIndex];
}

/**
 * Sampled crash reports (stacks) for an issue, cached on disk. `config` unused (Play keys off package).
 * On failure sets lastApiDiagnostic and returns undefined.
 */
export async function getCrashEvents(token: string, config: FirebaseConfig, issueId: string): Promise<CrashlyticsIssueEvents | undefined> {
    const cached = await readCachedEvents(issueId);
    if (cached) { return cached; }
    const packageName = await detectPackageName();
    if (!packageName) { return undefined; }
    const { data, diagnostic } = await fetchPlayErrorReports({ packageName, token, timeRange: getTimeRange(), quotaProject: config?.projectId ?? '' }, issueId, reportSampleLimit);
    if (diagnostic) { lastApiDiagnostic = diagnostic; return undefined; }
    if (data.length === 0) { return undefined; }
    const result: CrashlyticsIssueEvents = { issueId, events: data, currentIndex: 0 };
    writeCacheEvents(issueId, result).catch(() => {});
    return result;
}

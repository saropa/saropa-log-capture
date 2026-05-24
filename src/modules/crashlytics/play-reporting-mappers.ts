/**
 * Pure mappers: Google Play Developer Reporting error shapes → the panel's existing Crashlytics types.
 *
 * Keeping the panel's `CrashlyticsIssue` / `CrashlyticsEventDetail` contract means the whole UI layer
 * is unchanged when the data source moves off the dead firebasecrashlytics endpoint (bug_008 W3).
 * Field names follow the published v1beta1 discovery schema (verified, not guessed).
 */

import type { CrashlyticsIssue, CrashlyticsEventDetail, CrashlyticsThread, IssueKind } from './crashlytics-types';

type Json = Record<string, unknown>;

/** Play ErrorIssue.type values that count as fatal (the remaining value is NON_FATAL). */
function isFatalType(type: string): boolean {
    return type === 'CRASH' || type === 'APPLICATION_NOT_RESPONDING';
}

/** Map the Play ErrorIssue.type enum to the dashboard's tab category. */
export function issueKind(type: string): IssueKind {
    if (type === 'CRASH') { return 'crash'; }
    if (type === 'APPLICATION_NOT_RESPONDING') { return 'anr'; }
    if (type === 'NON_FATAL') { return 'nonfatal'; }
    return 'unknown';
}

/** AppVersion → its versionCode string, or undefined. */
function appVersionLabel(v: unknown): string | undefined {
    const code = (v as Json | undefined)?.versionCode;
    return typeof code === 'string' && code ? code : undefined;
}

/** OsVersion → "API NN", or undefined. */
export function osVersionLabel(v: unknown): string | undefined {
    const api = (v as Json | undefined)?.apiLevel;
    return typeof api === 'string' && api ? `API ${api}` : undefined;
}

/** DeviceModelSummary → marketing name, falling back to "brand device", or undefined. */
export function deviceModelLabel(v: unknown): string | undefined {
    const d = v as Json | undefined;
    if (!d) { return undefined; }
    if (typeof d.marketingName === 'string' && d.marketingName) { return d.marketingName; }
    const id = d.deviceId as Json | undefined;
    const brand = typeof id?.buildBrand === 'string' ? id.buildBrand : '';
    const device = typeof id?.buildDevice === 'string' ? id.buildDevice : '';
    return `${brand} ${device}`.trim() || undefined;
}

/** The numeric short id from an issue resource name `apps/{app}/errorIssues/{id}`. */
export function issueShortId(resourceName: string): string {
    const slash = resourceName.lastIndexOf('/');
    return slash >= 0 ? resourceName.slice(slash + 1) : resourceName;
}

/** Map a Play ErrorIssue to the panel's CrashlyticsIssue shape. */
export function mapErrorIssue(raw: Json): CrashlyticsIssue {
    const type = String(raw.type ?? '');
    return {
        id: String(raw.name ?? ''),
        title: String(raw.cause ?? raw.location ?? 'Unknown error'),
        subtitle: String(raw.location ?? ''),
        eventCount: Number(raw.errorReportCount ?? 0),
        userCount: Number(raw.distinctUsers ?? 0),
        isFatal: isFatalType(type),
        kind: issueKind(type),
        // Play Developer Reporting has no open/closed/regression state on an issue.
        state: 'UNKNOWN',
        firstVersion: appVersionLabel(raw.firstAppVersion),
        lastVersion: appVersionLabel(raw.lastAppVersion),
    };
}

/** Split a report's text blob into a single "Crash" thread of frame lines (blank lines dropped). */
export function parseReportText(reportText: string): CrashlyticsThread | undefined {
    const frames = reportText
        .split('\n')
        .map(line => line.replace(/\s+$/, ''))
        .filter(line => line.trim().length > 0)
        .map(text => ({ text }));
    return frames.length > 0 ? { name: 'Crash', frames } : undefined;
}

/** Map a Play ErrorReport to a CrashlyticsEventDetail (the stack lives in reportText). */
export function mapErrorReport(issueId: string, raw: Json): CrashlyticsEventDetail {
    const reportText = typeof raw.reportText === 'string' ? raw.reportText : '';
    return {
        issueId,
        crashThread: reportText ? parseReportText(reportText) : undefined,
        appThreads: [],
        deviceModel: deviceModelLabel(raw.deviceModel),
        osVersion: osVersionLabel(raw.osVersion),
        eventTime: typeof raw.eventTime === 'string' ? raw.eventTime : undefined,
    };
}

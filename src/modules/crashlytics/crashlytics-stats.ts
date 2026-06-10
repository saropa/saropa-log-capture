/**
 * Per-issue aggregate device/OS distribution — STUB.
 *
 * Why this is a stub (bug_008 W7): the original implementation called
 * `firebasecrashlytics.googleapis.com/v1beta1/projects/{p}/apps/{a}/issues/{id}:getStats`, which is
 * not a public API and always returns a Google frontend HTML 404. The previous code wrapped that
 * call in `catch { return undefined; }`, so every panel render silently produced an empty stats
 * pane — the exact silent-failure pattern bug_008 set out to eliminate.
 *
 * The proper replacement is Play Developer Reporting's `errorCountMetricSet:query` with
 * `deviceModel` / `apiLevel` dimensions filtered by `errorIssueId`. That work belongs in
 * plan_054 (App Quality Insights) — see `plans/054_plan-app-quality-insights.md` rows for "Device/OS
 * breakdown pane" and "Breakdown fidelity — re-scope to the Play Reporting response."
 *
 * The `IssueStats` / `StatEntry` shape and `renderApiDistribution` renderer are preserved so the
 * future metric-set fetcher can drop into this signature without touching the UI layer.
 */

import type { DiagnosticDetails } from './crashlytics-diagnostics';

export interface StatEntry { readonly name: string; readonly count: number; }

export interface IssueStats {
    readonly issueId: string;
    readonly deviceStats: readonly StatEntry[];
    readonly osStats: readonly StatEntry[];
}

let lastStatsDiagnostic: DiagnosticDetails | undefined;

/** Last failure reason for callers that want to distinguish "no data" from "feature disabled". */
export function getLastStatsDiagnostic(): DiagnosticDetails | undefined { return lastStatsDiagnostic; }

/**
 * Returns `undefined` until plan_054 implements the Play Reporting metric-set replacement. Sets a
 * diagnostic so any future caller (and the connection validator) can surface the disabled state
 * rather than treat it as "no crashes."
 *
 * `issueId` accepted to preserve the call signature for plan_054.
 */
export async function getIssueStats(issueId: string): Promise<IssueStats | undefined> {
    lastStatsDiagnostic = {
        step: 'api',
        errorType: 'config',
        checkedAt: Date.now(),
        message: `Per-issue device/OS distribution disabled (bug_008 W7): the legacy :getStats endpoint is non-public. Replacement via Play Reporting errorCountMetricSet is tracked in plan_054. issueId=${issueId}`,
    };
    return undefined;
}

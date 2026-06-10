# Bug 008 — Crashlytics/Vitals connection: gcloud not on PATH, dead read API, missing scope, silent failures

## Status: Fixed — verified live (errorIssues:search returned real saropa-mobile issues on 2026-05-24). W1–W6 + silent-failure + enable-by-default all landed.

<!-- Status values: Open → Investigating → Fix Ready → Fixed (pending review) → Closed -->

## Scope: this bug is the CONNECTION only

This report covers getting a working Crashlytics / Android-vitals **data connection** — gcloud
resolution, authentication, the correct API host, OAuth scopes, and turning every failure into
actionable feedback (no silent empties).

The **UI / dashboard design** — the 3-pane "App Quality Insights" view, parity with Android Studio's
Crashlytics + Android vitals screens, the setup-wizard redesign, and the "WOW" features — is tracked
separately in **[plan 054](../plans/054_plan-app-quality-insights.md)**. The dashboard consumes whatever this
bug's data layer returns. Keep connection/auth/API discussion here; keep layout/UX/feature discussion
in plan 054.

---

## Summary

Getting Crashlytics to show data fails at **four stacked walls** (verified live on 2026-05-23 against
project `saropa-mobile` / `com.saropamobile.app`). Each wall is independent — fixing one only exposes
the next, which is why setup "failed 7 times" with no clear reason:

| # | Wall | Status |
|---|------|--------|
| W1 | gcloud installed by winget but **never added to PATH** → bare `gcloud` never resolves | **Fixed** (locator) |
| W2 | The "not found" error was **misclassified** as a generic "Command failed" | **Fixed** (classifier) |
| W3 | The Crashlytics **read endpoint is not a public API** (HTML 404) | **Fixed** — re-pointed to Play Reporting `vitals.errors` |
| W4 | The real API needs the **`playdeveloperreporting` OAuth scope** the ADC token lacks | **Fixed** — sign-in requests the scope; 403 decoded |
| W5 | The real API needs the **`X-Goog-User-Project` quota-project header** for user ADC | **Fixed** — client sends `config.projectId` |
| W6 | The **Play Developer Reporting API must be enabled** on the project | **Fixed** — `gcloud services enable` (done); 403 decoded |
| W7 | `crashlytics-stats.ts:getIssueStats` still called the dead `:getStats` endpoint | **Fixed** — call disabled, module stubbed; plan_054 owns the metric-set replacement |
| — | Pervasive **silent failure** (`catch { return [] }`) hides the above as "no crashes" | **Fixed** — every fetch sets a diagnostic |

Plus **(a)** the integration is now **on by default** (`"crashlytics"` in the adapters default).

**Verified live (2026-05-24):** after the scope re-auth + `gcloud services enable
playdeveloperreporting.googleapis.com`, `errorIssues:search` for `com.saropamobile.app` returned real
issues (top 5 were `libflutter.so` / `MessageQueue.nativePollOnce` ANRs — matching the Android Studio
screenshots). W5 (quota header) and W6 (API enablement) were discovered during this verification: W4's
scope fix only exposed them, exactly the layered-wall pattern. The header fix is in code; W6 is a
one-time per-project `gcloud services enable`.

**Last step:** F5 the extension and click Test connection to confirm the panel renders the live data
(the request the code now builds is byte-for-byte the one that returned 200 in the manual test).

---

## Environment

- OS: Windows 11 Pro (win32). Workspace: `D:\src\contacts`.
- Google Cloud SDK installed via `winget` (`Google.CloudSDK`), reported 569.0.0; on-disk 556.0.0.
- Firebase/Play app: project `saropa-mobile`, package `com.saropamobile.app`,
  appId `1:228881730256:android:132f2dd87b5aef65a02cd5` (from `android/app/google-services.json`).

---

## The walls (verified evidence)

### W1 — gcloud is installed but not on PATH (environment)

The reporter's log showed every call failing with `'gcloud' is not recognized`. The original theory
here ("stale PATH that a restart fixes") was **wrong** — they had restarted many times. Verified on
the machine:

```
Get-Command gcloud                                                         -> NOT on PATH
winget list Google.CloudSDK                                                -> installed, 569.0.0
Test-Path %LOCALAPPDATA%\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd  -> True
& "<that path>" --version                                                  -> Google Cloud SDK 556.0.0
& "<that path>" auth application-default print-access-token                -> 256-char token (auth OK)
```

`winget install Google.CloudSDK` installs gcloud to `%LOCALAPPDATA%\…\bin\gcloud.cmd` **but never adds
it to PATH**. A bare `gcloud` therefore never resolves, no matter how many restarts — a restart can't
restore a PATH entry that was never written.

### W2 — "not found" was misclassified (code)

`runCmd()` spawns with `shell: true` (required to run the `gcloud.cmd` shim). On Windows a missing
command is reported by `cmd.exe` (`'gcloud' is not recognized`, exit 1/9009) — **not** a Node
`ENOENT`. The old `classifyGcloudError()` only checked `code === 'ENOENT'`, so the "not found in PATH"
branch was dead on Windows and the error fell through to the generic `gcloud check failed: …`. Same
for `classifyTokenError()`, so the token failure read `Authentication failed: 'gcloud' is not
recognized…` — sending the user chasing a sign-in problem that did not exist.

### W3 — CRITICAL: the Crashlytics read endpoint is not a public API

With W1/W2 fixed the API call is finally reached — and hits a Google **frontend HTML 404**:

```
POST firebasecrashlytics.googleapis.com/v1beta1/projects/saropa-mobile/apps/<appId>/reports/topIssues:query
  -> 404, HTML "The requested URL … was not found on this server"   (NOT a JSON API error)
GET  firebasecrashlytics.googleapis.com/$discovery/rest?version=v1beta1   -> 403 (no public discovery)
gcloud services list --enabled --filter crashlytics                       -> 0 items
```

An HTML frontend 404 means the path is not a routed public method. **`crashlytics-api.ts` and
`crashlytics-stats.ts` are built on a non-public endpoint that does not exist for general callers** —
so the Crashlytics read feature has effectively never worked end-to-end. No auth/config change fixes
this.

**The real public API is Google Play Developer Reporting** (`playdeveloperreporting.googleapis.com`,
v1beta1). Its `vitals.errors` resource (`errorIssues:search`, `errorReports:search`, counts) is the
same data Android Studio's "Android vitals" tab shows — verified present in its discovery doc. The
extension already calls this host for crash/ANR **rates** (`google-play-vitals.ts`) but not for
issues/stacks.

### W4 — the real API needs the Play reporting OAuth scope

```
GET playdeveloperreporting.googleapis.com/v1beta1/apps/com.saropamobile.app/errorIssues:search
  -> 403 ACCESS_TOKEN_SCOPE_INSUFFICIENT (reason: ACCESS_TOKEN_SCOPE_INSUFFICIENT)
```

The ADC token from `gcloud auth application-default print-access-token` carries `cloud-platform` but
**not** `https://www.googleapis.com/auth/playdeveloperreporting`. Fix (single source of truth in code:
`playReportingScopeFix` in `crashlytics-diagnostics.ts`):

```
gcloud auth application-default login --scopes=https://www.googleapis.com/auth/cloud-platform,https://www.googleapis.com/auth/playdeveloperreporting
```

This very likely also explains why the existing **vitals rate panel** shows N/A — same missing scope.
(Still to confirm after re-auth: the API may also need enabling on the project and the account needs
Play Console access for the app.)

### Cross-cutting — pervasive silent failure (the reporter's core concern)

`queryTopIssues` does `catch { return []; }`; `google-play-vitals.ts` `fetchJson` returns `undefined`
on error. So a dead endpoint, a missing scope, or a disabled API all surface as **"no crashes"** —
success-looking emptiness — instead of guidance. **Every fetch must set a diagnostic on failure, and
the UI must distinguish "no data" from "error."** The connection validator (added) is the first step;
the data-fetch paths still need to stop returning bare empty on error.

---

## (a) Off by default (separate, low-risk)

The Crashlytics sidebar is gated by membership in `saropaLogCapture.integrations.adapters`, whose
default omits `"crashlytics"` (`viewer-styles-icon-bar.ts:179` hides the icon until enabled). Enabling
it means adding `"crashlytics"` to that default array in `package.json`.

> ⚠️ **Blast radius — needs sign-off.** Flips a shipped default every install inherits. Confirm the
> sidebar degrades gracefully on non-Firebase workspaces (setup prompt, not an error) and never
> auto-runs gcloud/network on activation (lookup stays lazy). Hold until W3/W4 land — enabling a
> feature that can't connect would ship the silent-failure experience to everyone.

---

## Fix plan

- **W1 — gcloud locator. DONE.** `gcloud-locator.ts` probes known install dirs and runs gcloud by
  absolute path; `runCmd` quotes paths with spaces. Verified to execute on the reporter's machine.
- **W2 — classification. DONE.** `isCommandMissing()` recognizes "is not recognized" / "command not
  found" in addition to `ENOENT`, on both the gcloud check and the token fetch.
- **W3 — re-point the data source. DONE for issues + reports.** `crashlytics-api.ts` now goes via
  `play-reporting-errors.ts` (`errorIssues:search` / `errorReports:search` on
  `playdeveloperreporting.googleapis.com`). The per-issue `:getStats` device/OS breakdown was the
  one remaining caller of the dead host (see W7) — disabled here; metric-set replacement lives in
  plan_054 (App Quality Insights).
- **W4 — scope. DONE.** `classifyHttpStatus` decodes `ACCESS_TOKEN_SCOPE_INSUFFICIENT` and surfaces
  `playReportingScopeFix` (the exact `gcloud auth application-default login --scopes=…` command) so
  the wizard / output channel can guide the re-auth.
- **W7 — disable the per-issue stats call. DONE.** `getIssueStats` in `crashlytics-stats.ts` no
  longer hits the dead `firebasecrashlytics.googleapis.com/.../issues/{id}:getStats` endpoint; the
  module is a documented stub that returns `undefined` + a diagnostic. The `analysis-panel.ts`
  call site is removed (no silent 404 traffic). Renderer `renderApiDistribution` and the
  `IssueStats` type are preserved for plan_054 to drive from `errorCountMetricSet`.
- **Silent failure — DONE.** `queryTopIssues` sets `lastApiDiagnostic` on every failure
  ([crashlytics-api.ts:25,68,72](../src/modules/crashlytics/crashlytics-api.ts#L25)); vitals fetches
  expose `lastVitalsDiagnostic` ([google-play-vitals.ts:17](../src/modules/crashlytics/google-play-vitals.ts#L17));
  W7 stub sets `lastStatsDiagnostic`. The connection validator surfaces them per-step.
- **Connection validator — DONE.** `runConnectionCheck()` reports gcloud/auth/config/api per-step
  with a fix each; surfaced via the wizard "Test connection" button, the output channel, and a
  toast.
- **(a) enable-by-default — DONE.** `"crashlytics"` is in the default
  `saropaLogCapture.integrations.adapters` array ([package.json:1657](../package.json#L1657)).
  Sidebar degrades gracefully on non-Firebase workspaces and only runs gcloud/network lazily on
  user action — not at activation.

### Immediate workaround for the reporter (no new build needed)

1. The W1 locator fix already lets the extension find gcloud — no restart needed.
2. Add the Play reporting scope so the real API is reachable:
   `gcloud auth application-default login --scopes=https://www.googleapis.com/auth/cloud-platform,https://www.googleapis.com/auth/playdeveloperreporting`

---

## Changes Made

- **`gcloud-locator.ts` (new)** — `findGcloudInKnownLocations()` / `resolveGcloudCmd()` /
  `resetGcloudLocatorCache()`.
- **`crashlytics-io.ts`** — `runCmd` quotes space-containing executable paths.
- **`crashlytics-diagnostics.ts`** — `isCommandMissing()` (W2); `classifyHttpStatus` now decodes a
  missing scope (`playReportingScopeFix`) and a disabled API into actionable messages (W4).
- **`firebase-crashlytics.ts`** — uses `resolveGcloudCmd()`; resets locator cache in
  `clearIssueListCache()`; exports `getLastDiagnostic()`.
- **`crashlytics-connection-check.ts` (new)** — `runConnectionCheck()` + `formatConnectionReport()`.
- **Wizard wiring** — `viewer-crashlytics-setup.ts` (Test connection button + per-step report render),
  `crashlytics-handlers.ts` (`handleCrashlyticsValidate`), `viewer-message-handler-panels.ts` dispatch,
  `strings-a.ts` toasts.
- **`play-reporting-errors.ts` (new)** — `fetchPlayErrorIssues` / `fetchPlayErrorReports` against
  `playdeveloperreporting.googleapis.com`; sends `X-Goog-User-Project` (W5); returns a populated
  diagnostic on every failure.
- **`crashlytics-api.ts`** — `queryTopIssues` / `getCrashEvents` re-routed through Play Reporting;
  `lastApiDiagnostic` set on every failure (W3 + silent-failure).
- **`google-play-vitals.ts`** — error path now records `lastVitalsDiagnostic` instead of returning
  bare `undefined` (silent-failure fix for the rate panel).
- **`package.json`** — `"crashlytics"` added to default `saropaLogCapture.integrations.adapters`
  ((a) enable-by-default).
- **W7 — disable dead `:getStats` call.**
  - `crashlytics-stats.ts` — replaced the `firebasecrashlytics.googleapis.com/.../issues/{id}:getStats`
    HTTP path with a documented stub. `getIssueStats` returns `undefined` + sets
    `lastStatsDiagnostic`. `IssueStats` / `StatEntry` types preserved for plan_054.
  - `analysis-panel.ts` — removed the `getIssueStats(issueId).then(...)` call site and the
    `crash-stats-${issueId}` slot. Comment points to plan_054 for the metric-set replacement.
  - `analysis-panel-script.ts` — removed the `issueStatsReady` webview handler.
  - `analysis-crash-detail.ts` — `renderApiDistribution` retained (unused today) so plan_054 can
    drive it from `errorCountMetricSet` without recreating the renderer.

## Tests Added

`src/test/modules/crashlytics/crashlytics-connection-check.test.ts` — classification (W2: Windows /
POSIX / ENOENT → missing, timeout not mislabeled; token-fetch "is not recognized" → gcloud-missing,
not auth) and `formatConnectionReport` (per-step status, fixes, CONNECTED/NOT CONNECTED header).

## Commits

- `a1cef9e1` feat(crashlytics): redesign setup wizard as a guided three-step flow
- `6e20149b` fix(crashlytics): make the connection robust and add a step-by-step validator (bug_008)
- `d8bbe9b9` fix(crashlytics): decode scope/disabled 403s; correct bug_008 root cause
- _(this commit)_ fix(crashlytics): disable dead `:getStats` call; archive bug_008 (W7)

## Finish Report (2026-06-02)

### Trigger

User asked "is this bug report fully implemented?" Verified W1–W6 + silent-failure +
enable-by-default landed in code, but two gaps remained:
1. The doc's Fix-plan section still listed W3, W4, silent-failure, and (a) as **OPEN**, contradicting
   the top-of-doc "Fixed" status banner.
2. `crashlytics-stats.ts:getIssueStats` still called the dead
   `firebasecrashlytics.googleapis.com/.../issues/{id}:getStats` endpoint inside a
   `catch { return undefined; }` — the exact silent-failure pattern bug_008 set out to eliminate.
   The call site was `analysis-panel.ts` (line-analysis panel, per-issue aggregate device/OS pane).

User authorized both follow-ups: doc cleanup and disabling the dead `:getStats` path.

### Resolution

**Doc cleanup (bug_008 itself):**

- Added W7 row to the status table for the `:getStats` dead-endpoint gap.
- Flipped Fix-plan section OPEN → DONE for W3, W4, silent-failure, and (a).
- Added "Changes Made" entries for play-reporting-errors, crashlytics-api re-route, vitals
  diagnostic, enable-by-default, and W7 stats stub.
- Removed the stale "crash list still won't populate until W3 lands" workaround note.

**Code fix (W7 — disable dead `:getStats`):**

- [crashlytics-stats.ts](../../../src/modules/crashlytics/crashlytics-stats.ts) — rewritten as a
  documented stub. `getIssueStats` returns `undefined` and records `lastStatsDiagnostic` so the
  state is auditable (no more `catch { return undefined; }`). Module doc explains the WHY
  (non-public endpoint) and points to plan_054 for the proper Play Reporting
  `errorCountMetricSet` replacement. `IssueStats` / `StatEntry` types preserved so plan_054 can
  drive the existing `renderApiDistribution` without recreating the file.
- [analysis-panel.ts](../../../src/ui/analysis/analysis-panel.ts) — removed `getIssueStats` import,
  the `.then(...)` call site, the `crash-stats-${issueId}` slot div, and the unused
  `renderApiDistribution` import. Inline comment explains WHY and routes future work to plan_054.
- [analysis-panel-script.ts](../../../src/ui/analysis/analysis-panel-script.ts) — removed the
  orphan `issueStatsReady` webview handler.
- [webview-outbound-message-types.md](../../../doc/internal/webview-outbound-message-types.md) —
  regenerated via `npm run generate:host-outbound-catalog` (one fewer outbound type).

**External link repointing for the archival move:**

- [CHANGELOG.md](../../../CHANGELOG.md) — two `bugs/bug_008_*.md` refs repointed to the new
  `plans/history/2026.06/2026.06.02/` archive path. Plus the pre-existing typo `bugs/054_plan-*.md`
  corrected to `plans/054_plan-*.md`.
- [plans/054_plan-app-quality-insights.md](../../054_plan-app-quality-insights.md) — two
  `../bugs/bug_008_*.md` refs repointed to `history/2026.06/2026.06.02/bug_008_*.md`.

### Verification

- `npm run check-types` — clean.
- `npm run lint` — clean on every touched file (the 13 warnings on the full run are pre-existing
  in unrelated files: `runSmartBookmarkAction` params, `viewer-context-menu-html.test.ts` file
  length, etc).
- `npm run compile` — esbuild + verify-nls + webview-outbound-catalog + list-commands +
  dist-size all pass. The `verify:webview-catalog` failure is unrelated pre-existing drift from
  an `acknowledgeUnreadLogs` handler added by the parallel newer-log-banner workstream
  ([viewer-message-handler-session-ui.ts:140](../../../src/ui/provider/viewer-message-handler-session-ui.ts#L140)) —
  verified independent of this fix by stashing my edits and running the verify step on a clean
  tree, which produced the same failure. That workstream needs to regenerate the incoming
  catalog when it lands; not mine to bundle.
- Test audit — grepped `src/test/` for `crashlytics-stats`, `getIssueStats`, `IssueStats`,
  `StatEntry`, `renderApiDistribution`, `issueStatsReady`, `crash-stats-`: zero matches. No
  existing test pins the changed surface, so no test edits required.

### Out of scope (deferred to plan_054)

Per-issue device/OS distribution against Play Reporting's `errorCountMetricSet` with
`deviceModel` / `apiLevel` dimensions. Plan_054 already documents this (line 131, 153-155); the
renderer and types here are preserved as the integration point.

### Files in this commit

- `bugs/bug_008_*.md` → `plans/history/2026.06/2026.06.02/bug_008_*.md` (rename + status table
  W7 row + flipped OPEN→DONE entries + Changes Made update + this Finish Report appended)
- `CHANGELOG.md` (Unreleased / Fixed entry + 2 archival-path repoints)
- `doc/internal/webview-outbound-message-types.md` (regenerated)
- `plans/054_plan-app-quality-insights.md` (2 archival-path repoints)
- `src/modules/crashlytics/crashlytics-stats.ts` (rewritten as stub)
- `src/ui/analysis/analysis-panel.ts` (call site removed)
- `src/ui/analysis/analysis-panel-script.ts` (orphan handler removed)

`Closes bug: plans/history/2026.06/2026.06.02/bug_008_crashlytics-enable-default-and-gcloud-path.md`

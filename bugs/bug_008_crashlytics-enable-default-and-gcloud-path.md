# Bug 008 — Crashlytics/Vitals connection: gcloud not on PATH, dead read API, missing scope, silent failures

## Status: Fixed (pending on-machine verification) — W1–W4 + silent-failure + enable-by-default all landed; needs a scoped-token run to confirm live data

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
| — | Pervasive **silent failure** (`catch { return [] }`) hides W3/W4 as "no crashes" | **Fixed** — every fetch sets a diagnostic |

Plus **(a)** the integration is now **on by default** (`"crashlytics"` in the adapters default).

**Remaining:** end-to-end verification needs a token minted with the Play reporting scope (interactive
`gcloud auth application-default login --scopes=…` — user action). The client is built against the
published v1beta1 schema and unit-tested, but a live 200 from `errorIssues:search` for this account is
not yet confirmed (every prior call was 403 scope). The validator will confirm on-machine.

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
- **W3 — re-point the data source. OPEN.** Replace the dead `firebasecrashlytics.googleapis.com`
  endpoints in `crashlytics-api.ts` / `crashlytics-stats.ts` with Play Developer Reporting
  `vitals.errors` (`errorIssues:search` for the list, `errorReports:search` for stacks, the count
  metric set for trends). Reuse the existing `playdeveloperreporting` host already used for rates.
- **W4 — scope. OPEN.** Detect `ACCESS_TOKEN_SCOPE_INSUFFICIENT` (done in `classifyHttpStatus`) and
  offer the `playReportingScopeFix` re-auth; consider running it via the existing terminal-auth helper
  so the wizard can fix it in one click.
- **Silent failure — OPEN.** Make `queryTopIssues` / vitals fetches record a diagnostic on every
  failure; the panel shows the diagnostic (or "no data" only when the call genuinely succeeded empty).
- **Connection validator — DONE (first cut).** `runConnectionCheck()` reports gcloud/auth/config/api
  per-step with a fix each; surfaced via the wizard "Test connection" button, the output channel, and
  a toast. To extend once W3 lands: test the real Play errors call, not the dead endpoint.
- **(a) enable-by-default — OPEN (needs sign-off).**

### Immediate workaround for the reporter (no new build needed)

1. The W1 locator fix already lets the extension find gcloud — no restart needed.
2. Add the Play reporting scope so the real API is reachable:
   `gcloud auth application-default login --scopes=https://www.googleapis.com/auth/cloud-platform,https://www.googleapis.com/auth/playdeveloperreporting`
3. Note: the crash list still won't populate until W3 (re-point to Play Reporting) lands — today the
   extension calls the dead Crashlytics endpoint.

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

## Tests Added

`src/test/modules/crashlytics/crashlytics-connection-check.test.ts` — classification (W2: Windows /
POSIX / ENOENT → missing, timeout not mislabeled; token-fetch "is not recognized" → gcloud-missing,
not auth) and `formatConnectionReport` (per-step status, fixes, CONNECTED/NOT CONNECTED header).

## Commits

- `a1cef9e1` feat(crashlytics): redesign setup wizard as a guided three-step flow
- `6e20149b` fix(crashlytics): make the connection robust and add a step-by-step validator (bug_008)
- `d8bbe9b9` fix(crashlytics): decode scope/disabled 403s; correct bug_008 root cause

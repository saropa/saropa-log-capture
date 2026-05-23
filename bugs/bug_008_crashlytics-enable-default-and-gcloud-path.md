# Bug 008 — Crashlytics off by default + gcloud "not recognized" despite being installed

## Status: (b) Fix Ready · (a) Open (needs sign-off)

<!-- Status values: Open → Investigating → Fix Ready → Fixed (pending review) → Closed -->

This report covers two linked goals for getting Firebase Crashlytics working out of the box:

- **(a)** Enable the Crashlytics integration by default. — **Still Open.** This flips a shipped default
  every install inherits (blast radius), so it awaits explicit sign-off before landing.
- **(b)** Fix the `gcloud` auth path so it works when the Google Cloud CLI is installed but the
  extension host can't resolve it on `PATH` (current real-world failure on Windows). — **Fix Ready**
  (see Changes Made), plus a new step-by-step connection validator for real failure feedback.

---

## Problem

### (a) Crashlytics is opt-in, not on by default

The Crashlytics sidebar and lookups are gated by membership in the
`saropaLogCapture.integrations.adapters` array. The shipped default array does **not** include
`"crashlytics"`, so a fresh install never shows the feature unless the user edits settings.

Default today (`package.json`):

```jsonc
"saropaLogCapture.integrations.adapters": {
  "default": ["packages", "git", "environment", "performance", "terminal", "flutterCrashLogs"]
  // "crashlytics" is absent → sidebar hidden, no auto-lookup
}
```

The Crashlytics icon is explicitly hidden until the adapter is enabled
(`src/ui/viewer-styles/viewer-styles-icon-bar.ts:179`).

### (b) `gcloud` reported "not recognized" even though it is installed

`winget` confirms the Google Cloud SDK is already installed:

```
PS D:\src\contacts> winget install -e --id Google.CloudSDK
Found an existing package already installed. Trying to upgrade the installed package...
This package's version number cannot be determined. To upgrade it anyway, add the argument --include-unknown ...
PS D:\src\contacts> winget install -e --id Google.CloudSDK --include-unknown
Found an existing package already installed. Trying to upgrade the installed package...
No applicable upgrade found.
```

But the extension's Crashlytics auth fails:

```
[Crashlytics] ERROR Token fetch: Authentication failed: 'gcloud' is not recognized as an internal or external command,
operable program or batch file.
[Crashlytics] ERROR gcloud check: gcloud check failed: Command failed: gcloud --version
'gcloud' is not recognized as an internal or external command,
operable program or batch file.
```

Two things are wrong here:

1. The CLI is installed but the **extension host process can't see it on `PATH`** (environment not
   refreshed since install).
2. The error is **misclassified**: this should read "Google Cloud CLI not found in PATH" but instead
   surfaces the raw generic fallback `gcloud check failed: Command failed: gcloud --version`.

---

## Environment

- OS: Windows 11 Pro (win32)
- Google Cloud SDK: installed via `winget` (`Google.CloudSDK`), version "cannot be determined" by winget
- Firebase project (target): `saropa-mobile`
  — console: https://console.firebase.google.com/u/0/project/saropa-mobile/overview
- Workspace: `D:\src\contacts`

---

## Reproduction

### (a)

1. Install the extension fresh (no user settings overrides).
2. Open a Flutter/Android workspace.
3. Observe the Crashlytics sidebar/icon is hidden — feature unavailable until
   `"crashlytics"` is manually added to `saropaLogCapture.integrations.adapters`.

**Frequency:** Always.

### (b)

1. Install gcloud via `winget install -e --id Google.CloudSDK` (per-user install).
2. Without a full Windows session/VS Code restart, enable Crashlytics and trigger a lookup.
3. Auth fails with `'gcloud' is not recognized…` and the diagnostic shows the generic fallback
   message, not "not found in PATH".

**Frequency:** Always, when VS Code's inherited environment predates the gcloud install (or when
gcloud's `bin` dir is not on the machine/user `PATH` the host process inherited).

---

## Root Cause

### (a) `"crashlytics"` missing from the default adapter list

`package.json` → `saropaLogCapture.integrations.adapters.default` does not list `"crashlytics"`.
The feature is wired and functional; it's simply not opted in by default.

### (b) Two compounding causes

**B1 — PATH visibility (environment, not code).**
`winget install Google.CloudSDK` is a **per-user** install that writes `gcloud` into a location like
`%LOCALAPPDATA%\Google\Cloud SDK\google-cloud-sdk\bin` and updates the user `PATH`. A VS Code window
(and its extension host) launched **before** that PATH update inherits the stale environment, so
`cmd.exe` cannot resolve `gcloud`. A window *reload* does not re-read the OS environment; only a full
VS Code restart from a fresh login environment (or machine sign-out/in) does.

**B2 — Windows error misclassification (real code bug).**
`runCmd()` spawns with `shell: true` (`src/modules/crashlytics/crashlytics-io.ts:15`):

```typescript
execFile(cmd, args, { timeout: apiTimeout, shell: true }, (err, stdout, stderr) => { ... });
```

With `shell: true` on Windows, a missing command is resolved by `cmd.exe`, which prints
`'gcloud' is not recognized…` to stderr and exits with a **numeric exit code (1 / 9009)** — it does
**not** raise a Node `ENOENT` spawn error. But `classifyGcloudError()`
(`src/modules/crashlytics/crashlytics-diagnostics.ts:33`) only recognizes a missing CLI via:

```typescript
if (code === 'ENOENT') {
  return { ...message: 'Google Cloud CLI not found in PATH', ... };
}
```

`code` here is `undefined` (no `ENOENT`), so it falls through to the generic branch
`gcloud check failed: ${msg}`. **The "not found in PATH" detection branch is effectively dead on
Windows whenever `shell: true` is used.** The same misclassification path also affects
`classifyTokenError()` for `getAccessToken()`'s `gcloud auth application-default print-access-token`
call, which is why the **token** error reads `Authentication failed: 'gcloud' is not recognized…`
instead of a "CLI not found" hint.

Net effect: the user is told auth failed, with no clear signal that the actual problem is "gcloud
isn't on PATH for this process — restart VS Code or set a service account key."

---

## Proposed Fix

### (a) Enable by default

Add `"crashlytics"` to the default adapters array in `package.json`:

```jsonc
"saropaLogCapture.integrations.adapters": {
  "default": [
    "packages", "git", "environment", "performance", "terminal",
    "flutterCrashLogs", "crashlytics"
  ]
}
```

> ⚠️ **Blast radius — needs sign-off before landing.** This flips a shipped default that every
> install inherits. Decide deliberately:
> - Crashlytics now shows for **all** workspaces, including non-Firebase ones. Confirm the sidebar
>   degrades gracefully (it does today via `setupChecklist` "setup" states), so a project with no
>   `google-services.json` shows a setup prompt, not an error spew.
> - It must **not** auto-run `gcloud`/network calls on activation for users who don't want it. Verify
>   the lookup is lazy (triggered by opening the panel / a related error), not on every session start.

### (b) Detection + classification + fallback

Three independent fixes, smallest first:

**B2a — Classify Windows "not recognized" as missing-CLI.**
In `classifyGcloudError()` / `classifyTokenError()`, in addition to `code === 'ENOENT'`, treat a
stderr/message containing `is not recognized` (Windows) or `command not found` (POSIX) as
`errorType: 'missing'` with the friendly "Google Cloud CLI not found in PATH — restart VS Code after
installing, or set a service account key" message.

**B2b — Resolve gcloud from known install locations when PATH lookup fails.**
Before declaring gcloud missing, probe well-known per-user install paths and use the absolute path if
present (then `shell: true` is no longer needed for that call):

- Windows: `%LOCALAPPDATA%\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd`,
  `%ProgramFiles(x86)%\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd`
- macOS/Linux: `~/google-cloud-sdk/bin/gcloud`, `/usr/local/bin/gcloud`, `/opt/homebrew/...`

This makes a freshly-installed gcloud work **without** requiring a full VS Code restart.

**B2c — Surface the service-account alternative prominently.**
The code already supports `saropaLogCapture.firebase.serviceAccountKeyPath`
(`src/modules/crashlytics/crashlytics-service-account.ts`). When gcloud is missing/unresolved, the
setup hint should point at this as the no-CLI path, especially for the `saropa-mobile` project.

### Immediate user workaround (no code change)

1. **Fully quit and reopen VS Code** (not "Reload Window") so the extension host inherits the updated
   PATH from the gcloud install. Verify in a *new* terminal: `gcloud --version`.
2. Authenticate: `gcloud auth application-default login`.
3. If PATH still won't cooperate, set `saropaLogCapture.firebase.serviceAccountKeyPath` to a service
   account JSON key (Crashlytics Viewer role) for project `saropa-mobile` — this bypasses gcloud
   entirely.

---

## Changes Made

Part (b) — connection reliability + real feedback (part (a) not yet implemented):

- **`src/modules/crashlytics/gcloud-locator.ts` (new)** — `findGcloudInKnownLocations()` probes the
  known install dirs (Windows: `%LOCALAPPDATA%`, Program Files, `~\google-cloud-sdk`; macOS/Linux:
  `/usr/local`, `/usr/lib`, Homebrew, `~`, snap). `resolveGcloudCmd()` returns the absolute path when
  present (robust to a stale PATH), else bare `gcloud`. Cached; `resetGcloudLocatorCache()` re-probes.
- **`crashlytics-io.ts`** — `runCmd` now quotes an executable path containing spaces (the `Cloud SDK`
  dir) since `shell: true` does not auto-quote the command.
- **`crashlytics-diagnostics.ts`** — new `isCommandMissing()` recognizes shell "is not recognized"
  (Windows) and "command not found" (POSIX) in addition to `ENOENT`; `classifyGcloudError` AND
  `classifyTokenError` now report a missing CLI instead of a generic/auth failure (B2a).
- **`firebase-crashlytics.ts`** — `isGcloudAvailable` and `getAccessToken` invoke `resolveGcloudCmd()`
  (B2b); `clearIssueListCache()` resets the locator cache; exports `getLastDiagnostic()`.
- **`crashlytics-connection-check.ts` (new)** — `runConnectionCheck()` validates gcloud/auth/config/api
  in order, each step carrying status + plain detail + a concrete fix; `formatConnectionReport()` for
  the output channel. Surfaced via a "Test connection" button in the wizard
  (`viewer-crashlytics-setup.ts`), a per-step report in-panel, the output channel, and a toast
  (`crashlytics-handlers.ts`, dispatched in `viewer-message-handler-panels.ts`).

Still TODO for this bug: **(a)** add `"crashlytics"` to `saropaLogCapture.integrations.adapters`
default (awaiting sign-off); **B2c** service-account prominence is partially addressed (the validator
treats a configured key as the gcloud-skip path and names the setting).

## Tests Added

`src/test/modules/crashlytics/crashlytics-connection-check.test.ts`:
- `classifyGcloudError`: Windows "is not recognized", POSIX "command not found", and `ENOENT` all →
  `errorType: 'missing'`; a timeout is NOT mislabeled as missing.
- `classifyTokenError`: the token-fetch "is not recognized" case (Craig's exact log) → step `gcloud`,
  `missing` (not `auth`); a genuine "no credentialed accounts" still → step `token`, `auth`.
- `formatConnectionReport`: renders per-step `[PASS]`/`[FAIL]`/`[SKIP]`, fix lines, and the
  CONNECTED / NOT CONNECTED header.

## Commits

<!-- Add commit hashes as fixes land. -->

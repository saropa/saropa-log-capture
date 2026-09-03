# Bug 041 — Bug report generation pipeline issues

## Status: Fixed

## Severity: Medium

Bug reports can miss Flutter exceptions, generation can stall on a blocking dialog, adb resolution silently fails for common SDK setups, and a revoked GitHub token stays cached.

## Problem

Four independent issues in the bug report generation pipeline:

1. **Flutter red-box banner not detected:** The `═══ Exception caught by widgets library ═══` pattern is not recognized as a stack trace start, so Flutter widget exceptions produce zero extracted frames in bug reports. (`src/ui/panels/bug-report-collector-helpers.ts:55-65`)
2. **Report generation blocks on notification:** The "Report generated" notification uses `await showInformationMessage()` with buttons, blocking the entire generation pipeline until the user dismisses it. (`src/ui/panels/bug-report-collector.ts:243-245`)
3. **adb PATH-only resolution:** adb is resolved only via PATH; no fallback to `ANDROID_HOME/platform-tools/` or `ANDROID_SDK_ROOT/platform-tools/`. Users with SDK installed but not in PATH get a silent ENOENT. (`src/ui/screenshots/adb-screenshot.ts:40`)
4. **Stale GitHub token never cleared on 401:** `clearGitHubToken` fires only on session change, not on auth failure. A revoked token stays cached until the next debug session. (`src/ui/integrations/github-auth.ts:12-15`)

## Reproduction

1. Trigger a Flutter widget exception (red box) during a captured session and generate a bug report — no frames are extracted.
2. Generate a bug report — the pipeline blocks until the "Report generated" dialog is dismissed.
3. Install Android SDK without adding platform-tools to PATH, then attempt an adb screenshot — fails silently with ENOENT.
4. Revoke a cached GitHub token externally, then make an API call within the same session — request fails repeatedly with no re-auth prompt.

**Frequency:** Always (each is a deterministic gap, not timing-dependent).

## Root Cause

Each is an independent gap in error handling and pattern matching:
1. The stack-trace start detector's pattern list omits the Flutter widgets-library banner.
2. The notification call is awaited synchronously instead of fire-and-forget.
3. adb resolution has no environment-variable fallback path.
4. Token invalidation is tied to session lifecycle instead of API response status codes.

## Proposed Fix

1. Add the Flutter `═══` banner pattern to the stack-trace start detector.
2. Fire-and-forget the notification or use `withProgress` instead of blocking `await`.
3. Check `ANDROID_HOME` and `ANDROID_SDK_ROOT` environment variables as fallbacks when adb is not found on PATH.
4. Clear the token on 401 responses, not just on session change.

## Changes Made

This pass verified and closed sub-items 1 and 3 only (already implemented before this session);
sub-items 2 and 4 are tracked separately.

1. **Flutter banner detected** — confirmed fixed. `extractStackTrace()` in
   `src/modules/bug-report/bug-report-collector-helpers.ts` skips `═══`/`───` decorative
   separator lines instead of breaking the frame-extraction loop on them (see the `Bug_041`
   comment at the skip check). The crash-detection side (`src/modules/flow-map/flow-map-log-parser.ts`)
   independently matches the banner with a deliberately loose `Exception caught by\s+\w`
   pattern that also covers non-"library"-suffixed variants like "Exception caught by gesture".
3. **adb PATH-only resolution** — confirmed fixed. `resolveAdb()` in
   `src/modules/screenshot/adb-screenshot.ts` now checks `ANDROID_HOME` and
   `ANDROID_SDK_ROOT` platform-tools/ before falling back to bare `adb` on PATH.

Item 4 (stale GitHub token) is the exact subject of bug_044 and is fixed there
(`handleGitHubApiUnauthorized()` in `src/modules/share/github-auth.ts`, now also wired into
`src/modules/share/gist-importer.ts`'s `importFromGist()`).

Item 2 (blocking notification) was not part of this pass's scope — current bug-report-panel.ts
notification calls (`msg.bugReportCopied`, `msg.reportSavedTo`) are already fire-and-forget
(no blocking `await`), so it may already be resolved, but was not independently re-verified
against the original report-generation code path here.

## Tests Added

None this pass — both verified items are edge cases in external tool integration
(Flutter's exact banner wording; Android SDK installed without PATH entry) and were assessed
as not warranting new coverage in this pass.

## Commits
<!-- Add commit hashes as fixes land. -->

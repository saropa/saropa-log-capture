# Bug 041 — Bug report generation pipeline issues

## Status: Open

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
<!-- Fill in when a fix is written. -->

## Tests Added
<!-- List new or updated test files. -->

## Commits
<!-- Add commit hashes as fixes land. -->

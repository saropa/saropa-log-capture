# Bug 030 — Signal false positives (resolved claims, build-noise bursts, stale ANR cache)

## Status: Open

## Severity: Medium

Signals panel produces misleading regression/burst/ANR signals during live sessions, eroding trust in the feature.

## Problem

Three independent sources of false positives in the Signals feature:

1. **False "Resolved" claims:** Error fingerprints are only written at session finalization. Opening the Signals panel during a live session passes empty `currentFingerprints`, so all recent errors are reported as "last seen N sessions ago" — up to 5 false "resolved" claims while the crash is actively occurring. (`src/modules/signals/regression-detector.ts:109-115`)
2. **Silence-then-burst on every cold start:** Gradle/Xcode build produces 30-90s of silence followed by app boot log flood. This is reported as "possible UI freeze" with HIGH confidence on every single build. Also fires MEDIUM every time the user idles 10s then taps the screen generating 20 log lines. (`viewer-root-cause-hints-embed-collect-bursts.ts:81-118`)
3. **ANR cache stale during live session:** ANR risk cache is keyed by file URI and cleared only on `sessionId` change. If an ANR appears 5 min into a session after the initial bundle, `undefined` is cached and never updated until the session is reopened. (`signal-host-collectors.ts:38-54`)

## Reproduction

1. Start a debug session, trigger a known recurring error, then open the Signals panel before the session ends.
2. Observe the error reported as "resolved" / "last seen N sessions ago" despite currently occurring.
3. Separately: start any Gradle/Xcode build and observe a HIGH-confidence "possible UI freeze" hint after boot log flood.
4. Separately: let a session run past its initial ANR bundle, trigger an ANR, and reopen the Signals panel without restarting the session — risk still shows stale/undefined.

**Frequency:** Always

## Root Cause

Signals feature assumes session-end data is available mid-session; the burst detector has no build-phase awareness; the ANR cache has no TTL and is only invalidated on session change.

## Proposed Fix

1. Write fingerprints incrementally during live sessions instead of only at finalization.
2. Add a build-phase detection heuristic (Gradle/Xcode output patterns) to suppress burst alerts during builds.
3. Add a TTL to the ANR cache, or invalidate it on new lines rather than only on `sessionId` change.

## Changes Made
<!-- Fill in when a fix is written. -->

## Tests Added
<!-- List new or updated test files. -->

## Commits
<!-- Add commit hashes as fixes land. -->

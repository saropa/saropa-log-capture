# Bug 030 — Signal false positives (resolved claims, build-noise bursts, stale ANR cache)

## Status: Fixed (pending review)

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

Sub-issue 1 (false "Resolved" claims) was already fixed in an earlier pass. This pass
covers sub-issues 2 and 3:

**2. Build-noise burst suppression** (`viewer-root-cause-hints-embed-collect-bursts.ts`):
Added `rchBuildNoiseRe`, a regex matching the stable markers Flutter/Gradle/Xcode print
around a build+launch cycle (`BUILD SUCCESSFUL`, `BUILD FAILED`, `Running Gradle task`,
`Gradle build`, `Xcode build done`, `Launching lib/main.dart`, `Installing build/`,
`Syncing files to device`, `> Task :`, `CocoaPods`, `Signing app bundle`,
`Debug service listening on`). Every line entering the F9 silence-burst window is now
tested against it; a `pendingBurst.buildNoise` flag is set the first time any line in
the accumulating burst matches, and every emission point (mid-loop silence-close,
window-exceeded close, end-of-call trailing flush) now additionally requires
`!pendingBurst.buildNoise` before pushing to `silenceBursts`. A burst that starts on or
passes through a build/launch marker line is suppressed outright rather than emitted
as a "possible UI freeze".

**3. Stale ANR cache** (`signal-host-collectors.ts`): `collectAnrRisk()` used to cache
keyed only on the file's URI, cleared solely on `sessionId` change — since the log file
keeps the same URI for the whole live session, an ANR appearing after the initial cache
fill was invisible until the session was reopened. The cache key is now
`` `${uriStr}|${stat.size}` ``, read via a cheap `vscode.workspace.fs.stat()` call before
the (expensive) full `readFile()` + `scanAnrRisk()` pass — any growth or truncation of
the file changes the byte size and invalidates the cache on the very next check, without
depending on a session-reset hook firing correctly.

## Tests Added

No new automated test — `collectBurstSignals()` is plain JS embedded via a TypeScript
template literal, exercised through the webview runtime like the rest of the root-cause
hint collectors. `collectAnrRisk()`'s cache-key change was verified by inspection
(stat-based key computation is a small, direct diff) and by `npx tsc --noEmit`
(0 errors) plus the full `npm run compile` gate chain passing.

## Commits
<!-- Add commit hashes as fixes land. -->

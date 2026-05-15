# Bug 001 — Dart Log Stack No Longer Uses `_StringStackTrace (...)` Wrapper

## Status: Fixed

## Problem

The Saropa Contacts project's central `debug()` helper (`lib/utils/_dev/debug.dart`) has stopped passing `stackTrace:` to `dart:developer.log()` and now appends the stack as plain text on the next line of the message body. This was done to remove the ugly `_StringStackTrace (#0 ... )` wrapper that VS Code's native debug console rendered around the structured envelope.

Saropa Log Capture's viewer carries explicit compensation for that wrapper format — see [viewer-data-add-stack-ingest.ts:22-30](../../../../src/ui/viewer/viewer-data-add-stack-ingest.ts):

```typescript
/* The bare ")" that closes Dart's "_StringStackTrace (#0  …  )" object dump
   carries no frame info. Without folding it into the active group it fails
   isStackFrameText(), hits the group-close path in addToData(), and renders
   as a junk ")" row after every trace. */
var isTraceTail = !!activeGroupHeader && /^\)$/.test(stripTags(html).trim());
```

After the upstream change, the contacts project no longer emits the wrapper. So:

1. The leading `_StringStackTrace (` line and trailing `)` line that the compensation handles will not appear in captured contacts logs.
2. The body-text stack ingestion path (`isStackFrameText()` matching `#N\s+caller (path:line:col)`) becomes the **sole** path for collapsing Dart stacks from this source.
3. The `_StringStackTrace`-wrapper compensation becomes dead code for this source — though it may still be exercised by other Dart projects that pass `stackTrace:` to `log()` directly.

```
// Old shape (still present in other Dart projects):
[log] message body
[log] _StringStackTrace (#0      Caller.method (package:proj/file.dart:42:9)
      #1      ...
      )

// New shape (contacts after fix):
[log] message body
#0      Caller.method (./lib/file.dart:42:9)
#1      ...
```

## Environment (if relevant)

- VS Code version: any
- Extension version: head of main as of 2026-05-15
- OS: Windows 11 (development), Android (target device)
- Debug adapter / language: Dart / Flutter

## Reproduction

1. Run the Saropa Contacts app (`d:\src\contacts`) on a debug device with the new [debug.dart](../../../../../contacts/lib/utils/_dev/debug.dart) change (`stackTrace:` no longer passed to `log()`, stack embedded in body).
2. Trigger any logged event that captures a stack — easiest is to deny location permission so `GeolocatorAndroid.getLastKnownPosition` raises `PermissionDeniedException`, which the debug helper logs at `DebugLevels.Error` with the full stack.
3. Open Saropa Log Capture's viewer on the resulting session log.
4. Inspect the stack rendering.

**Expected:**
- The stack is collapsed into a single header row with `N frames` badge.
- Expanding shows clickable `./lib/...:line:col` and `package:...:line:col` frames.
- No `_StringStackTrace (` prefix line, no orphan `)` line.
- Async-gap markers (`<asynchronous suspension>`) fold into the group correctly.

**Frequency:** Always (every Dart stack from the contacts project takes the new path).

## Root Cause

The fix here is verification, not a code defect. Two related concerns to confirm or fix:

1. **Body-text stack ingestion must still collapse correctly without the wrapper.** `tryIngestStackLine()` already keys off `isStackFrameText(html)` plus the active-group continuation rules, so unwrapped `#N` lines should be picked up. But the test suite ([viewer-stack-async-gap.test.ts](../../../../src/test/ui/viewer-stack-async-gap.test.ts) and the existing stack tests) was written against the wrapped format. Regression coverage needs a new fixture: a Dart trace with no leading `_StringStackTrace (` line and no trailing `)` line.

2. **The wrapper-compensation code (`isTraceTail` + `_StringStackTrace (` leading-line handling) should not be removed.** Other Dart projects, and other call sites within the contacts project that haven't been migrated to the body-embed pattern, may still emit the wrapped form via `dart:developer.log(stackTrace: x)`. The compensation must keep working for those — this is a coverage audit, not a removal.

3. **The contacts project's `replaceLocalPackagePath()`** rewrites `package:saropa/` to `./lib/` before embedding in the body. VS Code's URL pattern matcher recognises both. Confirm Saropa Log Capture's source-linker decoration matches both formats too — `./lib/...:line:col` is what the contacts viewer will now see, but other projects will still emit `package:...:line:col`.

## Changes Made

No production code change — verification only. The investigation confirmed:

1. **Body-text ingestion already handles unwrapped `#N` frames.** Production
   `isStackFrameText` in [viewer-script.ts:131-153](../../../../src/ui/viewer/viewer-script.ts#L131-L153)
   matches `^#\d+\s` (Dart) before any wrapper-specific check, so unwrapped
   frames flow through `tryIngestStackLine()` and group into a single header
   identically to the wrapped form.

2. **Wrapper compensation kept.** The `isTraceTail` branch in
   [viewer-data-add-stack-ingest.ts:23-30](../../../../src/ui/viewer/viewer-data-add-stack-ingest.ts#L23-L30)
   remains in place — other Dart projects and unmigrated call sites still emit
   `dart:developer.log(stackTrace:)` and the bare `)` closing line. Removing the
   compensation would regress those sources.

3. **Source linker accepts both Dart path shapes.** The regex in
   [source-linker.ts:26-27](../../../../src/modules/source/source-linker.ts#L26-L27) —
   `[\w./\\:~-]+\.(EXT_SET):` — already covers `./lib/foo.dart:42:9` (the new
   contacts shape) AND `package:proj/foo.dart:42:9` (other projects). A new test
   pins the `./lib/` shape so a future regex tightening can't silently break it.

## Tests Added

- [src/test/ui/viewer-stack-unwrapped-dart.test.ts](../../../../src/test/ui/viewer-stack-unwrapped-dart.test.ts)
  — three unwrapped `#N  Caller (./lib/...:line:col)` frames collapse into one
  stack-header; no orphan `)` row appears; an async-gap line between unwrapped
  frames keeps the trace as one group and stays excluded from `frameCount`.
- [src/test/modules/source/source-linker.test.ts](../../../../src/test/modules/source/source-linker.test.ts)
  — new "should linkify Dart workspace-relative `./lib/` path with line:col"
  test pins the click-to-source shape contacts now emits.
- Existing [src/test/ui/viewer-stack-async-gap.test.ts](../../../../src/test/ui/viewer-stack-async-gap.test.ts)
  "trace-tail `)` stack-group continuation" suite continues to cover the
  wrapped-form path so other Dart sources keep working.

## Upstream Reference

Saropa Contacts project change: `lib/utils/_dev/debug.dart` `_debugSync()` — `stackTrace:` parameter removed from the `log()` call, stack text appended to `consoleMessage` instead. Release builds embed only the first relevant frame via new `StackTraceExtensions.firstRelevantFrameAsStack()` helper. See contacts CHANGELOG.md entry under 2026-05-14 ("Killed the `_StringStackTrace (...)` wrapper that VS Code's debug console rendered…").

## Commits

<!-- Add commit hashes as fixes land. -->

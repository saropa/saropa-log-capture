# Bug 005 — Prefixless system_server Lines Escape the Device Tier Gate

## Status: Fixed

## Problem

When a log captures Android `system_server` / Zygote / boot output **without** the standard logcat `D/Tag(pid):` prefix (e.g. via `adb logcat -v raw`, tombstone dumps, or DAP-forwarded stderr), every line is mis-classified as `tier='flutter'`. The Device Logs tier filter (`warnplus` by default) cannot reach them, so a flood of system noise renders even when the user has narrowed their view.

Verbatim sample from the bug report:

```
--------- beginning of system
>>>>>> START com.android.internal.os.ZygoteInit uid 0 <<<<<<
Using default boot image
Leaving lock profiling enabled
begin preload
Memory class: 192
Forked child process 699
System server process 699 has been created
Slow operation: 188ms so far, now at startProcess: returned from zygote!
Process WebViewLoader-x86_64 (pid 998) has died: psvc PER
Override config changes=60007dfc {1.0 ?mcc0mnc [en_US] ...
```

## Environment

- VS Code version: any
- Extension version: 7.5.4 / Unreleased
- Source: Android `system_server` output, ZygoteInit boot path, ActivityManager/WindowManager diagnostics

## Reproduction

1. Capture a Flutter / Android session whose DAP includes prefixless system_server output (boot, tombstone, or `-v raw` logcat).
2. Open the log in the viewer with the default filter (Flutter DAP=all, Device=warnplus).
3. Observe: every prefixless system line still renders. Toggling Device → none has no effect on these lines.

**Frequency:** Always for any session that captures prefixless Android system output.

## Root Cause

`classifyLogLine()` in [src/modules/analysis/stack-parser.ts](src/modules/analysis/stack-parser.ts) only recognised two formats:

1. Logcat with prefix: `^[VDIWEF]\/(\S+?)(?:\(\d+\))?:`
2. Flutter launch boilerplate: `Connecting to VM Service…`, `Launching… in debug mode`, `✓ Built…`

For everything else it returned `undefined`. In `viewer-data-add.ts:43`, the fallback was:

```js
var lineTier = tier || (fw === true ? 'device-other'
    : (fw === false ? 'flutter'
    : (lineSource !== 'debug' ? 'external' : 'flutter')));
```

So `tier=undefined` + `fw=undefined` + `lineSource='debug'` → **`tier='flutter'`**. The comment at lines 36-42 acknowledges this default explicitly: it was chosen so that ordinary Flutter `print()` / `debugPrint()` output (no logcat prefix, not a stack frame, not launch boilerplate) would be controllable by the Flutter DAP radio. But that default is wrong for prefixless system_server output, which then escapes the Device gate.

`isTierHidden()` returns `false` early on `tier='flutter'` under `showFlutter='all'` (the default), so even the `warnplus` Device gate cannot reach these lines. The level filter still applies — but only when the user has narrowed levels; the default-all-levels view shows the full flood.

## Changes Made

### File 1: `src/modules/analysis/stack-parser.ts`

Added a new pattern set, `androidSystemPatterns`, recognising verbatim messages that the Android frameworks emit from system processes. Patterns are anchored at line start and target specific framework output: ZygoteInit boot banners, system_server lifecycle (`Forked child process`, `Process … has died`, `VM exiting`), boot preload / JCA init, ActivityManager diagnostics (`Slow operation:`, `Override config changes=`), service registration / receiver diagnostics, lmkd / freezer / display settings, and StatsPullAtomService probes.

`classifyLogLine()` now runs the new pattern set **after** the existing logcat tag and launch-boilerplate checks, so an explicit logcat prefix still wins (a hypothetical line that matches both keeps its tag-based classification — confirmed by regression test).

### File 2: `src/test/modules/analysis/classify-log-line.test.ts` (new)

Regression tests for every pattern above, plus a guard that ordinary user app output (`User loaded contact list…`, `My custom app log line`) still returns `undefined` and falls through to the Flutter-tier default. The logcat-prefix-wins regression is also covered (`I/flutter (1234): Forked child process 1` keeps its flutter classification).

## Trade-offs

This is pattern-based, not heuristic. The benefit is precision — false positives are limited to literal verbatim matches with framework output. The cost is maintenance: new Android versions or vendor builds may emit new system messages that aren't covered. When that happens, add a pattern and a test.

A previous draft considered an "inherit from previous line's tier" rule. Rejected because it risks mis-classifying legitimate user app output that happens to follow a system_server burst — exactly the case where the user most wants their print() output to remain visible under a narrow filter.

## Verification

- `npm run check-types`
- `npm run lint`
- New test file `classify-log-line.test.ts` covers every added pattern.
- Manual: load a log containing the verbatim sample from §Problem under the default filter; the system lines should all hide under `Device=warnplus`. Toggle Device to `all` to bring them back.

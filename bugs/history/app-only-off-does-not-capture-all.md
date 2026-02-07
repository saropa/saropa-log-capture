# Investigate: Missing System/Framework Logs Despite captureAll Enabled

## Status: Reclassified — Original bug invalid, underlying symptom needs investigation

## Summary
Users may observe that system and framework logs (e.g., Android logcat lines like `D/`, `I/`, `W/`, `V/`, `I/flutter`) are missing from the log file and viewer even with "App Only: OFF", despite those lines appearing in the VS Code Debug Console.

The original bug report incorrectly attributed this to missing backend `captureAll` logic. That logic already exists and works correctly. The actual root cause is likely external to this extension.

## What Was Verified (2026-02-06)

The `captureAll` mechanism is fully implemented:

- **Config:** `captureAll` defaults to `true` (`config.ts:152`, `package.json:442`)
- **Backend gate:** `session-manager.ts:91` skips category filtering when `captureAll` is true
- **UI ↔ backend:** "App Only" toggle sends `setCaptureAll` message to update the workspace setting (`viewer-stack-filter.ts:19` → `log-viewer-provider.ts:233`)
- **Exclusions:** always apply independently of `captureAll` (fixed — previously `captureAll: true` bypassed exclusions too), default to `[]`

## Likely Root Causes (to investigate)

### 1. DAP adapter not emitting all lines
The VS Code Debug Console can display output from sources other than DAP `output` events (e.g., adapter-internal logging, process stdout captured directly by VS Code). This extension only captures DAP `output` events via `DebugAdapterTracker.onDidSendMessage()` (`tracker.ts:44`). Lines that reach the Debug Console through other channels are invisible to the tracker.

**How to verify:** Enable `saropaLogCapture.verboseDap: true` and compare raw DAP traffic against what appears in the Debug Console. Any lines present in the console but absent from DAP events confirm this cause.

### 2. Debug adapter category mapping
Some adapters may use non-standard DAP categories (e.g., `'important'`, `'telemetry'`, custom strings). With `captureAll: false`, these would be filtered out unless added to the `categories` list. With `captureAll: true` (default), this is not an issue — but users who have explicitly set `captureAll: false` would hit this.

**How to verify:** Check the `categoryCounts` in the session footer stats to see which categories were actually received.

### 3. User-configured exclusion rules
If the user has `saropaLogCapture.exclusions` patterns that match system/framework log formats, those lines would be silently dropped even with `captureAll: true`.

**How to verify:** Check workspace settings for exclusion patterns.

## Steps to Reproduce (updated)
1. Start a Flutter/Dart debug session producing both app and system/framework logs
2. Confirm `saropaLogCapture.captureAll` is `true` (default)
3. Confirm `saropaLogCapture.exclusions` is empty
4. Enable `saropaLogCapture.verboseDap: true`
5. Compare Debug Console output against the log file — identify specific missing lines
6. Check the verbose DAP log for whether those lines appeared as output events

## Next Steps
- [ ] Reproduce with verbose DAP logging and identify whether missing lines are DAP output events
- [ ] If lines are not DAP events, document as a known limitation (DAP adapter behavior)
- [ ] If lines are DAP events with unexpected categories, consider logging unrecognized categories to the output channel for diagnostics

---
**Priority:** Low (backend capture logic is correct; symptom is likely external)
**Original date:** 2026-01-28
**Reclassified:** 2026-02-06

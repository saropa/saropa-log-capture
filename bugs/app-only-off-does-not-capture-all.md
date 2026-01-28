# Bug: "App Only: OFF" Does Not Capture All Debug Console Output

## Summary
When the "App Only" toggle is set to OFF in the Saropa Log Capture extension, the extension is expected to capture all Debug Console output (including system, framework, and app logs) to the log file and viewer. However, only application log lines (e.g., those matching the `[log]` format) are captured. System and framework logs (e.g., Android/Flutter logs) are missing from the log file and viewer, even though they are present in the Debug Console.

## Steps to Reproduce
1. Start a debug session for a Flutter/Dart app (or any app that produces both app and system logs).
2. In the Saropa Log Capture sidebar, ensure the "App Only" toggle is set to OFF ("App Only: OFF").
3. Observe the Debug Console: it contains both app logs (with `[log]` prefix) and system/framework logs (e.g., `D/`, `I/`, `W/`, `V/`, `I/flutter`, etc.).
4. Observe the Log Viewer and the generated log file in `reports/`: only app logs are present; system/framework logs are missing.

## Expected Behavior
- With "App Only: OFF", **all** output from the Debug Console should be captured and written to the log file and shown in the Log Viewer, including system, framework, and app logs.

## Actual Behavior
- Only application logs (matching the app's log format) are captured. System and framework logs are missing from the log file and viewer, even though they appear in the Debug Console.

## Technical Details
- The UI toggle for "App Only" is implemented in the viewer (client-side filtering), but the backend capture logic (`session-manager.ts`) always filters by `categories` (default: `['console', 'stdout', 'stderr']`) and applies exclusions, regardless of the UI toggle.
- There is no backend config or code path that disables all filtering and captures every line when "App Only: OFF".
- As a result, the log file and viewer never show the full Debug Console output, even when requested.

## Impact
- Users cannot capture a complete record of their debug session, which is critical for troubleshooting issues that involve system/framework logs.

## Suggested Fix
- Add a config property (e.g., `appOnlyMode` or `captureAll`) to the extension settings and config loader.
- Update the backend logic in `session-manager.ts` to skip category and exclusion filtering when "App Only: OFF".
- Ensure the UI toggle updates this config and triggers a reload or live update.

## Attachments
- Screenshot of Log Viewer showing only app logs
- Example Debug Console output with both app and system logs
- Example log file missing system logs

---
**Priority:** High (core feature broken)
**Environment:** Windows, VS Code, Saropa Log Capture latest
**Date:** 2026-01-28

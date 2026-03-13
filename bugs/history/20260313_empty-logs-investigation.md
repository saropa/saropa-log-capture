# Empty logs investigation (2026-03-13)

## Question
User reported logs still empty after parent-after-child fix. Asked to look at code from 18–24 hours ago to find what changed.

## Findings

### Refactor d3d8591 (Mar 12 16:55) — "modularize 6 files exceeding 300-line limit"
- **Did not change:** `src/modules/capture/tracker.ts`, `src/modules/session/session-manager.ts`, `src/modules/session/session-manager-events.ts`
- **Changed:** `extension-activation.ts` — moved inline block to `setupLineListeners()` in `activation-listeners.ts` and webview setup to `setupWebviewProviders()` in `activation-providers.ts`
- **Line listener logic:** Identical. `setupLineListeners({ sessionManager, broadcaster, historyProvider, inlineDecorations })` calls `sessionManager.addLineListener(...)` and `sessionManager.addSplitListener(...)` with the same callbacks that were previously inline.
- **Registration order:** Unchanged. Line listeners are still registered before `registerDebugAdapterTrackerFactory` and `registerDebugLifecycle`.

### Other recent changes to capture path
- **b1f613f (Mar 8):** Session-manager event logic extracted to `session-manager-events.ts` (pure extraction; behavior unchanged). This was already in place when the user’s 11:48 AM session worked.
- **cb74367 / f02d5ac:** Parent-after-child fix (reuse child’s LogSession when parent starts later) and later diagnostic/fallback.

### Conclusion
**No change in the capture pipeline (tracker → session-manager → processOutputEvent) was introduced in the refactor or in the 18–24 hour window.** Empty logs are not explained by a regression in this repo’s capture code. Likely causes remain: Flutter/Dart adapter session ordering or `parentSession` not set on child, or output not delivered via DAP (e.g. Cursor vs VS Code). The parent-after-child fix plus the 15s fallback (alias parent to single recent owner session) are the right mitigations; diagnostics were removed to avoid noise.

---

## Follow-up: Cursor v3.1.3 vs VS Code v3.3.0 (Mar 2026)

### Observed
- **Cursor v3.1.3:** Capture works (log content appears). Project Logs list is **missing** a log from ~1 hour ago.
- **VS Code v3.3.0:** Log file is created (header, ~2 KB) but **content area is empty** (only header lines).

### Fix: single-session output fallback
If output arrives for a session id we don’t have a log session for, but there is exactly one active log session, we now route that output to that session and write it. So a single open log file gets all output even when the adapter sends it under a different id. No user action required.

### Resolved by (code)
- Replay **all** early buffered output (every session id) into the first log session created, not only the "just started" session's buffer.
- Single-session fallback: when output arrives for an unknown session id and there is exactly one active log session, route it there.
- **Runbook:** `bugs/010_runbook-missing-or-empty-logs.md` (cause since v3.1.3, fixes, and diagnostic steps).

### If logs are still empty
Enable **`saropaLogCapture.diagnosticCapture`** and run a debug session; open the “Saropa Log Capture” output channel. “Routing output to single active session” = fallback applied. “Output buffered (no session yet)” = no session and not single-session case. “Output written to log” = write path taken. No lines = tracker not getting output.

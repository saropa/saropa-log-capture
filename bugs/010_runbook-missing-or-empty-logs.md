# Runbook: Missing or empty log files

## Why it may have stopped working since v3.1.3

**What changed in the capture path after 3.1.3**

- **3.1.3** – Only change was *modularization*: `extension-activation.ts` was split into `activation-listeners.ts` and `activation-providers.ts`. Tracker and session-manager code were not modified, but the order and timing of registration and event handling can differ.
- **3.2.1** – Parent-after-child logic was added (reuse child’s log session when parent starts after child; fallback when child has no `parentSession`).

**Most likely explanation**

In 3.1.3, the refactor likely changed **when** things run (e.g. when the DAP tracker is registered vs when `onDidStartDebugSession` runs, or when output events are delivered). So:

- **Before:** Output often arrived after a log session already existed and under the same session id → it was written and logs looked fine.
- **After:** Output sometimes arrives **before** any session exists, or under a **different** session id than the one we created the session for. We either buffered it and only replayed the buffer for the session that had “just started” (so other ids were never replayed), or we had no session for that id and dropped it. Result: missing or empty logs.

So the regression is probably **timing + session id mismatch**: the 3.1.3 refactor didn’t change capture logic but changed execution order so that “early output under a different id” became common, and we didn’t handle that until the recent fixes (replay all early output, single-session fallback).

**3.2.1** only added parent/child merging; it didn’t fix the “early output under different id” case, which is what the replay-all and single-session fallback address.

---

## What we fixed (code)

1. **Early output under a different session id**  
   Output that arrives before any log session exists is buffered. We now replay **all** buffered output (every session id) into the first log session we create, so nothing is dropped when the adapter sends output under a different id than the one we started the session for.

2. **Output under unknown session id when one session exists**  
   If output arrives for a session id we don’t have a log for, but there is exactly one active log session, we route that output to that session and write it.

3. **Race guard:** If we're about to create a new session but one was created in the last 3s, we alias to it so we don't create two files (one empty).

So: one log file should get all output even when the adapter or host uses different session ids, ordering, or a parent/child race.

## If the file appears in Project Logs but is empty when you open it

Debug Console has output but the open log shows only a header (or nothing): often a **second log file** was created and output went to the other one. The race guard (above) reduces this. After updating, if it still happens: enable **`diagnosticCapture`** (step 2 below) and run again; look for "new log session created" twice — that means two sessions were created. One will have content; use **Prev/Next** in the viewer to switch to the other log.

## If you still get missing or empty logs

1. **Confirm capture is on**  
   Settings: `saropaLogCapture.enabled` is `true`. No point debugging if it’s off.

2. **See what the pipeline is doing**  
   Set `saropaLogCapture.diagnosticCapture` to `true`, run a debug session, then open **Output → Saropa Log Capture**:
   - **"replaying N early event(s) from sessionId=X into log"** — early output was buffered under another id and is now being replayed into the log.
   - **"routing output to single active session"** — output was for an unknown id and was routed to the single open session.
   - **"output written to log sessionId=…"** — output is being written.
   - **"output buffered (no session yet)"** and you never see a session created — session never started (e.g. capture disabled, or `initializeSession` returned undefined).
   - **No capture lines at all** — the DAP tracker is not receiving output (adapter or host not sending output events to the tracker).

3. **Check the log directory**  
   Logs are under the project (e.g. `reports/YYYYMMDD/` in the workspace). Use **Project Logs → Browse…** to open that folder and confirm whether the file exists and has content. If the file exists and has content but the list doesn’t show it, use **Refresh** or report a list/discovery bug.

4. **One workspace = one log directory**  
   The list shows sessions from the current workspace’s log directory. Same project open in any IDE = same folder = same files.

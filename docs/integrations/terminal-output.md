# Integration: Terminal Output

## Problem and Goal

Developers often run **builds, scripts, or servers** in the **Integrated Terminal** while debugging. The Debug Console shows the debuggee’s stdout/stderr, but terminal output (e.g. `npm run build`, `dotnet run`, or a backend process started in a terminal) is separate. When something goes wrong, correlating "what the terminal said" with "what the debugger said" requires flipping between tabs and copying by hand. This integration captures **Integrated Terminal output** for the same time window as the debug session (or for selected terminals) and stores it alongside the Debug Console log—as a sidecar, a second tab in the viewer, or an interleaved timeline—so that one session artifact contains both streams.

**Goal:** Optionally **capture terminal output** during an active debug session: (1) **Which terminals:** All terminals, or only the one(s) the user marks as "capture" (e.g. via a command or by naming). (2) **Storage:** Write terminal output to a **sidecar file** (e.g. `basename.terminal.log`) or to a **second "source"** in the same log file (with a source prefix like `[terminal]`). (3) **Viewer:** Show terminal output in a separate tab or in a unified view with Debug so that both streams are visible and searchable together.

---

## Data Sources

| Source | Content | API |
|--------|---------|-----|
| **Integrated Terminal** | stdout/stderr of shell and child processes in that terminal | VS Code: `vscode.window.onDidWriteTerminalData` (or terminal API for content) |
| **Terminal selection** | Only specific terminals (e.g. "Terminal 1") | User runs "Start capturing this terminal" or we capture all visible |

VS Code exposes **Terminal** and **TerminalDataWriteEvent** (or similar). We can subscribe to write events for a given terminal and buffer the data. On session end, flush to sidecar. Challenge: **which terminal(s)?** Options: (a) capture all terminals, (b) capture the "active" terminal when session starts, (c) user explicitly "Link terminal to session" so we only capture that one. (b) or (c) reduce noise.

---

## Integration Approach

### 1. When to capture

- **Session start:** If `saropaLogCapture.terminal.captureEnabled`, subscribe to terminal write events. Option A: subscribe to **all** terminals (vscode.window.terminals). Option B: subscribe only to the **currently focused** terminal at session start. Option C: user runs "Saropa Log Capture: Capture this terminal" before or after starting debug; we remember that terminal and only capture it.
- **Session end:** Unsubscribe; write buffered content to sidecar `basename.terminal.log` (or one file per terminal: `basename.terminal-1.log`). If we capture multiple terminals, either merge with source prefix `[Terminal 1]` or separate files.

### 2. Storage

- **Sidecar:** `basename.terminal.log`. Each line optionally prefixed with `[HH:MM:SS] ` (timestamp when we received the chunk). Content: raw text (UTF-8). No ANSI stripping by default (preserve colors if we ever render in viewer with ANSI).
- **Alternative:** Append to main log with a distinct category like `[terminal]` so that a single file has both debug and terminal lines. Then we need to interleave by time; terminal write events may not have high-resolution timestamps—use "received at" time. Single file is simpler for "one session = one file" but mixes sources; sidecar keeps Debug and Terminal separate and is easier to implement.

**Recommended:** Sidecar `basename.terminal.log`; viewer has tab "Terminal" that loads this file (same as External logs).

### 3. Viewer

- When sidecar exists, show "Terminal" tab; content from sidecar. Same virtual scroll and search as main log. Optional: "Unified" view that interleaves by timestamp (if we add timestamps to terminal lines); more complex.

---

## User Experience

### Settings (under `saropaLogCapture.terminal.*`)

| Setting | Type | Default | Description |
|--------|------|--------|-------------|
| `captureEnabled` | boolean | `false` | Capture terminal output during debug session |
| `whichTerminals` | `"all"` \| `"active"` \| `"linked"` | `"active"` | All terminals, or only active at session start, or only user-linked |
| `writeSidecar` | boolean | `true` | Write terminal output to sidecar file |
| `prefixTimestamp` | boolean | `true` | Prefix each line with [HH:MM:SS.mmm] (receive time) |
| `maxLines` | number | `50000` | Cap lines per terminal (drop oldest) |
| `preserveAnsi` | boolean | `true` | Do not strip ANSI codes in sidecar (viewer can render later) |

### Commands

- **"Saropa Log Capture: Capture this terminal"** — Mark current terminal as "linked" to the next/current session (when `whichTerminals` is `linked`).
- **"Saropa Log Capture: Stop capturing this terminal"** — Unlink.
- **"Saropa Log Capture: Open terminal log for this session"** — Open sidecar terminal log in editor or viewer tab.

### UI

- **Viewer:** Tab "Terminal" when `basename.terminal.log` exists; load and display.
- **Status bar:** "Capturing terminal" when capture is active and session is recording.

---

## Implementation Outline

### Components

1. **Terminal API usage**
   - VS Code: `vscode.window.terminals`; each terminal has `name`, and we can listen to **onDidWriteTerminalData** (or equivalent—check VS Code API for exact name). Event gives terminal and data string. Append to buffer for that terminal.
   - **Which terminal:** If "active," at session start get `vscode.window.activeTerminal` and subscribe only to that; if it closes, we can stop or switch to "all" for the rest. If "linked," maintain a Set of terminal IDs that user linked; subscribe only to those.

2. **Buffering**
   - Map terminalId → string[] (or one big string). On write, split by newlines (and handle partial lines); append. Respect `maxLines` (per terminal or total). Optionally prefix each line with current time (Date.now()) when we receive the chunk.

3. **Session lifecycle**
   - On session start: if captureEnabled, subscribe to terminal write events for the chosen terminals; create buffers. On session end: flush buffers to sidecar(s); unsubscribe.
   - **Session folder/base name:** We know these when the session is created; pass to the terminal capture module so it knows where to write.

4. **Sidecar write**
   - Same folder as log file; name `basename.terminal.log`. If multiple terminals and we want one file, merge with `[Terminal: name]` prefix per line. If one file per terminal: `basename.terminal-<name>.log` (sanitize name).

5. **Viewer**
   - Detect sidecar(s); add Terminal tab; load content (read file, send to webview). Reuse same rendering as main log (virtual scroll, ANSI if preserveAnsi).

### Edge cases

- **Terminal created after session start:** If "all," subscribe to new terminals (onDidOpenTerminal) and add to capture. If "active" or "linked," ignore new terminals.
- **Terminal closed:** Remove from buffers; if it was the only one, we still write what we have.
- **Encoding:** Terminal data is often UTF-8; handle replacement character for invalid.

---

## Configuration Summary

- **Extension settings:** `saropaLogCapture.terminal.*` as above.
- **VS Code API:** Verify exact event names for terminal write (e.g. `TerminalDataWriteEvent` or `onDidWriteTerminalData`).

---

## Risks and Alternatives

| Risk | Mitigation |
|------|------------|
| High volume (e.g. tail -f) | Cap maxLines; optional "pause capture" |
| Many terminals | "Active" or "linked" to limit; or cap to first N |
| API differences across VS Code versions | Check minimal version; document |

**Alternatives:**

- **Deferred:** See `docs/deferred/TERMINAL_OUTPUT_CAPTURE.md` if it exists; align with that.
- **Unified log:** Single file with [debug] and [terminal] lines interleaved by time; requires timestamp on every line and merge logic.

---

## References

- VS Code Terminal API: [Terminal](https://code.visualstudio.com/api/references/vscode-api#Terminal), [onDidWriteTerminalData](https://code.visualstudio.com/api/references/vscode-api#window) (or equivalent).
- Existing: application-file-logs (sidecar, viewer tab), log viewer (tabs, virtual scroll).

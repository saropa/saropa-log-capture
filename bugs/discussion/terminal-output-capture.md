# Terminal Output Capture — Feasibility Report

## Request

> Can we also capture terminal output? VS Code can spawn multiple terminals.

Currently Saropa Log Capture intercepts **Debug Console** output via the Debug Adapter Protocol (DAP). Users have asked whether the same capture pipeline could be extended to VS Code's integrated terminal(s).

---

## Why Debug Console Capture Works So Well

The extension's capture architecture depends on a clean, structured API:

```
Debug Adapter → DAP `output` event (structured JSON)
    → SaropaTracker.onDidSendMessage()
    → SessionManager.onOutputEvent(sessionId, body)
    → LogSession.appendLine(text, category, timestamp, source)
    → Disk + webview
```

Every debug adapter (Dart, Node, Python, C++, Go, etc.) sends output through the same protocol. The `output` event carries typed fields: `text`, `category`, `source`, `line`, `column`. This is a **first-class, stable VS Code API** — `vscode.debug.registerDebugAdapterTrackerFactory()` — designed for exactly this purpose.

---

## VS Code Terminal APIs — Current State (February 2026)

### Available Stable APIs

| API | What It Does | Captures Output? |
|-----|-------------|-----------------|
| `window.createTerminal()` | Create terminals programmatically | No |
| `window.terminals` | List active terminals | No |
| `window.onDidOpenTerminal` | Fires when a terminal opens | No |
| `window.onDidCloseTerminal` | Fires when a terminal closes | No |
| `window.onDidChangeActiveTerminal` | Fires on terminal focus change | No |
| `Terminal.sendText()` | Send text/commands to a terminal | No (write-only) |
| `Terminal.shellIntegration` | Shell integration state | Partial — see below |
| `window.onDidStartTerminalShellExecution` | Fires when a command starts | No output data |
| `window.onDidEndTerminalShellExecution` | Fires when a command ends | Exit code only |
| `TerminalShellExecution.read()` | AsyncIterable of command output | **Yes, but limited** |

### The Shell Integration Path (`TerminalShellExecution.read()`)

This is the closest thing to terminal output capture in the stable API. It works like this:

```typescript
window.onDidEndTerminalShellExecution(event => {
    const stream = event.execution.read();
    for await (const chunk of stream) {
        // chunk is a string of terminal output
    }
});
```

**Limitations:**

1. **Only works when shell integration is active** — requires the shell to have VS Code's shell integration script running. Quality levels vary: `Rich`, `Basic`, or `None`. If `None`, no data is available.
2. **Unreliable data** — [known issues](https://github.com/microsoft/vscode/issues/242897) with inconsistent output even for the same command executed repeatedly.
3. **Per-command granularity only** — captures output of discrete commands, not continuous streams. A long-running process (e.g., `npm start`, `flutter run`) that produces output over time does not fit this model cleanly.
4. **Not available for all terminal types** — custom terminal profiles, remote SSH terminals, and some shells may not support integration.
5. **No historical data** — can only capture output from the moment the listener is registered; no access to prior terminal buffer content.

### APIs That Will NOT Become Stable

| API | Status | Why |
|-----|--------|-----|
| `window.onDidWriteTerminalData` | [Proposed only — will never be stabilized](https://github.com/microsoft/vscode/issues/83224) | VS Code team explicitly rejected this. Listening to one terminal requires routing **all** terminal data through the extension host, causing performance degradation across the entire editor. |
| Raw terminal buffer access | [Explicitly rejected](https://github.com/microsoft/vscode/issues/190941) | "Raw buffer access is unlikely to happen as there are performance problems with that." |
| `Terminal.onDidWriteData` (per-terminal) | Proposed only | Same performance architecture issue as the global event. |

### The `onDidWriteTerminalData` Rejection in Detail

From the VS Code team (Daniel Imms, terminal maintainer):

> "The current plan is for it not to go stable."

The technical reason: terminal rendering happens in a dedicated process for performance. Routing raw PTY data to the extension host means serializing every byte written to any terminal — including ANSI escape sequences for cursor movement, clearing, colors, and re-rendering. This would degrade VS Code's perceived responsiveness for all users, even those not using extensions that consume the data.

The team also rejected compromise proposals (opt-in warning labels, "unsafe API" designations) because any availability would encourage adoption, leading to ecosystem-wide performance regression.

---

## Fundamental Differences: Debug Console vs Terminal

| Aspect | Debug Console | Terminal |
|--------|--------------|---------|
| **Data format** | Structured JSON (DAP `output` event) | Raw PTY byte stream |
| **Content** | Application output only | Output + escape codes + cursor movement + line editing + prompt rendering |
| **Multiplexing** | One debug session = one stream | Multiple terminals, each with independent state |
| **API design** | Clean event-based subscription | No stable read API for passive observation |
| **Performance model** | Low-volume, structured | High-volume, unstructured, real-time rendering |
| **Source attribution** | Category, source file, line number | None — raw text only |

---

## What Other Extensions Do

### Terminal Capture (devwright.vscode-terminal-capture)

Uses the **proposed** `onDidWriteTerminalData` API. Consequences:
- Cannot be published on the VS Code Marketplace through normal channels
- Requires users to run VS Code **Insiders** builds
- Must declare `enableProposedApi` in `package.json`
- Could break at any VS Code update with no notice
- Limited adoption ceiling

### Cline / Roo Code (AI coding assistants)

Use `TerminalShellExecution.read()` for capturing output of commands they initiate via `Terminal.sendText()`. This works because:
- They control which commands are executed
- They only need the output of their own commands
- They can tolerate occasional missed output

This is fundamentally different from passive capture of all terminal activity.

---

## Possible Approaches (With Trade-Offs)

### 1. Shell Integration Capture (Stable API)

**How:** Listen to `onDidEndTerminalShellExecution`, read output via `execution.read()`.

| Pro | Con |
|-----|-----|
| Uses stable API | Only captures discrete commands, not streaming output |
| Can be published to Marketplace | Shell integration must be active (not guaranteed) |
| Per-command granularity | [Unreliable data delivery](https://github.com/microsoft/vscode/issues/242897) |
| No performance concerns | Misses output from long-running processes |
| | No source attribution (file, line) |
| | Cannot capture output that occurred before listener registration |

**Verdict:** Partially viable for command-oriented workflows (run a command, see its output). Not suitable for continuous capture of build servers, watchers, or long-running processes. The unreliability issue is a significant concern for a tool whose core promise is "never lose data."

### 2. Proposed API (`onDidWriteTerminalData`)

**How:** Declare `enableProposedApi`, use the unstable event.

| Pro | Con |
|-----|-----|
| Captures all terminal output | Cannot publish to Marketplace |
| Real-time, low-latency | Requires VS Code Insiders |
| Covers all terminal types | Could break at any update |
| | Performance impact on all terminals |
| | Violates extension distribution model |

**Verdict:** Not viable for a published extension. Would fragment the user base and undermine trust.

### 3. Log File Tailing

**How:** Watch specific log files on disk that terminal commands write to (e.g., `flutter run > output.log`).

| Pro | Con |
|-----|-----|
| Works with any tool | Requires user to redirect output |
| Reliable, simple | Not automatic — violates "zero friction" principle |
| No API dependency | Only captures file-redirected output |
| Could use `vscode.workspace.createFileSystemWatcher()` | Misses interactive terminal sessions |

**Verdict:** Viable as an opt-in "watch file" feature, but does not solve the core request of capturing terminal output transparently.

### 4. Extension-Spawned Terminals

**How:** Provide a "Captured Terminal" command that creates a terminal the extension controls.

| Pro | Con |
|-----|-----|
| Full control over the terminal | Users must use the extension's terminal |
| Can use `Terminal.sendText()` + `execution.read()` | Doesn't capture existing terminals |
| Clean integration | Awkward UX — "use our terminal instead" |

**Verdict:** Too much friction. Users already have their terminal setup; asking them to switch defeats the purpose.

### 5. Wait for VS Code API Evolution

**How:** Monitor VS Code's API roadmap for stable terminal content access.

The VS Code team has hinted at [command-based content retrieval](https://github.com/microsoft/vscode/issues/190941) (#145234) as a future direction, but there is no timeline. The terminal selection API (#188173) may also open doors to reading selected text programmatically.

| Pro | Con |
|-----|-----|
| Clean, supported solution | No timeline — could be months or years |
| No workarounds or fragility | May never arrive in a form suitable for passive capture |

**Verdict:** The safest long-term bet, but not actionable today.

---

## Impact on Current Architecture

If terminal capture did become feasible, the existing architecture is well-positioned to absorb it:

```
Terminal Source → normalize to LineData shape
    → SessionManager.onOutputEvent(pseudoSessionId, body)
    → existing filtering, dedup, file writing, UI broadcasting
```

The `SessionManager` doesn't care about the source of events, only their shape (`text`, `category`, `timestamp`). A terminal capture module would:

1. Create a "terminal tracker" analogous to `SaropaTracker`
2. Normalize terminal output into `DapOutputBody`-like objects
3. Feed them through the existing pipeline with a pseudo-session ID (e.g., `terminal:Bash-1`)
4. Reuse all existing dedup, watch patterns, file writing, and viewer rendering

The main new challenges would be:
- **Session lifecycle** — terminals don't have clean start/stop like debug sessions
- **Category mapping** — no `stdout`/`stderr`/`console` distinction from raw PTY data
- **Volume** — terminals can produce far more output than debug consoles (builds, log tailing)
- **Noise** — ANSI escape sequences for cursor movement and screen clearing are not meaningful log content

---

## Recommendation

**Status: Blocked on VS Code API.**

The extension should not pursue terminal capture at this time because:

1. **No stable API exists** for passively reading terminal output
2. **The VS Code team has explicitly rejected** the most obvious API (`onDidWriteTerminalData`) for performance reasons
3. **Shell integration capture** is too unreliable and limited for a tool that promises data integrity
4. **Using proposed APIs** would prevent Marketplace publication and fragment the user base

### Suggested Actions

1. **Track VS Code issue [#145234](https://github.com/microsoft/vscode/issues/190941)** for command-based content retrieval — this is the most likely path to stable terminal access
2. **Track the [shell integration reliability improvements](https://github.com/microsoft/vscode/issues/242897)** — if `execution.read()` becomes reliable, the per-command capture approach could be offered as an opt-in feature
3. **Consider a "watch log file" feature** as an intermediate solution — users redirect terminal output to a file, the extension tails it. This is a well-understood pattern and could be implemented with `vscode.workspace.createFileSystemWatcher()`
4. **Revisit annually** — the VS Code terminal API is actively evolving; what's impossible today may be straightforward in a future release

---

## References

- [onDidWriteTerminalData will not go stable — VS Code #83224](https://github.com/microsoft/vscode/issues/83224)
- [API access to terminal output — VS Code #190941](https://github.com/microsoft/vscode/issues/190941)
- [Shell integration executeCommand reliability — VS Code #242897](https://github.com/microsoft/vscode/issues/242897)
- [Terminal Shell Integration documentation](https://code.visualstudio.com/docs/terminal/shell-integration)
- [VS Code Extension API reference](https://code.visualstudio.com/api/references/vscode-api)
- [Terminal API examples — Tyriar/vscode-terminal-api-example](https://github.com/Tyriar/vscode-terminal-api-example)
- [Terminal Capture extension (proposed API)](https://marketplace.visualstudio.com/items?itemName=devwright.vscode-terminal-capture)
- [Allow extensions to access all terminals — VS Code #13267](https://github.com/microsoft/vscode/issues/13267)

# Integration: Browser and DevTools

## Problem and Goal

When debugging **web applications**, the failure picture often spans two places: the **Debug Console** (e.g. Node backend or test runner) and the **browser** (console errors, network failures, DOM issues). Developers switch between VS Code and the browser DevTools to correlate "backend said X" with "frontend threw Y." This integration allows **correlating browser console and network activity** with the captured debug log—by capturing browser logs (via Chrome DevTools Protocol or a companion extension) and attaching them to the session as a sidecar or a second timeline, so that one place shows both backend and frontend context.

**Goal:** (1) **Capture browser console:** When the user is debugging a scenario that involves a browser (e.g. Puppeteer, Playwright, or manual testing with a "debug build" that connects to the extension), capture **console.log/error/warn** and optionally **network requests** from the browser and store them alongside the Debug Console log. (2) **Correlation:** Match by **timestamp** or by **correlation ID** (if the app injects a request ID into both backend logs and frontend). (3) **Viewer:** Show "Browser" tab or panel with browser console + optional network list; optionally interleave with main log by time. Implementation can be **CDP-based** (extension talks to browser via Chrome DevTools Protocol) or **companion browser extension** that posts logs to the VS Code extension.

---

## Data Sources

| Source | Data | How to get it |
|--------|------|---------------|
| **Chrome DevTools Protocol (CDP)** | Console messages, Network events, Runtime exceptions | Launch or attach to Chrome with remote-debugging-port; connect via WebSocket; subscribe to Console and Network domains |
| **Playwright / Puppeteer** | Already in process; can expose CDP or log to stdout | Test runner may log browser console to stdout (then it’s already in Debug Console). Or test script forwards CDP events to a file/socket that extension reads |
| **Browser extension** | Console + network (if extension has access) | Companion extension in browser sends messages to VS Code (e.g. via WebSocket or file watch). VS Code extension reads and stores |
| **HAR from browser** | Export HAR from DevTools | User exports HAR after session; attach to session (see HTTP/Network integration). No live capture |

**Recommended v1:** (1) **File-based handoff:** App or test script (e.g. Playwright) writes browser console and optional network events to a **file** (JSON lines or one JSON array) in a known path; extension tails or reads at session end and attaches as sidecar. No CDP in extension host for v1 (avoids Chrome dependency and connection management). (2) **Optional CDP client:** If user configures "Chrome remote debugging URL," extension could connect and subscribe to Console domain and write to sidecar; more powerful but more complex and Chrome-specific.

---

## Integration Approach

### 1. Modes

- **Mode A — File:** User or test framework writes `browser-console.jsonl` (or similar) to workspace path. Each line: `{ time, level, text, url?, stack? }`. Extension reads/tails and at session end writes `basename.browser.log` or `basename.browser.json`. Viewer shows "Browser" tab.
- **Mode B — CDP:** User launches Chrome with `--remote-debugging-port=9222` (or Playwright does). Extension connects to `ws://localhost:9222/...`, subscribes to `Console.messageAdded` and optionally `Network.requestWillBeSent`/`responseReceived`, and writes events to sidecar. Requires WebSocket client and CDP message handling in extension.
- **Mode C — Companion extension:** A small browser extension (Chrome/Edge) captures console and sends to a local server or writes to a file that VS Code watches. VS Code extension only reads the file (same as Mode A).

**Recommended first:** Mode A (file). Document format so that Playwright/Puppeteer or a small script can write it. Later: Mode B for users who run Chrome with remote debugging.

### 2. Storage and display

- **Sidecar:** `basename.browser.log` (text, one log entry per line with prefix) or `basename.browser.json` (array of events). Include: timestamp, level (log/info/warn/error), text, optional url and stack.
- **Viewer:** "Browser" tab: list of console events; optional filter by level. If we have network events, second subsection or separate "Browser network" (or link to HTTP/Network integration).
- **Correlation:** If events have timestamps, viewer can show "Backend" and "Browser" side by side with same time axis; or single interleaved view (advanced).

### 3. Correlation ID

- If app logs a shared ID in both backend and frontend (e.g. request ID in HTTP header and in backend log), we can match "this backend line" to "this browser request/console line" (see HTTP/Network and Database integrations). Document pattern for users.

---

## User Experience

### Settings (under `saropaLogCapture.browser.*`)

| Setting | Type | Default | Description |
|--------|------|--------|-------------|
| `enabled` | boolean | `false` | Enable browser console/network capture |
| `mode` | `"file"` \| `"cdp"` | `"file"` | File-based or CDP live capture |
| `browserLogPath` | string | `""` | Path to browser console log file (Mode A); relative to workspace |
| `browserLogFormat` | `"jsonl"` \| `"json"` | `"jsonl"` | One JSON object per line or single JSON array |
| `cdpUrl` | string | `""` | Chrome remote debugging WebSocket URL (Mode B); e.g. from launch config |
| `includeNetwork` | boolean | `false` | Include network events (Mode B) or separate network file (Mode A) |
| `maxEvents` | number | `10000` | Cap browser events per session |

### Commands

- **"Saropa Log Capture: Attach browser log"** — Pick a file (e.g. exported browser console); attach to current session as sidecar.
- **"Saropa Log Capture: Open browser log for this session"** — Open sidecar in viewer or editor.

### UI

- **Viewer:** "Browser" tab when sidecar exists; show console events with level and text; optional time alignment with main log.

---

## Implementation Outline

### Components

1. **File reader (Mode A)**
   - Same as external log / request log: at session start, if path set, tail `browserLogPath`; at session end read or flush buffer to `basename.browser.json`. Parse JSONL or JSON; validate shape; cap at maxEvents.
   - **Schema:** `{ time: string (ISO), level: string, text: string, url?: string, stack?: string }`. Optional: `requestId` for correlation.

2. **CDP client (Mode B, optional)**
   - Use `ws` package or Node built-in to connect to `cdpUrl`. Send CDP commands: `Console.enable`, `Runtime.enable`; subscribe to `Console.messageAdded`. Map to same schema. Optional: `Network.enable`, subscribe to request/response, map to request list (see HTTP integration). Write events to same sidecar format. Handle disconnect (browser closed); stop capture and flush.
   - **Discovery:** If cdpUrl is empty but "Chrome with debugging" is common, could try to discover from launch config (e.g. `runtimeArgs: ["--remote-debugging-port=9222"]`) and connect to first page. Document.

3. **Viewer**
   - Load `basename.browser.json`; render as list (time, level, text); use same virtual scroll component. Optional: link to main log by time or requestId (highlight line in main log when browser event selected).

4. **Session lifecycle**
   - On start: if file mode, start tailing; if CDP, connect and subscribe. On end: flush to sidecar; disconnect CDP.

### Security

- CDP connection is localhost only; document. File path is workspace-relative. No sensitive data in extension logs; browser console may contain PII—document.

---

## Configuration Summary

- **Extension settings:** `saropaLogCapture.browser.*` as above.
- **File format:** Document JSONL schema for test frameworks and scripts.

---

## Risks and Alternatives

| Risk | Mitigation |
|------|------------|
| CDP version differences | Pin to supported Chrome version; document |
| High volume | maxEvents; optional sampling |
| No browser in scenario | Feature no-op when not used |

**Alternatives:**

- **Playwright trace:** Playwright can save trace; we could attach trace file and link "Open trace" (no parsing inside extension).
- **HAR only:** Rely on HAR for network; browser console only via file or CDP.

---

## References

- Chrome DevTools Protocol: [Console domain](https://chromedevtools.github.io/devtools-protocol/tot/Console/)
- Existing: application-file-logs (tail), http-network (request list), terminal-output (second tab).

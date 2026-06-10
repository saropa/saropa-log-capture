# Spec: Browser Companion Extension (Mode C)

**Adapter id:** `browser` (shared with existing file/cdp modes)
**Status:** Not implemented
**Full design:** TBD — not yet created

## Goal

A browser extension (Chrome/Edge) captures console events and posts them to a local server or file that VS Code watches. Functionally equivalent to file mode once events land on disk.

## Background

The browser integration already supports two capture modes:
- **file** — reads an exported browser log at session end
- **cdp** — connects via WebSocket to Chrome DevTools Protocol during the session

Mode C adds a third path: a lightweight companion browser extension that writes console events to a known file path, eliminating the need for manual export (file mode) or `--remote-debugging-port` flags (cdp mode).

## Implementation (sketch)

- **Browser extension:** Manifest V3; listens to `console.*` via content script or background service worker; batches events and writes to a configurable local file path (JSONL format matching the existing `BrowserEvent` schema).
- **VS Code side:** Reuse the existing file-mode provider — the companion extension's output file is the `browserLogPath`. No new VS Code code needed beyond documentation.
- **Alternatively:** The browser extension could POST events to a tiny local HTTP server spawned by the VS Code extension, which writes the sidecar directly. This avoids file-polling but adds complexity.

## Open questions

- Manifest V3 restrictions on local file access — may require a native messaging host.
- Whether to ship as a separate marketplace extension or bundle with the VS Code extension.
- Event batching interval and flush strategy.

## Related

- Parent spec: [012_integration-spec-browser-devtools.md](012_integration-spec-browser-devtools.md)

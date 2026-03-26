# Spec: Browser and DevTools Integration

**Adapter id:** `browser`
**Status:** Partial
**Full design:** TBD — not yet created

## Goal

Correlate browser console (and optional network) with debug log by timestamp or correlation ID; show "Browser" tab with console events.

## Config

- `saropaLogCapture.integrations.adapters` includes `browser`
- `saropaLogCapture.integrations.browser.mode`: `"file"` | `"cdp"`
- `saropaLogCapture.integrations.browser.browserLogPath`: path to browser log file (file mode only)
- `saropaLogCapture.integrations.browser.browserLogFormat`: `"jsonl"` (default) or `"text"`
- `saropaLogCapture.integrations.browser.cdpUrl`: Chrome DevTools Protocol URL (cdp mode only, e.g. `ws://localhost:9222`)
- `saropaLogCapture.integrations.browser.includeNetwork`: capture network events too (default: false)
- `saropaLogCapture.integrations.browser.requestIdPattern`: regex to extract correlation ID from console messages
- `saropaLogCapture.integrations.browser.timeWindowSeconds`: correlation window when no ID matches (default: 5)
- `saropaLogCapture.integrations.browser.maxEvents`: cap events per session (default: 500)

## Modes

### File mode

Read an exported browser console log (JSON lines or plain text) at session end. Each JSON line entry should include at least `level` and `text`; `timestamp` and `url` are optional. Write sidecar (`basename.browser.json`).

### CDP mode

Connect to a running Chrome/Edge instance via Chrome DevTools Protocol at `cdpUrl` (localhost only). Subscribe to `Console.enable` and optionally `Network.enable`. Stream events to an in-memory buffer during the session; at session end write sidecar.

**When to use which:** Use file mode when you have an exported log (e.g. from Puppeteer, Playwright, or a browser extension). Use CDP mode for live capture from a running browser.

## Implementation

- **Provider:** Mode file: tail/read browserLogPath (JSONL) at session end; write sidecar. Mode CDP: connect to Chrome remote debugging (localhost only); subscribe Console.enable, optional Network; stream events to buffer; at end write sidecar.
- **Viewer:** "Browser" tab when sidecar exists; list console events (time, level, text). Optional "Related browser events" when line has matching requestId or falls within timeWindowSeconds.
- **Performance:** File: same as other tailers. CDP: async connect; do not block start. Cap maxEvents.
- **Security:** CDP localhost only. Browser console may contain PII — document; do not log raw events to extension output channel.
- **Status bar:** "Browser" when contributed.

## UX

- Loading: optional spinner for CDP connection. Viewer: "Browser" tab with events; no inline spinner after load.

## Status (shipped)

File mode provider and viewer are implemented:

- **Provider (file mode):** `src/modules/integrations/providers/browser-devtools.ts` — reads JSONL or JSON browser log at session end; normalizes raw events to `BrowserEvent` shape (drops entries with no usable text, logs count); writes `basename.browser.json` sidecar and meta.
- **Sidecar pipeline:** `BrowserEvent` type (`src/modules/timeline/event-types.ts`), `loadBrowserSidecar()` (`src/modules/timeline/sidecar-loaders.ts`), `parseBrowserEventToEvent()` (`src/modules/timeline/timeline-event.ts`), `.browser.json` discovery in `SIDECAR_MAP` (`src/modules/timeline/timeline-loader.ts`).
- **Viewer:** Browser events display in the unified timeline panel with red source color, level icons, virtual scroll, and source filtering. "Browser" label and count shown in filter bar.
- **Config:** `integrationsBrowser` settings defined in config types and read via `integration-config.ts`.
- **Registration:** Provider registered in `activation-integrations.ts`; adapter metadata in `integrations-ui.ts`.
- **Context popover (time-window correlation):** Browser events from `.browser.json` sidecar appear in the integration context popover when a log line is right-clicked. Uses the global `contextWindowSeconds` setting for time-window filtering. Types in `context-loader-types.ts`; parser in `context-sidecar-parsers.ts`; renderer in `viewer-context-popover-browser.ts`.

## Deferred

- **Request ID correlation:** `requestIdPattern` extraction for targeted matching (not yet implemented for any adapter — all use time-window only).
- **CDP mode:** WebSocket client, `Console.enable` / `Network.enable` subscriptions, buffer + flush lifecycle, disconnect handling.
- **Companion extension (Mode C):** A browser extension (Chrome/Edge) captures console and posts to a local server or file that VS Code watches. Functionally same as file mode once events land on disk.
- **Interleaved timeline:** Merge browser and backend events into a single time-sorted view in the main viewer (beyond the unified timeline panel).

# Spec: Browser and DevTools Integration

**Adapter id:** `browser`  
**Status:** Not implemented  
**Full design:** [docs/integrations/browser-devtools.md](../docs/integrations/browser-devtools.md)

## Goal

Correlate browser console (and optional network) with debug log; show "Browser" tab with console events.

## Config

- `saropaLogCapture.integrations.adapters` includes `browser`
- `saropaLogCapture.integrations.browser.*`: mode (file | cdp), browserLogPath, browserLogFormat, cdpUrl, includeNetwork, maxEvents

## Implementation

- **Provider:** Mode file: tail/read browserLogPath (JSONL) at session end; write sidecar. Mode CDP: connect to Chrome remote debugging; subscribe Console.enable, optional Network; stream events to buffer; at end write sidecar.
- **Viewer:** "Browser" tab when sidecar exists; list console events (time, level, text).
- **Performance:** File: same as other tailers. CDP: async connect; do not block start. Cap maxEvents.
- **Status bar:** "Browser" when contributed.

## UX

- Loading: optional spinner for CDP connection. Viewer: "Browser" tab with events; no inline spinner after load.

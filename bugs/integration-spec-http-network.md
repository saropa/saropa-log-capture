# Spec: HTTP and Network Integration

**Adapter id:** `http`  
**Status:** Not implemented  
**Full design:** [docs/integrations/http-network.md](../docs/integrations/http-network.md)

## Goal

Correlate log lines with HTTP requests by request ID or time; show "Related requests" in viewer.

## Config

- `saropaLogCapture.integrations.adapters` includes `http`
- `saropaLogCapture.integrations.http.*`: requestIdPattern, requestLogPath, harPath, timeWindowSeconds, maxRequestsPerSession

## Implementation

- **Provider:** `onSessionEnd`: read/tail requestLogPath (JSON lines) or parse HAR; build requestId → requests; write sidecar + meta. Request ID from log line via regex.
- **Viewer:** "Related requests" panel when line selected; show URL, method, status, duration. Optional "Attach HAR" command.
- **Performance:** Cap requests; filter HAR by time. No work at session start.
- **Status bar:** "HTTP" when contributed at end.

## UX

- No spinner at start. Viewer: "Related requests" empty until selection or "No requests." Optional badge on lines with request ID.

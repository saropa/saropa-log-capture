# Spec: HTTP and Network Integration

**Adapter id:** `http`  
**Status:** Partial
**Full design:** TBD — not yet created

## Goal

Correlate log lines with HTTP requests by request ID or time; show "Related requests" in viewer.

## Config

- `saropaLogCapture.integrations.adapters` includes `http`
- `saropaLogCapture.integrations.http.requestIdPattern`: regex to extract request ID from a log line
- `saropaLogCapture.integrations.http.requestLogPath`: path to HTTP request log file (JSON lines)
- `saropaLogCapture.integrations.http.harPath`: path to HAR file (alternative to request log)
- `saropaLogCapture.integrations.http.timeWindowSeconds`: correlation window when no request ID matches (default: 5)
- `saropaLogCapture.integrations.http.maxRequestsPerSession`: cap requests indexed per session (default: 200)

## Implementation

- **Provider:** `onSessionEnd`: read/tail requestLogPath (JSON lines) or parse HAR; build requestId → requests; write sidecar + meta. Request ID from log line via regex.
- **Viewer:** "Related requests" panel when line selected; show URL, method, status, duration. Optional "Attach HAR" command.
- **Performance:** Cap requests; filter HAR by time. No work at session start.
- **Status bar:** "HTTP" when contributed at end.

## UX

- No spinner at start. Viewer: "Related requests" empty until selection or "No requests." Optional badge on lines with request ID.

## Deferred

- Auto-detect HAR from browser DevTools export
- Request/response body preview (with size cap and redaction)
- Latency histogram in Performance panel
- Group requests by endpoint pattern

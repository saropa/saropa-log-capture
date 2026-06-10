# Integration: HTTP and Network

## Problem and Goal

Many failures are tied to **HTTP requests**: a failing API call, a timeout, or a bad response. The debug console may log "Request failed" or a status code, but the full request/response (URL, headers, body, timing) often lives in a separate tool (browser DevTools, Postman, or a proxy). Correlating **network activity** with log lines (by request ID, timestamp, or both) lets developers see "this log line happened during this request" without switching context. This integration enables **capturing or correlating HTTP/network data** with the debug log so that selected log lines can show "related requests" and vice versa.

**Goal:** (1) **Correlate by ID:** If the app logs a request ID or trace ID in the debug console and the same ID appears in network logs (or in a proxy/APM export), link them so the viewer can show "Related requests" for a line. (2) **Correlate by time:** Optionally attach a **network log file** (e.g. HAR, or a simple request log) for the session time range and show requests in a panel or timeline. (3) **No in-process proxy in v1:** Rely on external tools (browser, proxy, app-generated request log) and optional file/API; extension only indexes and correlates.

---

## Data Sources

| Source | Format | How to get it |
|--------|--------|----------------|
| **App-generated request log** | File or stdout: JSON lines with requestId, url, method, status, duration | App writes to file; extension tails or reads at session end (same as Database query logs) |
| **HAR file** | HTTP Archive (JSON): list of requests with timestamps | User exports from DevTools or proxy; path in config; extension imports for session time range |
| **Browser/DevTools** | CDP Network domain events | See Browser/DevTools integration; can feed request list into this correlation |
| **Proxy log** | mitmproxy, Fiddler, Charles: text or JSON | User configures path to log file; extension parses and indexes by time and optional request ID |
| **APM / backend** | Datadog, New Relic: API returning requests by trace ID | User provides API + token; extension looks up by trace ID from log line (similar to DB integration API mode) |

**Recommended v1:** (1) **Request ID extraction:** Configurable regex to extract request/trace ID from log lines; store in index. (2) **Request log file:** User configures path to a file where app (or middleware) writes request records (one per line, JSON: requestId, url, method, status, time, duration). Extension tails or reads at session end; build map requestId → requests. (3) **HAR import:** Optional: user runs "Attach HAR for this session" and selects a HAR file; we filter entries by session time range and store in sidecar; viewer shows "Requests" panel with list and link to request IDs in log.

---

## Integration Approach

### 1. Correlation keys

- **Request ID / trace ID:** Same as database integration: regex on log line → requestId; match to request log or HAR entries that have the same ID.
- **Timestamp:** Filter requests to those within session start–end (and optional lead/lag). Show "Requests in this session" in panel; when user clicks a request, optionally highlight log lines in that time window.

### 2. Where to show

- **Viewer:** "Related requests" when a line is selected (by request ID). Or "Session requests" panel: list of all requests in the session (from request log or HAR); click to see request details and optionally jump to log line that contains that request ID.
- **Sidecar:** `basename.requests.json`: array of requests (or by requestId) for offline use and bug report.
- **Bug report:** Option to include "Related request" (URL, method, status, duration) when the selected line has a request ID match.

### 3. Request log file format

- **JSON lines:** Each line is a JSON object: `{ "requestId": "...", "url": "...", "method": "GET", "status": 200, "durationMs": 45, "time": "ISO8601" }`. Optional: request/response body hashes or sizes (no full body in extension to avoid sensitive data).
- **Tailing:** Same pattern as Application file logs: tail the file during session; at end write sidecar. Or read full file at session end (if app flushes on exit).

---

## User Experience

### Settings (under `saropaLogCapture.http.*`)

| Setting | Type | Default | Description |
|--------|------|--------|-------------|
| `enabled` | boolean | `false` | Enable HTTP/network correlation |
| `requestIdPattern` | string | `""` | Regex to extract request/trace ID from log line (one capture group) |
| `requestLogPath` | string | `""` | Path to request log file (JSON lines); relative to workspace |
| `harPath` | string | `""` | Optional: path to HAR file to attach to session (filtered by time); or use command to attach |
| `timeWindowSeconds` | number | `10` | For time-based correlation: window around selected line |
| `maxRequestsPerSession` | number | `500` | Cap stored requests per session |
| `includeInBugReport` | boolean | `false` | Include related request in bug report when available |

### Commands

- **"Saropa Log Capture: Show related requests"** — From viewer selection, show requests matched by request ID or time.
- **"Saropa Log Capture: Attach HAR for this session"** — Open file picker; load HAR, filter by session time, write sidecar and show in Requests panel.
- **"Saropa Log Capture: Open requests for this session"** — Open `basename.requests.json` or Requests panel.

### UI

- **Viewer:** Context menu "Show related requests"; panel with URL, method, status, duration; optional "Copy as cURL."
- **Badge:** Small icon on lines that have a request ID match (e.g. network icon).

---

## Implementation Outline

### Components

1. **Request ID extractor**
   - Use `requestIdPattern` (regex) on log line text; return first capture group or null. Index: for each line, store requestId if present (in line index or sidecar).

2. **Request log reader**
   - Same as database query log: tail or read `requestLogPath` at session end; parse JSON lines; build map requestId → request. Write `basename.requests.json` (array or by-id). Respect `maxRequestsPerSession`.

3. **HAR parser**
   - On "Attach HAR": read HAR file (JSON); filter `log.entries` by entry.startedDateTime in session time range; normalize to same shape as request log (requestId from comment or URL param if present). Write to sidecar; viewer shows list.

4. **Correlation**
   - Given selected line: get requestId from index; look up in requests map; return list. If no requestId, optionally return requests in `timeWindowSeconds` around line timestamp.
   - Send to viewer: message type `relatedRequests: { requests: [...] }`.

5. **Viewer**
   - Panel "Related requests" or "Session requests"; render list; link to log line (if we store line index for requestId) or just show request details.

### Security and privacy

- Do not store request/response bodies by default (URL and headers can be sensitive too). Store only: url, method, status, duration, time, requestId. Option to redact query params in bug report.
- HAR may contain auth headers; document that user should use "Save HAR without content" or we strip bodies when importing.

---

## Configuration Summary

- **Extension settings:** `saropaLogCapture.http.*` as above.
- **Request log:** Document expected JSON schema for app/middleware writers.

---

## Risks and Alternatives

| Risk | Mitigation |
|------|------------|
| Large HAR | Filter by time; cap entries; do not store bodies |
| No request ID in app logs | Time-window only; or document "log requestId in app" |
| Many formats | Start with JSON lines; HAR as second format |

**Alternatives:**

- **In-process proxy:** Extension starts a local proxy; app points to it. Captures all traffic but requires config and may break HTTPS. Not v1.
- **CDP Network domain:** For Node/browser targets; see Browser/DevTools integration; can feed into this.

---

## References

- HAR spec: [HTTP Archive format](https://w3c.github.io/web-performance/specs/HAR/Overview.html)
- Existing: database-query-logs (requestId pattern, tailing), application-file-logs (tail).

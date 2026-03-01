# Wow Spec: One-click export to Loki/Grafana when configured

**Status:** Proposed (Consider for Wow)  
**Source:** ROADMAP §7 "Consider for Wow" #3, §4 "Wow" #9, §1 Task 92 (External log services)  
**Dependencies:** User-configured Loki push endpoint (URL, optional auth), session log content and metadata  
**Related:** [Loki HTTP API](https://grafana.com/docs/loki/latest/reference/loki-http-api), ROADMAP Task 92 (Logz.io, Loki, Datadog)

---

## 1. Overview

### 1.1 Goal

When the user has configured a **Grafana Loki** (or compatible) push endpoint, offer a **one-click action** to send the current (or selected) log session to Loki and, optionally, open Grafana Explore with a query that shows that session. The user gets their debug log in the same observability stack they use for production logs, without manual copy-paste or file upload.

### 1.2 Value Proposition

- **Unified observability:** Developers can correlate local debug sessions with production logs, traces, and metrics in Grafana.
- **Minimal friction:** One click after initial configuration (URL, optional API key or basic auth). No need to leave VS Code to upload files.
- **Consistent with "external log services":** Aligns with ROADMAP Task 92 (Logz.io, Loki, Datadog); this spec focuses on Loki/Grafana as the first concrete implementation; the same pattern can extend to Logz.io or Datadog later.
- **Differentiator:** Few debug-console capture tools offer direct push to Loki with "open in Grafana" link.

### 1.3 Out of Scope (for this spec)

- Logz.io or Datadog push (separate specs or follow-on work).
- Querying or reading back from Loki inside the extension (only push and optional "open in browser").
- Streaming push during live capture (only push at "export" time for a completed or currently loaded session).
- Authentication methods beyond HTTP Basic Auth and a single API key / bearer token (e.g. OAuth could be a later enhancement).

---

## 2. User Stories

| # | As a… | I want to… | So that… |
|---|--------|-------------|-----------|
| 1 | Developer | Configure my Loki push URL and (optionally) API key once in settings | I don’t have to enter them every time I export. |
| 2 | Developer | Click "Export to Loki" (or "Send to Grafana Loki") for the current log | The session is pushed to Loki and I get a success message (and optionally a link to open in Grafana). |
| 3 | Developer | Have the session in Loki labeled with session name, app version, and source (e.g. extension name) | I can filter and find it easily in Grafana Explore. |
| 4 | Developer | See a clear error if push fails (e.g. 401, 403, 400, network error) | I can fix config or connectivity. |
| 5 | User without config | See "Export to Loki" disabled or a message that I need to configure the Loki URL | I understand what to do before using the feature. |

---

## 3. Technical Design

### 3.1 Loki Push API (summary)

- **Endpoint:** `POST <loki_base_url>/loki/api/v1/push`
- **Body:** JSON with a `streams` array. Each stream has:
  - `stream`: object of label key-value pairs (strings). Typical labels: `job`, `source`, `session`, `app_version`, etc.
  - `values`: array of `[timestamp_nanoseconds_string, log_line_string]`. Timestamp must be Unix epoch in **nanoseconds** (string). Log line is the raw line text.
- **Headers:** `Content-Type: application/json`. If auth is configured: `Authorization: Basic <base64(user:password)>` or `Authorization: Bearer <token>`.
- **Constraints:** Loki may reject entries that are "too old" (e.g. outside a retention window). Timestamps should be current or recent; for a just-captured session this is usually fine. Label values must be strings (no booleans as JSON booleans in older Loki).

### 3.2 Configuration (extension settings)

- **Enable:** `saropaLogCapture.loki.enabled` (boolean, default `false`). When `false`, the "Export to Loki" command is hidden or disabled, and the export logic is not invoked.
- **URL:** `saropaLogCapture.loki.pushUrl` (string). Full URL to the push endpoint, e.g. `https://logs-prod-XXX.grafana.net/loki/api/v1/push` (Grafana Cloud) or `http://localhost:3100/loki/api/v1/push` (self-hosted). No trailing slash. Required when `loki.enabled` is true.
- **Auth:** One of:
  - **Basic:** `saropaLogCapture.loki.basicAuthUser` and `saropaLogCapture.loki.basicAuthPassword` (password in secretStorage or settings; recommend secretStorage for password).
  - **Bearer:** `saropaLogCapture.loki.bearerToken` (or store in secretStorage as `saropaLogCapture.loki.bearerToken` key).
- **Grafana Explore URL (optional):** `saropaLogCapture.loki.grafanaExploreUrl` (string). If set, after a successful push the extension can open this URL (or a templated version with labels) so the user lands in Explore with a query pre-filled for the pushed stream. E.g. `https://grafana.example.com/explore?orgId=1&left={"queries":[{"expr":"{job=\"saropa-log-capture\"}"}]}`. Template placeholder support (e.g. `{session}` or `{job}`) can be added so the exact stream is selected.
- **Default labels:** `saropaLogCapture.loki.defaultLabels` (object). Optional key-value pairs added to every push (e.g. `environment: "dev"`, `team: "mobile"`). Merged with session-derived labels.

### 3.3 What Gets Pushed

- **Log lines:** The same text lines as in the log file (optionally up to a limit, e.g. last N lines or full file; recommend full session for MVP). Each line is one entry in `values`.
- **Timestamps:** If the log has per-line timestamps (e.g. from `includeTimestamp`), parse and convert to Unix nanoseconds. If the log has only elapsed time (e.g. `[+125ms]`), derive a synthetic timestamp from session start (e.g. from session metadata or file mtime) plus cumulative elapsed ms. If no timing at all, use a single timestamp (e.g. file mtime or "now") for all lines so they still appear in order (Loki will sort by timestamp).
- **Stream labels (recommended):**
  - `job`: e.g. `saropa-log-capture` (constant so user can query `{job="saropa-log-capture"}`).
  - `session`: session display name or a sanitized filename (unique per export).
  - `app_version`: from session metadata if available.
  - Any labels from `defaultLabels` and optionally tags from metadata (as a single label like `tags="flutter,debug"` or one label per tag depending on Loki best practices).

### 3.4 Flow

1. **Precondition:** User has loaded a log (current session or from history). Command "Export to Loki" (or "Send to Grafana Loki") is visible only when `loki.enabled` is true and `loki.pushUrl` is set.
2. **Gather data:** Read current log URI content (or use in-memory lines if already loaded). Optionally read session metadata for labels (display name, app version, tags). Build list of `[timestamp_ns, line_text]` and label set.
3. **Auth:** Retrieve password or bearer token from settings or secretStorage. If missing and required by the URL (e.g. Grafana Cloud), prompt once and store in secretStorage.
4. **Push:** `POST` to `pushUrl` with JSON body. Use `fetch` or Node `https`/`http` with proper TLS. Set `Content-Type: application/json` and `Authorization` if configured. Timeout after e.g. 30 seconds.
5. **Response:** On 2xx, show success notification: "Session pushed to Loki." Optionally include a link "Open in Grafana" that opens `grafanaExploreUrl` (or a templated URL with the stream’s labels). On 4xx/5xx or network error, show a clear error message (e.g. "Loki push failed: 401 Unauthorized. Check API key in settings.") and do not open the browser.
6. **Progress:** Use `withProgress` (e.g. "Pushing to Loki…") so the user sees that the action is in progress.

### 3.5 Security and Privacy

- **Secrets:** Store Loki API key or password in VS Code `SecretStorage` (key e.g. `saropaLogCapture.loki.bearerToken` or `loki.basicAuthPassword`). Do not log or include in error messages.
- **Log content:** User explicitly triggers push; they are responsible for not pushing sensitive data. Optionally document that redaction (e.g. `redactEnvVars`) applies to the log file but the pushed content is whatever is in the current viewer/file — so if they redact before capture, pushed content is redacted. Consider a warning in docs: "Do not push logs containing secrets to shared Loki instances."
- **URL validation:** Validate `pushUrl` is HTTPS in production (or allow HTTP only for localhost) to avoid accidental credential leakage.

### 3.6 Grafana Explore link (optional)

- If `grafanaExploreUrl` is set, after success the notification can include an action "Open in Grafana". The URL can be static (user already has a saved query) or templated. Simple approach: base URL + query param for `{job="saropa-log-capture"}` and optionally `{session="<name>"}` so the user lands on the right stream. Implementation: replace placeholders like `{{session}}` in the configured URL with the actual session label value (URL-encoded).

---

## 4. Implementation Phases

### Phase 1 — MVP

- Settings: `loki.enabled`, `loki.pushUrl`, `loki.bearerToken` (store in SecretStorage when provided via a prompt or settings UI). No Basic Auth in MVP if it simplifies.
- Command: `saropaLogCapture.exportToLoki`. Enabled only when `loki.enabled` and `loki.pushUrl` are set. Gets current log URI from viewer provider.
- Read log file content; if no per-line timestamps, use file mtime for all lines (or single stream with one timestamp). Build one stream with labels `job=saropa-log-capture`, `session=<displayName or filename>`.
- POST to `pushUrl` with JSON body; show progress; on success show "Pushed to Loki"; on failure show error message. No "Open in Grafana" link yet.
- NLS and README: document the two settings and the command.

### Phase 2 — Auth and labels

- Basic Auth: `loki.basicAuthUser` and password in SecretStorage. Bearer token in SecretStorage. Prompt for token on first use if not set.
- Richer labels: `app_version`, optional `tags` from session metadata; `defaultLabels` from config.
- If log has timestamps or elapsed time, parse and send per-line timestamps in nanoseconds.

### Phase 3 — Grafana link and polish

- `loki.grafanaExploreUrl` with optional template placeholders. After successful push, show "Open in Grafana" in the notification; open in browser on click.
- Validate HTTPS (or allow localhost HTTP). Improve error messages (401 vs 403 vs 400 vs timeout) with l10n.
- README section "Export to Grafana Loki" with prerequisites (Loki instance, Grafana Cloud or self-hosted) and link to Loki HTTP API docs.

---

## 5. Dependencies and Constraints

- **Loki:** User must have access to a Loki instance (Grafana Cloud, self-hosted, or compatible API). Extension does not ship or run Loki.
- **Network:** Push requires outbound HTTPS (or HTTP to localhost). Corporate proxies may need to be handled by the environment (e.g. VS Code proxy settings).
- **Rate limits:** Loki or Grafana Cloud may rate-limit pushes. Document that large sessions may hit limits; consider chunking (e.g. split into multiple push requests by time or line count) in a future iteration if needed.
- **Testing:** Do not call real Loki in unit tests. Mock the HTTP client; test payload building (labels, timestamp format, body shape) and error handling.

---

## 6. Success Criteria

- With Loki URL (and optional auth) configured, the user can run "Export to Loki" and the current session is pushed to Loki with recognizable labels.
- On success, the user sees confirmation; optionally they can open Grafana Explore to view the log.
- On failure (auth, network, 4xx/5xx), the user sees a clear, actionable message. Secrets are not logged or exposed.
- When Loki is not configured, the feature is disabled or the user is directed to settings.

---

## 7. References

- [Loki HTTP API — Push](https://grafana.com/docs/loki/latest/reference/loki-http-api/#post-lokiapiv1push)
- [How to use HTTP APIs to send logs to Grafana Cloud](https://grafana.com/blog/2024/03/21/how-to-use-http-apis-to-send-metrics-and-logs-to-grafana-cloud/)
- ROADMAP §1 Task 92 (External log services), §4 "Wow" #9, §7 "Consider for Wow" #3
- Existing: session metadata (display name, app version, tags), log file format and timestamps, SecretStorage usage elsewhere in the extension

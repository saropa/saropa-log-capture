# PLAN 121 — cURL export, replay hint, and error classification for captured HTTP data

**Status: Open**

Created: 2026-09-20
Type: Viewer feature / Integration
Related: `src/modules/integrations/providers/http-network.ts`, `src/modules/integrations/providers/browser-cdp-capture.ts`, `plans/history/2026.06/009_integration-spec-application-file-logs.md`, `plans/history/2026.06/010_integration-spec-http-network.md`

---

## Summary

Add "Copy as cURL", slow-request flagging, and transport-vs-server error
classification on top of the HTTP request data Saropa already ingests via
`http-network.ts` and `browser-cdp-capture.ts` — without building a live interceptor
(that's a separate, larger, likely out-of-scope effort; see Alternatives).

---

## Motivation

Comparative research against `flutter_inspector_kit` (an in-app Flutter SDK with a
live Dio interceptor) confirmed a real capability gap in Saropa's HTTP story, but also
clarified its shape precisely:

- `http-network.ts` (58 lines) ingests a pre-existing, user-produced JSON-lines log
  file post-session and writes a `.requests.json` sidecar. It does not intercept a
  live client.
- `browser-cdp-capture.ts` connects to Chrome DevTools Protocol and maps network
  events to `{message, level, timestamp, url}` — status + URL only, no headers/body.

inspector_kit's equivalent (`dio_interceptor.dart`, `network_entry.dart`,
`network_formatters.dart`, `network_utils.dart`) captures full request/response
headers+body, supports cURL export (`buildCurl`, single-quote-escaped, redaction-gated),
flags slow requests against a configurable threshold, and classifies failures by
`(statusCode, errorType)` for an aggregated error-count summary.

Saropa cannot replicate the *live interception* (that requires an embedded SDK, a
different integration point than DAP/file capture). But wherever the sidecar
`.requests.json` data already has method/url/status/headers/body — because the user's
own HTTP logging interceptor upstream printed a rich enough JSON line — the *value-add
features* (cURL export, slow flagging, error classification, error-aggregation
summary) are directly portable and don't require a live connection.

---

## Behavior

### User flow

1. User has configured `saropaLogCapture.integrations.http.requestLogPath` per the
   existing `http-network.ts` provider, and their app's HTTP client logs
   method/url/status/duration/headers/body as structured JSON lines.
2. In the viewer, a captured HTTP entry (already correlated via the `.requests.json`
   sidecar) gets a context-menu action: "Copy as cURL" — builds a
   `curl -X <METHOD> ...` command from the available fields, redacting
   `Authorization`/`Cookie`/`Set-Cookie`/API-key-shaped headers by default (reuse the
   fix from `bug_048` — one shared redaction path).
3. Entries exceeding a configurable duration threshold
   (`saropaLogCapture.integrations.http.slowRequestThresholdMs`, default e.g. 2000ms,
   mirroring inspector_kit's 2s default) get a "slow" badge, consistent with existing
   badge patterns elsewhere in the viewer.
4. A summary banner in the relevant panel (Signals or a dedicated HTTP view, if one
   exists) aggregates failures by status code / connection-error type, matching the
   "N failures: X×500, Y×timeout" pattern.

### UI / UX

- Reuse existing chip/badge visual language rather than introducing a new pattern.
- Clearly label entries missing headers/body (because the source JSON line didn't
  include them) rather than silently showing an incomplete cURL command — a partial
  cURL command that silently drops the request body is worse than no cURL command.

---

## Edge Cases

1. **Sidecar JSON line missing headers or body** — cURL export should degrade
   gracefully (omit `-H`/`--data` flags) and visibly note the omission, not fabricate
   empty values.
2. **CDP-path entries** (`browser-cdp-capture.ts`) only ever have `{status, url}` —
   cURL export and slow-flagging should be unavailable for these entries, not produce
   a broken command; the UI should distinguish "no timing data" from "timing was zero".
3. **Redaction interacts with `bug_048`** — implement cURL redaction using the same
   fixed redaction path being added there, not a third parallel implementation.

---

## Alternatives Considered

- **Build a live Dio/HTTP interceptor SDK** (true parity with inspector_kit) —
  rejected for this plan's scope: that requires shipping a companion package the
  user's app imports, which is a different product surface (akin to inspector_kit
  itself) rather than an extension change. Worth a separate, explicitly-scoped
  strategic plan if Saropa ever wants an in-app companion SDK; not a "quick win."
- **Do nothing until a live interceptor exists** — rejected: the sidecar-ingestion
  path already has enough structured data in the common case to make cURL
  export/slow-flagging/classification valuable today.

---

## Decision

<!-- Fill in when the proposal is accepted or declined -->

---

## Implementation Notes

- `network_formatters.dart:105-129`'s `buildCurl(entry, {redact:true})` is a good
  reference shape: method, per-header `-H`, `--data`, quoted URL, single-quote
  escaping.
- Threshold/classification logic can live alongside the existing DB-focused
  slow-burst detectors (`src/modules/db/drift-db-slow-burst-detector.ts`) as a
  sibling module rather than inside `http-network.ts` itself, keeping the
  ingestion provider thin.

---

## Commits

<!-- Add commit hashes as implementation lands -->

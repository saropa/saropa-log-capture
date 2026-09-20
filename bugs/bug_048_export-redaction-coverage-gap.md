# Bug 048 — Sensitive-data redaction is not applied to HTML/CSV/JSON/Loki export paths

## Status: Open

<!-- Status values: Open → Investigating → Fix Ready → Fixed (pending review) → Closed -->

## Severity: High

Any captured log line containing a bearer token, `Authorization:` header text, or a
query-string secret (`token=`, `api_key=`, `password=`, etc.) survives untouched into
every export format except the bug-report and AI-context flows. A user exporting a
session to HTML/CSV/JSON to share with a teammate, or pushing to Grafana Loki, can leak
credentials that were captured incidentally in device/network logs — with no warning
that redaction does not apply there.

## Problem

`redactSensitiveContent()` (`src/modules/security/redact.ts:35-42`) exists and is
correctly used in two flows:

- `src/modules/bug-report/report-file-formatter.ts:46`
- `src/modules/bug-report/bug-report-collector.ts:272`
- `src/modules/bug-report/bug-report-collector-helpers.ts:52,70`
- `src/modules/bug-report/bug-report-formatter.ts:74`
- `src/modules/ai/ai-context-builder.ts:109,117,192,194,195`

Grepping for `redact|mask|sanitiz` across `src/modules/export/` finds **zero** call
sites in `html-export.ts` or `export-formats.ts`. The only "sanitiz" hit in that
directory is `sanitizeSessionLabel` (`loki-export.ts:29`), which sanitizes a Loki
*stream label* string — unrelated to secret redaction of log content.

Separately, `loki-export.ts:106` sets `headers['Authorization'] = 'Bearer ' + bearerToken`
to authenticate the extension's own outbound push — that's expected and not the bug,
but it underscores that this export path already handles auth headers as a first-class
concept and has no parallel handling for secrets *inside the exported payload*.

## Reproduction

1. Capture a debug session where a log line contains a header or query string matching
   `BEARER_AUTH_RE` or the query-secret pattern in `redact.ts:12,28` (e.g. a line printed
   by an HTTP logging interceptor that includes `Authorization: Bearer abc123...` or a URL
   with `?api_key=abc123`).
2. Export the session via any of: HTML export, CSV export, JSON export, or Grafana Loki
   push.
3. Inspect the exported artifact — the secret is present verbatim.

**Frequency:** Always (deterministic — no redaction call exists on this path).

## Root Cause

`redactSensitiveContent()` was wired into the bug-report and AI-context builders when
those features were added, but was never threaded into `src/modules/export/html-export.ts`
or `src/modules/export/export-formats.ts` (the shared code path for CSV/JSON/Loki). There
is no single "export pipeline" chokepoint that all four formats pass through with a
redaction step — each formatter independently serializes line content.

## Proposed Fix

1. Add an export-time redaction hook: call `redactSensitiveContent()` (or a currently
   pure/side-effect-free variant of it) on each line's rendered text/fields immediately
   before serialization in `html-export.ts` and `export-formats.ts`.
2. Add a setting, e.g. `saropaLogCapture.export.redactSensitiveData` (default **on** —
   this should not be an opt-in for a security-relevant default), consistent with how
   other export toggles are exposed in `package.json`.
3. Confirm `loki-export.ts` redacts the *content* being pushed, not just its own outbound
   `Authorization` header (those are two different things — don't conflate fixing one
   with covering the other).
4. Document the change in the export section of the README/CHANGELOG so users relying on
   "logs are pre-redacted before capture" understand this closes a gap that existed only
   in exports, not in the viewer.

## Changes Made

<!-- Fill in when a fix is written. -->

## Tests Added

<!-- Regression test: seed a line matching each of the three redact.ts patterns
     (bearer/auth header, path with username, query-string secret), run each exporter,
     assert the secret does not appear in output for HTML, CSV, JSON, and Loki payload
     construction. -->

## Commits

<!-- Add commit hashes as fixes land. -->

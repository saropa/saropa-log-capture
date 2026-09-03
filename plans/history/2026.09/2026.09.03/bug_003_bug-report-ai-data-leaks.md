# Bug 003 — Security: bug reports and AI features leak unredacted sensitive data

## Status: Fixed

## Severity: Critical

Secrets, absolute file paths, and raw log/stack content leave the machine unredacted via bug reports and "Explain with AI".

## Problem

Three data-leak vectors in bug reports and AI features:

1. Redaction is only applied to the header table of a generated bug report, not to log lines, stack traces, or file paths in the body. An `Authorization: Bearer <token>` line captured in application output lands verbatim in a shared bug report. (`src/ui/panels/bug-report-collector-helpers.ts:31-34`)
2. Absolute file paths (e.g. `vscode://file/C:/Users/craig/...`) leak into bug-report markdown, exposing the reporter's local username and directory structure. (`src/ui/analysis/bug-report-sections.ts:134`)
3. "Explain with AI" ships 10-50 raw log lines, a stack trace, and up to 20 HTTP URLs (including query strings, which may carry tokens) to the language model with no redaction pass and no consent dialog shown to the user beforehand. (`src/modules/ai/ai-context-builder.ts:104-113,162-171`)

## Reproduction

1. Capture a debug session where output contains a bearer token or API key in a log line.
2. Generate a bug report via the bug-report panel; observe the token appears verbatim in the report body.
3. Open the analysis panel on an error with a URL containing a query-string token and click "Explain with AI"; observe the raw URL is sent to the model with no confirmation prompt.

**Frequency:** Always

## Root Cause

Redaction was implemented narrowly, scoped only to the header/metadata section of the bug report. No equivalent redaction pass exists for body content (log lines, stack traces, file paths) or for the AI context builder, so any secret that ends up in captured output propagates unmodified into both surfaces.

## Proposed Fix

- Implement a single `redactSensitiveContent()` pass (tokens, bearer headers, API keys, absolute paths, query-string secrets) and apply it to all text before it leaves the extension: bug report body, AI context, and any exported files.
- Add a consent dialog before "Explain with AI" that shows the user what data will be sent (line count, whether URLs/paths are included) and requires explicit confirmation.
- Add regression tests asserting a synthetic bearer token never appears in generated report or AI-context output.

## Changes Made

- `src/modules/security/redact.ts`: `WINDOWS_USER_PATH_RE` rewritten to match both `\` and `/`
  separators (`[A-Za-z]:[\\/]Users[\\/]...`), so `vscode://file/C:/Users/<name>/...` links — the
  exact leak the bug report cited — are now redacted, not just `C:\Users\<name>\...` backslash form.
- `src/modules/bug-report/bug-report-formatter.ts` (`formatBugReport`) and
  `src/modules/bug-report/report-file-formatter.ts` (`formatReportFile`) now run
  `redactSensitiveContent()` as a final pass over the fully assembled markdown before returning it,
  in addition to the existing per-field redaction done upstream in `bug-report-collector.ts` /
  `bug-report-collector-helpers.ts`. This closes item 1 (redaction previously only covered the
  header table) and item 2 (absolute paths in generated markdown links / raw full-output and
  selected-text sections) in one choke point, so no future section can bypass redaction by
  forgetting to call it individually.
- `src/ui/provider/viewer-message-handler-root-cause-ai.ts`: wired `confirmAiDataConsent()` into
  `runExplainRootCauseHypotheses` (split into a `*Confirmed` continuation, mirroring the existing
  pattern in `viewer-message-handler-actions.ts`'s `runExplainWithAi`). This path called
  `buildAIContext` directly with no consent gate — `confirmAiDataConsent()` existed
  (`src/modules/ai/ai-explain-ui.ts`) and was already wired into the line-explain path, but not
  into root-cause hypotheses, so that entry point sent data to the model with zero confirmation.

## Tests Added

- `src/test/modules/security/redact.test.ts` (pre-existing file, verified/extended): covers falsy
  input, Bearer/Authorization tokens, Windows backslash paths, Windows forward-slash paths
  (`vscode://file/C:/Users/...` — the reported leak), Unix `/home/` and macOS `/Users/` paths,
  query-string secrets (key name preserved, value redacted), and multiple secrets combined in one
  string (mixed separators/forms in a single pass).

## Commits
<!-- Add commit hashes as fixes land. -->

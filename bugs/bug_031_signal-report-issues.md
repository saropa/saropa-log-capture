# Bug 031 — Signal report rendering issues (l10n overwrite, oversized state, template ID mismatch)

## Status: Open

## Severity: Medium

Signal reports show English text to non-English users, bloat webview state with tens of megabytes of base64, and silently fall back to "no details" for session-diff hypotheses.

## Problem

Three issues in signal report rendering:

1. **English headings overwrite l10n:** Localized section headings (`t('signals.section.overview')`) are overwritten with hardcoded English strings (`'Session Overview'`, `'Evidence'`) during render. Non-English users see English section headings. (`signal-report-panel.ts:116-164`)
2. **50 MB base64 inlined into webview state:** 3 thumbnails + 2 diffs (10 MB cap each) are base64-inlined into a single `postMessage`, then the same HTML is stored via `setState` on every `sectionReady` event. Multi-megabyte state per panel. (`signal-report-screenshots.ts:24,77-80`, `signal-report-render.ts:165-176`)
3. **Template ID mismatch:** `session-diff` is emitted as `session-diff-regression`, so the details section always renders the "no details" fallback. (`signal-report-details.ts:58,288` vs `build-hypotheses-sql.ts:115`)

## Reproduction

1. Switch VS Code display language to a non-English locale, open a signal report — section headings ("Session Overview", "Evidence") remain in English.
2. Open a signal report with screenshots/diffs attached, inspect webview state size via devtools — observe tens of MB stored per `sectionReady` event.
3. Open a signal report for a session-diff regression hypothesis — details section always shows the "no details" fallback instead of the diff.

**Frequency:** Always

## Root Cause

1. Hardcoded English strings overwrite the result of the l10n call.
2. No image compression or webview-local URI scheme for screenshots/diffs; full HTML re-stored on every ready event.
3. Typo/mismatch between the template ID constant used when emitting (`session-diff-regression`) and the one checked when rendering details (`session-diff`).

## Proposed Fix

1. Remove the hardcoded English overwrite; use the l10n() result directly.
2. Use webview-local URIs or compressed thumbnails instead of base64 data URIs; avoid re-storing full HTML state on every `sectionReady` event.
3. Fix the template ID constant so emission and lookup match.

## Changes Made
<!-- Fill in when a fix is written. -->

## Tests Added
<!-- List new or updated test files. -->

## Commits
<!-- Add commit hashes as fixes land. -->

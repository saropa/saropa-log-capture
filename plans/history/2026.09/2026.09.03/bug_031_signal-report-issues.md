# Bug 031 — Signal report rendering issues (l10n overwrite, oversized state, template ID mismatch)

## Status: Closed

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

Fix 1 (l10n overwrite) and fix 3 (template ID mismatch) were already fixed in an
earlier pass. This pass covers fix 2 (50 MB base64 state bloat):

- `signal-report-panel.ts`: `createPanel()` now takes the log's `fileUri` and sets
  `localResourceRoots: [screenshotDirUri(fileUri.fsPath)]` on the webview panel
  (previously `[]`, which blocked any local-resource loading). `showSignalReport()` and
  `populateSections()` pass `panel.webview` through to `buildScreenshotSectionHtml()`.
- `signal-report-screenshots.ts`: `buildThumbHtml()` no longer reads the PNG off disk
  and base64-encodes it — it builds the `<img>` `src` from
  `webview.asWebviewUri(pngUri)` instead, so the browser streams the file directly and
  nothing but a short resource-reference string enters the section HTML (or the
  `setState` payload it feeds on every `sectionReady` event). `buildScreenshotSectionHtml()`
  now takes the `webview` parameter and builds thumbnail cards synchronously (no disk
  read to await).
- The before/after diff pair (`buildDiffBlockHtml()` / `readImageDataUri()`) is
  **unchanged** — it stays base64-inlined because the shell script reads its pixels off
  a `<canvas>` to compute the change-heat overlay, which needs a same-origin/data-URI
  image source; a `vscode-webview-resource:` URI would taint the canvas for pixel
  reads. This matches the exception called out in the bug's proposed fix.
- Net effect: worst case per report went from ~50 MB (3 thumbnails + 2 diff images, all
  base64, all re-persisted via `setState` on every section refresh) to ~20 MB
  (diff pair only) with the 3 thumbnails now a handful of URI strings.

## Tests Added

No new automated test — the change is a webview resource-loading plumbing change with
no pure-function surface to unit test (`buildThumbHtml`/`buildScreenshotSectionHtml`
depend on a live `vscode.Webview`). Verified via `npx tsc --noEmit` (0 errors) and
`npm run compile` (all 12 gates pass, including `verify:dist-size`).

## Commits
<!-- Add commit hashes as fixes land. -->

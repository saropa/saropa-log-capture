# Level focus showed no rows; Drift logs vanished under the Database filter

Isolating a severity level in the log viewer (double-clicking a level dot to solo it) produced an empty result even though the count badge reported dozens or hundreds of matching lines, and the Database filter in particular showed roughly one row out of 200+. Two independent defects combined: the orthogonal Log Sources tier filter silently suppressed the isolated level, and every Drift interceptor log line was being misclassified as a stack frame and folded out of view.

## Defect 1 — tier filter silently ANDed with level isolation

The top-bar level dots are tallied by `updateStatsFromLines` (`src/ui/viewer/viewer-stats.ts`), which runs `classifyLevel()` on every raw incoming line. That count reflects classification only. Visibility, however, is the AND of three independent axes evaluated in `calcItemHeight` (`src/ui/viewer/viewer-data-helpers-core.ts`): the level filter, the Log Sources tier filter (`isTierHidden`, `src/ui/viewer-stack-tags/viewer-stack-filter.ts`), and collapse state.

The Device and External tiers default to `warnplus`, which hides every line whose effective level is not `error`/`warning`. Soloing `debug` or `database` left those tiers untouched, so device/external lines at the isolated level stayed hidden and the view showed only context rows — despite a non-zero count badge. The two filter axes were never reconciled when the user expressed an explicit "show me all of these" intent.

## Defect 2 — Drift/database lines misdetected as stack frames

Each Drift interceptor line is a single content line terminated by an inline call-site annotation:

```
[log] [database] Drift SLOW 119ms SELECT: SELECT * FROM "country_states" ORDER BY "id" LIMIT 1000  » DriftDebugInterceptor._lightLog (./lib/database/drift/drift_debug_interceptor.dart:282:5)
```

The stack-frame detectors `isStackFrameLine` (`src/modules/analysis/stack-parser.ts`) and its webview mirror `isStackFrameText` (`src/ui/viewer/viewer-script.ts`) end with a last-resort rule that matches any line containing `(<path>.dart:line:col)`. The trailing annotation satisfied that rule, so `tryIngestStackLine` (`src/ui/viewer/viewer-data-add-stack-ingest.ts`) consumed the entire SQL line as a stack frame. Two consequences followed: the line was folded into a (default-collapsed) stack group and therefore hidden, and as a stack frame it inherited the group header's level instead of `database` (frames take `activeGroupHeader.level`). Under the Database filter the lines were both collapsed and mis-leveled, so almost none survived. The classification count saw the raw text and still reported 200+, widening the discrepancy.

## Fix

Defect 1: `soloLevel` (`src/ui/viewer-search-filter/viewer-level-filter.ts`) now calls a new `resetTiersToAll()` (`src/ui/viewer-stack-tags/viewer-stack-filter.ts`) before applying the level filter. The helper opens all three tiers to `all`, syncs the drawer radios and the Log Sources summary so the change is visible, and relies on the caller's single `applyLevelFilter()` re-render. Single-level toggles are unchanged; only an explicit solo relaxes tiers.

Defect 2: both detectors gained a guard immediately before the parenthesized-path fallback. If a `»` (U+00BB) appears and any non-whitespace, non-braille (U+2800) text precedes the first occurrence, the line is an annotated content line and is not a frame. A genuine standalone SDA frame (`⠀ » Member (path)`) has only braille-blank plus whitespace before the `»`, so it still classifies as a frame. The two copies remain character-aligned in logic, enforced by the parity corpus.

## Tests

- `src/test/ui/viewer-stack-detection-parity.test.ts`: added a drift inline-annotation case asserting `frame: false` in both the extension-side and webview detectors. 39 passing.
- `src/test/modules/analysis/stack-parser.test.js`: 55 passing, including the pre-existing standalone-drift-frame assertion (`⠀ » DriftDebugInterceptor._log (...)` → `true`) confirming the guard does not regress real frames.
- `src/test/ui/viewer-db-detector-annotate-line.test.js`: 3 passing.

Typecheck clean (`tsc --noEmit`); production bundle builds (`node esbuild.js`).

## Residual

Level dot counts remain raw-classification totals. For a level dominated by repeated identical SQL, the count will still exceed the visible row count once duplicates collapse into a single "N × SQL repeated" row. That collapse is intended Database behavior (rows expand on click) and was left unchanged.

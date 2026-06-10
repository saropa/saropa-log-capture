# App-emitted tag dictionary → severity level + `[TAG:metadata]` format

**Triggered by:** A user filtered their log with the **DB severity-level dot** turned off, but app
lines like `bulkPreload DRIFT WRITE DONE — wrote 185 rows` stayed visible. They asked to "extend
the automatic tagging", "come up with a HUGE dictionary of tags, publish them in the README", and
adopt a `[TAG:optional metadata after colon]` format so apps can add debug context. Real Drift SQL
was already auto-classified `database`; the app's own DB-adjacent lines were not, because
`bulkPreload` is app vocabulary the content heuristic can't read.

## Finish Report (2026-06-05)

### Scope
(B) VS Code extension (TypeScript) + (C) docs (README, SOURCE_LOGGER_BEST_PRACTICES.md, CHANGELOG).
No Flutter/Dart app code.

### What shipped
1. **Explicit app tags → severity level.** A recognized bracket tag at the head of a line routes
   it to one of the existing 8 severity levels, so the level filter dots group it. `[db] …` →
   `database`; `[perf:cold start] …` → `performance`; etc.
2. **`[TAG:metadata]` format.** The derived tag name is everything before the first colon; the
   metadata after it stays visible inline (the parsers only read text, never rewrite the line). So
   `[db:phase 2]` and `[db:retry]` both group as `db` and never fragment tag counts.
3. **Extended automatic detection.** Added `Sqlite3`, `Prisma`, `DynamoDB` to the free-text
   database vendor tokens in both classifier mirrors. Conservative: bare `db`/`sql`/`query`/`orm`
   stay bracket-tag-only to avoid false positives in free text.
4. **Published dictionary.** README `## Log Tag Vocabulary` (~150 tags: 7 level-mapped groups + a
   large neutral/`info` semantic group) + `docs/SOURCE_LOGGER_BEST_PRACTICES.md` `### Severity tags`
   with Dart emit examples.

### Design notes (for the Reviewer AI)
- **Single source of truth:** new `src/modules/analysis/tag-level-dictionary.ts` holds
  `TAG_LEVEL_MAP`, `SeverityLevel` (moved here, re-exported from `level-classifier.ts` so existing
  importers are unaffected), `headBracketTagPattern`, `tagNameBeforeColon`, `lookupTagLevel`,
  `matchesTagLevel`, `tagLevelMapJson`. The extension classifier imports it; the webview classifier
  (a string template that cannot import) bakes the map in via
  `var TAG_LEVEL_MAP = ${tagLevelMapJson()};` — `JSON.stringify` of a hardcoded constant, no user
  input, safe injection.
- **Only non-`info` levels are coded.** Tags that would map to `info` need no code — they already
  work as open-vocabulary source-tag chips — and live only in the README list.
- **Decision-order priority is unchanged:** tag lookup runs AFTER the error check (so
  `[db] Error: …` stays `error`) and BEFORE the keyword sweep (so `[db] … failed` stays
  `database`, not `warning`). It generalizes the existing `matchesDatabaseAnnotation` bracket arm;
  the `Vendor:` colon-prefix arm (`DRIFT: …`) is preserved. In the logcat branch it stays after
  the W-warning short-circuit, matching prior behavior.
- **Colon-split** applies only to the bracket capture group (`m[3]`) in both source-tag parsers;
  logcat tags (`m[2]`) can't contain a colon. `Drift SELECT:` / `DRIFT:` are unaffected (matched by
  the statement/colon-prefix patterns, never the bracket capture).
- **No webview-scope name collision:** the new helper names appear only in viewer-level-classify.ts;
  the source-tags mirror uses an inline split (no named function) to avoid redeclaration in the
  concatenated webview scope. Verified by grep.

### Deep review findings
- Logic & safety: head pattern anchored to `^`; colon-split via `indexOf`/`slice`; `lookupTagLevel`
  uses `?? null` (ext) / `|| null` (webview). No recursion, no async, no race.
- Architecture: extends the existing classifier inventory rather than spawning a parallel path;
  reuses `tagNameBeforeColon` in source-tag-parser.ts; reuses the existing
  `matchesDatabaseAnnotation` placement. No code smells found beyond scope; no refactor needed.
- Documentation: new module carries a verbose header explaining the safe-bracket vs
  risky-free-text rationale; call sites carry WHY comments.

### Testing
- **Audit of existing tests (mandatory):** grepped `src/test/` for `classifyLevel`, `parseSourceTag`,
  `SeverityLevel`, `databaseVendorToken`, `getLevelClassifyScript`, and the new helper names. Read
  the colliding bracket-tag assertions in `level-classifier.test.ts`,
  `level-classifier-special.test.ts`, `source-tag-parser.test.ts`. Every collision resolves to the
  SAME level as before (`[error]`→error via matchesError; `[Drift]`→database;
  `[SqliteCache]`/`[IsarDriftRowCountAudit]`→database via matchesDatabaseAnnotation;
  `see [Drift]`→info, not promoted, because headBracketTagPattern is `^`-anchored). No existing
  assertion needed rewriting.
- **New tests:**
  - `source-tag-parser.test.ts` — `[TAG:metadata] colon split` suite (5 cases incl. Drift-SQL
    regression).
  - `src/test/modules/analysis/level-classifier-tags.test.ts` — `LevelClassifier — app head tags`
    (10 cases incl. the reported bug, error-wins, unknown-tag-stays-info, logcat-prefixed,
    case-insensitive, Sqlite3 vendor).
  - `src/test/ui/viewer-level-classify-parity.test.ts` — NEW extension/webview parity test (the
    classifier pair had none). Runs the emitted webview script in a `vm` and asserts a 13-line
    corpus classifies identically in both copies + a drift-guard aggregate.
- **Commands run:** `npm run check-types` (clean); `npx eslint` on the 5 changed source files
  (clean); `npm run compile` (all verify gates pass incl. webview-catalog + dist-size + verify-nls
  466 keys); `npm run test` → **3007 passing, 0 failing, exit 0**. New suites confirmed present in
  output.

### Localization (l10n)
SKIPPED [B/C-NOT-IN-SCOPE] — extension TS + docs only; no Flutter UI. The extension's own NLS
pipeline added no `%keys%`: the dictionary is internal, the README/docs vocabulary is not NLS.
`verify-nls` passed (466 keys aligned) during compile.

### Maintenance
- CHANGELOG: 2 Added bullets under `## [Unreleased]` (no date, per project convention).
- README: added `## Log Tag Vocabulary` (product-facts change — appropriate).
- `package.json` / lock: not touched — no release or dependency change.
- TERMINOLOGY/guides reviewed: existing **Tag** entry (manual / auto-tag / correlation) already
  covers a rule-based pattern match; no terminology change needed.
- `docs/LAUNCH_TEST.md`: does not exist in this project — not created (would be a new top-level
  file outside task scope).
- Roadmap: SKIPPED [A-NOT-IN-SCOPE] (DEFAULT variant).
- Bug archival: No bug archive — task did not close a `bugs/*.md` file.

### Files
- New: `src/modules/analysis/tag-level-dictionary.ts`,
  `src/test/modules/analysis/level-classifier-tags.test.ts`,
  `src/test/ui/viewer-level-classify-parity.test.ts`, this report.
- Modified: `src/modules/analysis/level-classifier.ts`,
  `src/ui/viewer-search-filter/viewer-level-classify.ts`,
  `src/modules/source/source-tag-parser.ts`, `src/ui/viewer-stack-tags/viewer-source-tags.ts`,
  `src/test/modules/source/source-tag-parser.test.ts`, `README.md`,
  `docs/SOURCE_LOGGER_BEST_PRACTICES.md`, `CHANGELOG.md`.
- Excluded from commit (other workstream): `scripts/modules/publish/publish_confirm.py`.

### Outstanding
None for this task. On-device manual check is described in the chat handoff (works in the live
webview, which automated tests can't render).

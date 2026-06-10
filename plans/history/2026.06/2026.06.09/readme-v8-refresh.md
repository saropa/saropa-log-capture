# README refresh for v8

**Trigger:** The user asked, across several turns, to (1) add a release-version + last-updated footer to the README, (2) bump it to v8 and condense the prose without losing content, (3) document the v8 features that were missing from the README, (4) give the flagship Flow Map feature proper prominence, and (5) add a couple of simple, helpful ASCII diagrams.

## Finish Report (2026-06-09)

### Critical note
This work will be reviewed by another AI.

### Scope
**(C) docs only** — `README.md` and one `CHANGELOG.md` entry. No Dart/Flutter app code (no `lib/` here — this is the VS Code extension repo), no TypeScript extension code, no tests, no build config.

### What changed
- **Footer** — added `<sub>v8.0.0 · 2026-06-09</sub>` at the end of the README. Version pulled from `package.json` (`7.18.0` at the time of the first footer, corrected to `8.0.0` when the user asked to bump for v8 — matches the `## [8.0.0]` CHANGELOG section).
- **Prose condensation** — tightened the intro, the F5 testing note, "Works Best With", "Remote Development", "Contributing", and the Log Tag Vocabulary intro/format/neutral-tags paragraphs. No sections, features, links, commands, or tag-vocabulary list entries were removed.
- **v8 feature documentation:**
  - *Why Use This?* — three new highlights: Logs panel tree (Controller/peripheral nesting + Latest-only opt-in), Logs panel filters (chips, size filter, grouped menus, recently-opened, open-by-path/URL/drag), and a Flow Map reports highlight linking to the new section.
  - *Features* — new **Logs Panel** subsection (Controller-rooted tree, Latest-only, active-filter chips, size filter, grouped options menu, recently-opened files, open by path/URL/drag, markdown-renders-on-open + faster folders) and a Flow Map line under **Export**.
  - *Key Commands* — new `Export Session Flow Map` row.
- **Dedicated Flow Map section** — `## Flow Map — turn a log into a screen-journey report`, placed between "Why Use This?" and "Features", describing Executive Summary (hover copy), Activity Timeline, Screen Visit Log, and sortable Issue Report, plus the draggable divider / collapse-to-shrink behavior.
- **Two ASCII diagrams** — a Flow Map report layout (left journey diagram vs right detail columns) and a Logs panel Controller tree (`contacts` Controller with Lint Report / Arb Translate / Drift Advisor nested, plus a `saropa.com ⊕ 2 older` Latest-only expander row).
- **CHANGELOG** — one entry under the existing `## [8.0.0]` → `### Added` section recording the README refresh.

### Deep review
Docs-only; no logic, race, or architecture concerns. Verified the in-page anchor `#flow-map--turn-a-log-into-a-screen-journey-report` resolves to the new heading per GitHub's slug rules (em dash dropped, surrounding spaces become a double hyphen). ASCII diagrams align in a monospace font and match the style of the pre-existing top-of-README capture→viewer diagram.

### Testing validation
**Audit (4A):** Grepped `src/test` for `README` / `CHANGELOG`. Four matches, none pin the content I changed:
- `src/test/modules/git/changelog.test.ts` — tests a CHANGELOG *parser* against inline fixture strings (`## [Unreleased]`, `## [2026.0301.01]`), not the real `CHANGELOG.md`.
- `src/test/ui/viewer-about-panel.test.ts` — references `CHANGELOG.md` by name (opens it in the viewer); no content assertions.
- `src/test/ui/file-mode-detection.test.ts` — uses `'README.md'` only as a filename to assert markdown-mode detection.
- `src/test/modules/db/drift-static-sql-fixture-acceptance.test.ts` — incidental comment match.

No test required updating. **(4B)** No new behavior to test — docs only. Tests not executed (no code change to validate).

### l10n
SKIPPED [C-NOT-IN-SCOPE] — docs-only; no UI strings, no ARB files.

### Project maintenance
- CHANGELOG updated ✓. README is the subject of the task ✓. No `package.json` / lockfile change (the `8.0.0` version was already set by the broader branch; I only mirrored it into the README footer). No bug fixed.
- **Bug archival:** No bug archive — task did not close a `bugs/*.md` file.
- LAUNCH_TEST: not updated — this task introduces no new user-facing *behavior*; it documents features shipped by the broader v8 branch. The behaviors themselves are tracked by that branch's own plan files in this same dated history folder.

### Commit scope
Committed only this task's files: `README.md`, `CHANGELOG.md` (my one entry; the surrounding `## [8.0.0]` entries are the active branch's in-flight docs and are docs, not code), and this finish report. None of the branch's uncommitted `src/**` feature code was committed.

`Finish report saved: plans/history/2026.06/2026.06.09/readme-v8-refresh.md`

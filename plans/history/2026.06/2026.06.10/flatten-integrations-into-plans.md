# Flatten `plans/integrations/` into `plans/`

**Trigger:** User asked to move the files out of `plans/integrations/` and into `plans/` directly ("i want plans/integrations files moved out and put in /plans/ how?"), then to delete the now-redundant `README.md` and run `/finish`.

This was a docs-only reorganization: the `plans/integrations/` subfolder was flattened into the `plans/` root, link references that broke as a result were repointed, and the folder's index `README.md` — redundant with `001_integration-specs-index.md` and mislabeled once it sat at the `plans/` root — was deleted.

## Finish Report (2026-06-10)

**This work will be reviewed by another AI.**

### Scope
(C) docs only. No TypeScript, no Flutter/Dart, no runtime behavior. Sections covering app/extension code, l10n, tests-for-new-behavior, README product facts, and roadmap are SKIPPED as out of scope.

### What changed
1. `git mv` of all 16 files from `plans/integrations/` into `plans/` (history preserved); empty `plans/integrations/` directory removed.
2. Deleted `plans/README.md` (the moved integrations folder index) — redundant with `plans/001_integration-specs-index.md`, mislabeled as a `plans/`-root README, and carrying 3 dead links (`INTEGRATION_API.md`, `TASK_BREAKDOWN_AND_EASE.md`, `SAROPA_LINTS_INTEGRATION.md` — none exist in the repo).
3. Fixed the 4 link references that broke because of the move:
   - `README.md:387` — runbook link → `plans/010_runbook-missing-or-empty-logs.md`
   - `plans/guides/integrations.md:11` — schema link → `../drift-advisor-session.schema.json`
   - `plans/052_plan-semantic-timeline-capture-and-signal-expansion.md:81,414` — two `integrations/010_...http-network` refs → bare filename

### Deep review
- The 16 moved files' own internal cross-links use bare filenames (`[001_...](001_...)`), so they still resolve in the flat `plans/` directory — verified by inspection.
- Side effect: the move corrected a previously-broken `../src/...package-lockfile.ts` link in `001_integration-specs-index.md` (was `plans/src/...`, now resolves to repo-root `src/...`).
- Two pre-existing dead links were left untouched (broken before the move, unrelated to it): `INTEGRATION_API.md` (absent repo-wide) and `009_...application-file-logs.md`'s `../docs/integrations/application-file-logs.md` reference.
- Historical records in `plans/history/...` and `CHANGELOG_ARCHIVE.md` that mention the old `plans/integrations/` path were deliberately NOT rewritten — they are point-in-time records, correct as of when written.

### Testing validation
- Grepped all `*.ts/*.js/*.mjs/*.json/*.cjs` for `plans/integrations` → **no matches**. No code, script, or test references the moved docs path (the `src/modules/integrations/` and `src/test/modules/integrations/` hits are the unrelated code module, not the plans folder).
- No automated tests apply to a markdown file move. None written or run — there is no testable behavior change.

### CHANGELOG
Not updated — moving internal planning docs is not a user-visible product change. CHANGELOG tracks shipped extension behavior.

### Files
- Moved (16): `plans/integrations/{001_integration-specs-index, 009_integration-spec-application-file-logs, 010_integration-spec-http-network, 010_runbook-missing-or-empty-logs, 011_integration-spec-database-query-logs, 012_integration-spec-browser-devtools, 013_integration-spec-security-audit-logs, 014_integration-spec-browser-companion-extension, application-file-logs, browser-devtools, database-query-logs, drift-advisor-session.schema.json, http-network, security-audit-logs}.md/.json` → `plans/`
- Deleted (1): `plans/README.md` (was `plans/integrations/README.md`)
- Edited (3): `README.md`, `plans/guides/integrations.md`, `plans/052_plan-semantic-timeline-capture-and-signal-expansion.md`
- Created (1): this finish report

`Bug archived:` No bug archive — task did not close a `bugs/*.md` file.
`Finish report saved:` `plans/history/2026.06/2026.06.10/flatten-integrations-into-plans.md`

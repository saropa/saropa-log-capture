# Archive Fixed Bug Reports

45 bug reports filed during the v9.4.0 usability review were marked Fixed but never archived per the `ISSUE_REPORT_GUIDE.md` archival procedure. This task moves them to `plans/history/2026.09/2026.09.03/` and repoints stale references.

## What changed

- `git mv` 45 bug files (001–020, 022–046) from `bugs/` to `plans/history/2026.09/2026.09.03/`.
- Bug 021 (`destructive-default-deleteOriginals`) remains in `bugs/` — status is "Open (regression — fix incomplete)".
- Promoted bugs 001, 022, 030, 031 from "Fixed (pending review)" to "Closed" — all fixes shipped in v9.4.0.
- Repointed `bugs/bug_*` path references in:
  - `MASTER_PLAN.md` (line 329)
  - `plans/114_plan-debug-screenshot-capture_remaining.md` (line 47, bug 046 ref)
  - `bugs/ISSUE_REPORT_GUIDE.md` (line 41, generic range reference)
  - `CHANGELOG_ARCHIVE.md` (lines 951, 961 — pre-usability-review bug 006/007 links pointed to `bugs/` but the files live in `plans/history/2026.05/2026.05.23/`)
  - `src/test/modules/scripts/walkthrough-media.test.ts` (line 40, comment referencing bug 001)
- Corrected `ISSUE_REPORT_GUIDE.md` date-folder format from `YYYYMMDD` to `YYYY.MM.DD` to match all existing history folders.

## Finish Report (2026-09-03)

The 46-bug batch was filed in commit `32e063de` during the v9.3.12 → v9.4.0 usability review. All fixes landed across commits `c2eeaf08` through `4bc69401`. The archival procedure in `ISSUE_REPORT_GUIDE.md` (lines 395–405) requires `git mv` to `plans/history/YYYY.MM/YYYY.MM.DD/` on close, but no session performed it. This task executes the deferred archival for the 45 resolved bugs and updates six files that contained stale `bugs/bug_*.md` paths.

Hardening pass caught: one TypeScript test comment (`walkthrough-media.test.ts:40`), two CHANGELOG_ARCHIVE dead links (bug 006/007 from the May 2026 numbering), and a guide vs. reality date-format mismatch (`YYYYMMDD` documented, `YYYY.MM.DD` used everywhere). All corrected.

No functional code changes. No test impact. No l10n impact.

# Publish pipeline: verify CHANGELOG release intro + repoint log link

**Trigger (user request):** "update the publish.py script to check for the release intro and log link in changelog.md. the log link must be set to the proposed version. … if the intro is not found then ask the user to retry/ignore/abort. default to retry."

The publish pipeline stamps `## [Unreleased]` → `## [version]` at Step 10 but never verified the per-release plain-language intro line (the one that ends with a `log](…/blob/vX.Y.Z/CHANGELOG.md)` link, per the CHANGELOG.md maintenance notes). The in-progress section carries `…/blob/main/…` as a placeholder, so every published release shipped a log link pointing at `main` instead of its own tag. This task adds the verification + auto-repoint and a retry/ignore/abort prompt when the intro is absent.

## Finish Report (2026-06-10)

### 1. Critical note
This work will be reviewed by another AI.

### 2. Scope
**(C) docs/scripts only** — Python publish tooling (`scripts/`) plus a CHANGELOG entry. No Flutter/Dart app code (A); no VS Code extension TypeScript (B).

### 3. Deep review
- **Logic & safety:** `_find_intro_line` scans from the `## [version]` heading to the first non-blank line; a line starting `#` (sub-heading) or `---` (rule) means "no intro" → returns None. `_check_and_fix_intro` reads the file, repoints the log link only when the wanted `v{version}` form is not already present (idempotent), and returns `'missing'` on any read/write failure so the caller prompts rather than silently passing. The retry loop's non-interactive guard (`PUBLISH_YES` env OR non-tty stdin) is evaluated **once before the loop**, eliminating the infinite-prompt risk under a pseudo-tty where `input()` returns empty lines instead of raising `EOFError`.
- **Architecture & adherence:** Reuses the module's existing helpers (`_resolve_changelog_path`, `_try_write_changelog_file`) and display helpers (`ok`/`fix`/`warn`/`fail`/`info`). The `PUBLISH_YES` non-interactive convention mirrors `_resolve_version`. The retry/ignore/abort prompt mirrors the shape of `_prompt_on_test_failure` in `orchestrator.py`. No new module — the intro logic is changelog logic and belongs with the other changelog functions in `version.py`.
- **Performance & UI/UX:** One extra file read (+ at most one write) at Step 10 of an already I/O-heavy pipeline — negligible. Console output uses the existing `[FIX]`/`[OK]`/`[WARN]` markers.
- **Documentation:** Each new function carries a docstring stating the WHY (placeholder→tag repoint, non-interactive loop guard, what "missing" means). Module + `validate_version_changelog` docstrings extended (step 6). `publish.py` Step 10 header description updated.
- **Refactoring:** None beyond scope.

### 4. Testing validation
**A. Existing-test audit (mandatory):**
- Grepped `scripts/` for the touched symbols. Only `scripts/modules/publish/checks_project.py` references the public surface (`validate_version_changelog`, `has_unreleased_section`) — it re-exports them; both signatures are unchanged, so nothing breaks.
- Grepped `src/test/` — `src/test/modules/git/changelog.test.ts` covers `src/modules/git/changelog.ts` (the extension's TypeScript "may already be fixed" CHANGELOG parser), which is a **separate** subject from the Python publish `version.py`. No overlap, no assertion pinned to anything I changed.
- No Python unit-test harness exists for `scripts/modules/publish/` (the only Python tests under `scripts/` are l10n ones in `modules/verify/`). Adding a new pytest/unittest harness for one function would be scope creep, so behavior was verified by direct invocation instead (below).

**B. Behavior verification (executed):** `python -m py_compile` clean on `publish.py` + `version.py`. Ran the three code paths against a temp copy of the real CHANGELOG:
- repoint: `main` → `v8.0.2` (`[FIX]`), returns `ok`;
- idempotent second run: returns `ok`, no rewrite;
- missing version (`9.9.9`): returns `missing`;
- `_verify_release_intro('9.9.9')` under `PUBLISH_YES=1`: warns and returns `True` (no loop — this is the regression the once-before-loop guard fixes);
- `_verify_release_intro('8.0.2')`: returns `True`.

### 5. Localization (Flutter)
SKIPPED [C-NOT-IN-SCOPE] — no Flutter/Dart code; the new strings are Python console output (developer-facing), not user-facing app copy.

### 6. Project maintenance & tracking
- CHANGELOG.md: entry added under the pending `## [8.0.2]` → `### Changed`.
- README verified — no updates needed (no product fact changed; build tooling only).
- package.json / package-lock.json: unchanged (no release/dependency change in this task).
- verify-nls / NLS: SKIPPED [B-NOT-IN-SCOPE] — no `package.nls*.json` or `%key%` change.
- LAUNCH_TEST.md: SKIPPED [B-NOT-IN-SCOPE] — no user-facing extension feature changed.
- guides reviewed — no user-facing behavior changed.
- Roadmap: SKIPPED [A-NOT-IN-SCOPE].
- No bug archive — task did not close a `bugs/*.md` file (only `bugs/BUG_REPORT_GUIDE.md` exists).

### 7. Persist finish report
Finish report saved: `plans/history/2026.06/2026.06.10/publish-verify-changelog-intro-log-link.md` (this file).

### 9. Files changed
- `scripts/modules/publish/version.py` — added `_LOG_LINK_RE`, `_log_link_for`, `_find_intro_line`, `_check_and_fix_intro`, `_prompt_intro_missing`, `_verify_release_intro`; imported `warn`; called `_verify_release_intro` after stamping in `validate_version_changelog`; extended module + function docstrings.
- `scripts/publish.py` — Step 10 header description updated.
- `CHANGELOG.md` — `### Changed` entry under `## [8.0.2]`.
- `plans/history/2026.06/2026.06.10/publish-verify-changelog-intro-log-link.md` — this finish report.

### Core logic diff summary (for Reviewer AI)
At Step 10, after `_maybe_stamp_changelog` finalizes `## [version]`, `_verify_release_intro(version)` runs. It locates the intro line under the heading; if that line carries a `log](…/blob/{main|vX.Y.Z}/CHANGELOG.md)` link it rewrites the link to `v{version}` (no-op when already correct). If no intro line or no log link is present, an interactive run prompts retry (default) / ignore / abort; a non-interactive run (`PUBLISH_YES` or non-tty) warns and continues. Abort fails version validation (returns `False`), which halts the pipeline.

### Outstanding work
None. The repoint runs against the actual release tag at publish time; the pending `## [8.0.2]` section still reads `…/blob/main/…` by design (it is in-progress) and will be repointed to `v8.0.2` on the next real publish run.

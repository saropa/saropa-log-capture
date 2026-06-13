# publish.py — install-via-CLI prompt now defaults to No

The `publish.py` developer build flow ended with an "Install via CLI now?" prompt whose ENTER default was Yes. A routine build that the operator stepped through with the Enter key would therefore re-install the freshly packaged `.vsix` over the running extension without an explicit confirmation. Installing a local build is a deliberate action — replacing the live extension mid-session is disruptive and should be opt-in — so the default was flipped to No.

## Finish Report (2026-06-12)

### 1. Critical note
This work will be reviewed by another AI.

### 2. Scope
**(C)** docs/scripts only — a one-line default change in a Python build script plus its changelog entry. No Flutter/Dart app code (A) and no VS Code extension TypeScript (B) touched.

### 3. Deep review
- `prompt_install()` in `scripts/modules/publish/install.py` calls `ask_yn("Install via CLI now?", default=False)`. The `ask_yn` helper already returns the passed default on a bare ENTER, so flipping the argument is the complete behavior change; no caller-side logic depends on the old default.
- The `--auto-install` flag path is unaffected — it bypasses `prompt_install()` entirely (see `package_and_install` dispatch), so unattended/CI installs still install without a prompt.
- Comment updated to state WHY the default is No (avoid replacing the running extension without confirmation), replacing the prior one-keystroke-install rationale.
- The sibling `prompt_open_report()` retains `default=True` intentionally — opening a report is non-destructive and was out of scope.

### 4. Testing validation
**A. Existing-test audit:** Grepped `scripts/` and the test tree for `prompt_install`, `ask_yn`, and `Install via CLI`. No automated test pins the prompt default (the Python build scripts have no unit tests; TS tests under `src/test/` do not reference the publish flow). Nothing to update.
**B. New tests:** none added — the build-script prompt has no test harness and adding one is out of scope for a default flip. Tests not executed: no targeted test exists for this path.

### 5. Localization
SKIPPED [C-NOT-IN-SCOPE] — no user-facing app/extension strings; the prompt is operator-only CLI text in a dev build script.

### 6. Project maintenance & tracking
- CHANGELOG updated under `[Unreleased]` → Changed.
- README verified — no updates needed (the install prompt default is not documented as a product fact).
- `package.json` / lockfile untouched — not a release or dependency change.
- No bug archive — task did not close a `bugs/*.md` file.

### 7. Persist finish report
Finish report saved: plans/history/2026.06/2026.06.12/publish-install-prompt-default-no.md

### 8. Commit
Files changed:
- `scripts/modules/publish/install.py` — `ask_yn` default `True` → `False`, comment rewritten.
- `CHANGELOG.md` — new `[Unreleased]` Changed entry.
- `plans/history/2026.06/2026.06.12/publish-install-prompt-default-no.md` — this report.

# Publish pipeline — manifest-compat preflight gate

**Trigger:** A `publish.py` run (v8.0.1 → 8.0.2) ran all the way through compile (~21s), tests (~46s), and the Step 10 version bump + CHANGELOG stamp, then died at the Package step because vsce rejected `@types/vscode ^1.120.0 greater than engines.vscode ^1.105.0`. vsce only enforces that constraint at package time — *after* `package.json` and `CHANGELOG.md` were already mutated — so the run abandoned a half-finished release (the `M package.json` / `M CHANGELOG.md` working-tree state). User: "fix publish.py so we never abandon a release like this again. tell the user the problem and suggest solutions - with agree (accept) / retry / ignore / exit".

## Finish Report (2026-06-10)

This work will be reviewed by another AI.

### Scope

**(C) docs/scripts only.** All code changes are in the Python publish toolkit under `scripts/`. No extension runtime (TypeScript) or app code touched. Also bundled into the commit: the abandoned-run version bump to 8.0.2 (`package.json`, `package-lock.json`, `CHANGELOG.md` stamp) and pre-existing `l10n/bundle.l10n.{de,es,fr,it}.json` edits already in the working tree, committed at the user's explicit request ("git commit the whole project").

### Deep Review

- **Logic & Safety.** `check_manifest_compat()` is a `while True` loop with guaranteed termination: `ignore`/`exit` return immediately; `accept` writes `@types/vscode := engines.vscode`, so the next iteration reads equal versions and returns True; a failed `accept` write returns `"exit"`. Non-interactive runs (CI / `PUBLISH_YES` / non-tty stdin) never prompt — they fail fast with the diagnosis, so no infinite loop is possible headless. `prompt_fix_action` maps EOF/Ctrl+C to `exit` so a non-answer never silently mutates.
- **Architecture & Adherence.** The new gate is registered in `run_prerequisites` (Step 1) alongside the existing tool checks, so it runs at the cheapest, earliest point — before compile, tests, and any file mutation. `_align_types_to_engine` mirrors the existing targeted-regex edit pattern from `version.py:_write_package_version` (preserves key order/formatting). `prompt_fix_action` is a reusable helper in `display.py` next to `ask_yn`, consistent with the existing `_prompt_on_test_failure` / `_prompt_intro_missing` prompt style (native `input()`, no readline — per the bootstrap note in `publish.py`).
- **Direction of the auto-fix.** "Accept" lowers `@types/vscode` to the engine floor rather than raising `engines.vscode`. `engines.vscode` is the deliberately-committed compatibility floor; raising it would silently drop every user on VS Code 1.105–1.119. Aligning the types down preserves reach and, as a side effect, makes `ensure_dependencies` (Step 6) re-resolve — so any genuine API-level incompatibility surfaces at Compile, not at Package. The alternative (raise the engine) is named in the prompt's suggestions for an informed user to choose via `exit` + manual edit.
- **Error Boundary.** Read/write failures on `package.json` print a `[FAIL]` and return False (or `exit`) — never an unhandled traceback.
- **Refactoring.** None beyond scope.

### Testing Validation

- **A. Existing-test audit (mandatory).** Grepped the repo for the changed symbols (`check_manifest_compat`, `prompt_fix_action`, `_align_types_to_engine`, `_range_version`). Only the three source files match — no test references any changed symbol. The repo's test suite (`src/test/**`, Mocha via vscode-test) covers the extension TypeScript runtime; the Python publish pipeline under `scripts/` has no test harness, so no existing assertion pinned the old behavior.
- **B. New behavior verification.** No Python test harness exists for the publish toolkit; adding one is net-new infrastructure (out of scope for this fix). Verified by direct execution instead:
  - `python -m py_compile` on all four modified modules → clean.
  - `_range_version` parsing + comparison against the live `package.json` → correctly reports `(1,120,0) > (1,105,0)` mismatch.
  - `check_manifest_compat()` with `PUBLISH_YES=1` (non-interactive) → fails fast with the diagnosis + both suggestions, returns False, and made **no** mutation to `package.json`.
  - After applying the accepted fix (`@types/vscode → ^1.105.0`): `check_manifest_compat()` → `[OK] Manifest compatibility — @types/vscode ^1.105.0 <= engines.vscode ^1.105.0`, returns True.
  - Real compatibility check: installed `@types/vscode@1.105.0` (`--no-save`) and ran `npm run check-types` (`tsc --noEmit`) → **clean**, proving the code uses no 1.106–1.120-only APIs, so the downgrade costs nothing in practice.

### l10n Validation

SKIPPED [C-NOT-IN-SCOPE] — no Flutter/Dart and no extension UI strings changed. (The `l10n/bundle.*.json` edits in the commit are pre-existing translated-bundle content from an earlier session, not new strings introduced here.)

### Project Maintenance & Tracking

- **CHANGELOG.md** — added a `Changed` bullet under `## [8.0.2]` describing the new `Manifest compat` preflight + accept/retry/ignore/exit prompt.
- **README** verified — no updates needed (build-tooling internal; no product fact changed).
- **package.json / package-lock.json** — `@types/vscode` aligned to `^1.105.0`; version reflects the in-progress 8.0.2 release.
- Guides reviewed — no user-facing behavior changed.
- LAUNCH_TEST — N/A (no extension feature changed).
- No bug archive — task did not close a `bugs/*.md` file.

### Files changed

- `scripts/modules/publish/checks_prereqs.py` — new `check_manifest_compat`, `_handle_manifest_mismatch`, `_align_types_to_engine`, `_types_vscode_spec`, `_range_version`; imports `json`/`os`/`re` + `fix`/`prompt_fix_action`.
- `scripts/modules/publish/display.py` — new reusable `prompt_fix_action(problem, suggestions, accept_label)` → `accept|retry|ignore|exit`.
- `scripts/modules/publish/orchestrator.py` — register `Manifest compat` step in `run_prerequisites`; import the new check.
- `scripts/publish.py` — `_STEP_EXIT_CODES["Manifest compat"] = PREREQUISITE_FAILED`.
- `CHANGELOG.md` — 8.0.2 `Changed` entry.
- `package.json`, `package-lock.json` — `@types/vscode ^1.105.0`; 8.0.2.
- `l10n/bundle.l10n.{de,es,fr,it}.json` — pre-existing bundle content (bundled per "commit the whole project").
- `plans/history/2026.06/2026.06.10/publish-manifest-compat-preflight.md` — this finish report.

### Outstanding

None for this fix. The tree is publish-ready: a re-run of `python scripts/publish.py` clears `Manifest compat` at Step 1 and proceeds through Package.

Finish report saved: plans/history/2026.06/2026.06.10/publish-manifest-compat-preflight.md

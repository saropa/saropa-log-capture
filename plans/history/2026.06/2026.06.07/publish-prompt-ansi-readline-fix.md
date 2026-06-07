# Publish-script prompts hidden on Windows (ANSI + pyreadline3)

User report: "all the user prompts in the publish script are obscured and I have to press escape to see the question, which erases the previous line giving context." The publish pipeline (`scripts/publish.py`) became unusable interactively on Windows — every prompt's question text stayed invisible until a keypress forced a redraw, and that redraw wiped the line of context printed above it.

## Finish Report (2026-06-07)

**This work will be reviewed by another AI.**

### Scope

**(C) docs/scripts only** — Python developer publish pipeline under `scripts/modules/publish/`, plus a CHANGELOG Maintenance note. No Flutter/Dart app code (A) and no VS Code extension TypeScript (B) was touched.

### Root cause

On Windows, `_load_readline_module()` ([version.py:215](../../../../scripts/modules/publish/version.py)) loads the pyreadline3 `readline` shim (`site-packages/readline.py` → `pyreadline3.rlmain.Readline`). pyreadline3 measures a prompt's display width by **raw character count** and does **not** strip ANSI escape sequences (nor honor the GNU-readline `\001`/`\002` invisible-width markers reliably). Every interactive prompt passed color codes (`\033[..m`) inside the `input()` prompt string, so pyreadline3 over-counted the width. Result: the prompt rendered wrong (question "obscured"), and the first redraw — triggered by any keypress, e.g. Escape — did a carriage-return reprint that erased the context line printed just above the input.

### Fix

Make every `input()` prompt **plain ASCII** (zero escape sequences) and move the colored question/options to their own printed line above the editable line. That confines pyreadline3's carriage-return redraw to the editable line, so the context above survives, and the width math is correct because there are no escapes to miscount. This is implementation-agnostic (works on GNU readline and pyreadline3 alike), unlike `\001`/`\002` wrapping which pyreadline3 does not reliably support.

Four prompt sites:

- `ask_yn` — [display.py:44-59](../../../../scripts/modules/publish/display.py). Prints `question [Y/n]:` in color on its own line; reads with `input("  > ")`. Covers Proceed-with-publish, Install-now, Open-report (all route through `ask_yn`).
- `_prompt_on_test_failure` — [orchestrator.py:57-76](../../../../scripts/modules/publish/orchestrator.py). Dropped trailing `{C.RESET}` from the `Choice [t]:` prompt; options already print on their own lines.
- `ask_publish_stores` — [orchestrator.py:216-234](../../../../scripts/modules/publish/orchestrator.py). Dropped `{C.RESET}` from the `Choice [3]:` prompt.
- `_prompt_version` — [version.py:240-280](../../../../scripts/modules/publish/version.py). Colored `Version (Enter = X):` now prints on its own line; the editable line is plain `  > ` with the suggested version still pre-filled via the readline startup hook.

Each site carries a WHY comment naming the pyreadline3 mismeasurement so a later reader does not reintroduce ANSI into a prompt.

### Deep review notes

- **Logic & safety:** No control-flow changes — the parsed answers, EOF/KeyboardInterrupt handling, default values, and prefill hook are all unchanged. Only the prompt string and the addition of a preceding `print()` line differ.
- **Architecture:** `C` (color constants) is still imported and used by the surrounding `print()` calls in all three files — no dead import introduced.
- **Refactoring:** the four sites share an identical "print colored line, read plain line" shape. A shared helper (e.g. `prompt_plain(question, reader)`) was considered and rejected — the global rule is "no premature abstraction (wait for 3+ uses)" but the four call sites differ enough (prefill hook, `or "3"` default, `.lower()`, multi-line option lists) that a helper would need several flags and would obscure more than it saves. Left inline.

### Testing

- **Existing-test audit (mandatory):** grepped `scripts/` and `src/` for `ask_yn`, `_prompt_version`, `ask_publish_stores`, `_prompt_on_test_failure`, `pyreadline`, `readline` in any `*test*` file — **zero** test references. There is no Python test harness in this repo (no `*test*.py` under `scripts/`, no `pytest`/`ruff`/`flake8`/`pyproject.toml` config); the extension's TS test suite under `src/test/` does not exercise the publish pipeline.
- **Verification performed:** `python -m py_compile` on all three files → OK. `ast.parse` on all three → OK. Confirmed by grep that no `input()` prompt in `scripts/modules/publish/` contains any `C.` color reference.
- **Not executed:** the interactive prompts cannot be driven in a non-TTY environment (`_prompt_version` early-returns when `not sys.stdin.isatty()`), so the on-screen rendering fix is verified by inspection + the documented pyreadline3 behavior, and must be confirmed by the user on a real Windows terminal (see What to test).

### Project maintenance

- CHANGELOG: Maintenance note added under `[Unreleased]` (committed in `62e0274a` ahead of this commit, bundled by an intervening commit).
- README verified — no updates needed (publish-script internals are not documented in README).
- guides reviewed — no user-facing product behavior changed.
- LAUNCH_TEST: not applicable — `docs/LAUNCH_TEST.md` covers extension end-user features, not the developer publish script.
- No bug archive — task did not close a `bugs/*.md` file.

### Files changed in this commit

- `scripts/modules/publish/display.py`
- `scripts/modules/publish/orchestrator.py`
- `scripts/modules/publish/version.py`
- `plans/history/2026.06/2026.06.07/publish-prompt-ansi-readline-fix.md` (this report)

### Outstanding work

None. On-device confirmation on a Windows terminal is the only remaining verification (it cannot be automated here).

---

## Finish Report — Revision 2 (2026-06-07): root cause was pyreadline3, not ANSI width

The first fix above was wrong. It treated the symptom (ANSI codes miscounted by readline) instead of the cause (readline itself). It made things worse. Recording the attempt history per the "2+ failed attempts" rule.

### Attempt log

1. **Pre-existing state (the bug):** every `input()` prompt carried ANSI color codes in a single-line prompt string. The bootstrap in `scripts/publish.py` imported `pyreadline3` (for version pre-fill), which routes ALL `input()` through it. Symptom: "prompts obscured, press Escape to see the question, which erases the previous line."

2. **Attempt 1 (commit `f730f858`, REVERTED here):** kept pyreadline3; moved the colored question to its own `print()` line and made the `input()` prompt a plain `  > `. Theory: ANSI width miscount + redraw erasing the line above. Result: **worse** — the `ask_yn` prompts showed only `  >` (the question line vanished), and the "Proceed with publish?" prompt rendered the cursor jumped UP into the middle of the printed question (`Pr_ceed`). Proof that pyreadline3 cannot track the cursor in the VS Code terminal — a separate printed line is not just miscounted, it is overwritten / the cursor lands on the wrong row.

3. **Attempt 2 (this revision) — DIFFERENT approach:** stop using readline at all. Removed the `pyreadline3` bootstrap import from `scripts/publish.py` and deleted `_load_readline_module` / `_clear_readline_startup_hook` and the pre-fill from `version.py`. Native `input()` (used only when no `readline` module is imported) writes the prompt directly to the terminal, so VS Code renders ANSI color and tracks the cursor correctly. Restored the original colored single-line prompts in `ask_yn` and `_prompt_version`. **Why this is different from attempts 0/1:** those both kept pyreadline3 and tried to format around it; this removes the component that was corrupting the output. The cursor-row-jump in attempt 1's screenshot is terminal-incompatibility in pyreadline3's Windows-Console-API cursor positioning, which no prompt formatting can fix.

### Trade-off accepted

The version-bump prompt loses in-place pre-fill (the sole reason pyreadline3 was added). The suggested version is shown in the prompt (`Version (Enter = 7.17.3):`) and Enter accepts it; a different value is typed manually. A working, visible prompt is worth far more than in-place editing, and the pre-fill was non-functional anyway while every prompt was corrupted. If pre-fill is wanted back, it needs a readline-free mechanism (e.g. a terminal library that is VS-Code-terminal compatible) — a separate task, not a regression of this fix.

### Files changed in Revision 2

- `scripts/publish.py` — removed the pyreadline3 bootstrap import block (replaced with a comment explaining why readline is deliberately not loaded).
- `scripts/modules/publish/version.py` — deleted `_load_readline_module` and `_clear_readline_startup_hook`; `_prompt_version` now uses a colored single-line native `input()` with no pre-fill.
- `scripts/modules/publish/display.py` — `ask_yn` restored to a colored single-line native `input()`.
- `scripts/modules/publish/orchestrator.py` — comment-only update on the two choice prompts (pyreadline rationale no longer applies).
- `CHANGELOG.md` — Maintenance entry rewritten to describe the real fix.
- `plans/history/2026.06/2026.06.07/publish-prompt-ansi-readline-fix.md` — this revision.

### Verification (Revision 2)

`python -m py_compile` on all four scripts → OK. `python scripts/publish.py --help` runs (imports clean after removing the bootstrap). `grep` confirms no `import readline` / `import pyreadline` / `_load_readline` / `_clear_readline` remains in `scripts/`. On-screen rendering still requires user confirmation in the VS Code Windows terminal (cannot be driven non-TTY).

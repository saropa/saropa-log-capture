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

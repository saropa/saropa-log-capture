# translate_l10n.py — GPU enablement, live progress bar, graceful CTRL-C

**Triggered by:** the user ran `scripts/translate_l10n.py` option 5 (upgrade
low-quality → NLLB) and reported it "looks like a hang," then pasted
`[nllb] cuda/default load failed: Library cublas64_12.dll is not found` as "a
crash." Follow-up requests: a list of the next 15 developer languages, a written
plan for adding them, and "let me CTRL-C gracefully" because a full run can take
~20 hours and is repeatedly aborted. This task fixed the three tooling problems
(silent slow CPU run, missing-cuBLAS GPU fallback, unsafe cancel) and authored
the 15-language expansion plan. No bug file existed for any of it.

## Finish Report (2026-06-10)

### 1. Critical note

This work will be reviewed by another AI.

### 2. Scope

**(C) docs/scripts only** — Python build tooling under
`scripts/modules/verify/` plus a plan doc and ROADMAP/CHANGELOG entries. No
Flutter/Dart app code (this repo has none) and no VS Code extension TypeScript
(`src/`) was touched.

### 3. Deep review

- **GPU cuBLAS fix** (`l10n_nllb_engine.py`): root cause was that the
  `nvidia-cublas-cu12` wheel (already installed, v12.9.2.10) unpacks
  `cublas64_12.dll` under `site-packages/nvidia/cublas/bin`, and Python 3.8+ no
  longer loads dependent DLLs from `PATH`. `ctranslate2` lazy-loads cuBLAS at
  first inference, so the CUDA device constructed but the probe translation
  failed and the cascade silently fell to CPU. Fix: new
  `_register_cuda_dll_dirs()` registers every `nvidia/*/bin` dir via
  `os.add_dll_directory` (+ `PATH` for loaders that consult it), guarded by a
  one-shot module flag, called from `_ensure_model()` before the device cascade.
  No-op off Windows / where the wheel is absent. Verified in isolation:
  `ctypes.CDLL('cublas64_12.dll')` loads after the call; the NLLB model itself
  was deliberately NOT loaded (model load is out of scope and prohibited here).
- **Progress + messaging** (`l10n_actions.py`, `l10n_nllb_engine.py`): added
  `_print_progress_bar()` (a `\r` bar matching the audit coverage table) wired
  into the existing `on_progress` callback; added a "Loading model…" stderr line
  before the blocking ~7 GB load; reworded the device-cascade failure line from
  `load failed` to `unavailable, trying next fallback` so a CUDA→CPU step does
  not read as a crash.
- **Graceful CTRL-C** (`l10n_translator.py`, `l10n_actions.py`): extracted
  `_finalize_locale()` (orphan-prune + bundle/provenance save) and moved it into
  `translate_locale`'s `finally`. `KeyboardInterrupt` is a `BaseException`, so the
  retry / `_apply_translation` `except Exception` blocks never swallow it — it
  propagates to the `finally`, which persists everything translated so far, then
  re-raises. `run_translate` catches it and prints a clean
  "Cancelled — progress saved… Re-run to resume" instead of a traceback. Because
  a re-run keeps already-translated keys (`gaps` skips non-English values;
  `low_quality` skips `nllb`-provenance keys), cancellation becomes a resumable
  pause.
- **Safety/architecture:** no new dependencies; reused the project's existing
  provenance/save helpers; functions stay within size limits (`translate_locale`
  got shorter via the extraction). No duplicate logic introduced.

### 4. Testing validation

**A. Existing-test audit (mandatory):** grepped the repo for the changed
symbols. The only test touching changed files is
`scripts/modules/verify/test_l10n_nllb_engine.py`. It pins `_flores_code`,
`_mask_format_placeholders`/`_unmask`, `_candidate_cache_dirs`, and
`is_available` under `SAROPA_SKIP_NLLB` — **none of which I changed** — and it
explicitly does not exercise model load or translation. No assertion broke.
Baseline run: 11 tests, OK.

**B. New tests:**
- `test_l10n_nllb_engine.py` → `CudaDllRegistrationTests` (2 tests):
  `_register_cuda_dll_dirs()` sets its one-shot guard, never raises, and is a
  no-op on the second call.
- `test_l10n_translator.py` (new file, 3 tests) → `FinalizeLocaleTests`:
  `_finalize_locale()` prunes keys absent from the canonical set, keeps canonical
  keys, and writes nothing to disk under `dry_run=True`.

**Commands run (Python 3.14.5):**
- `python -m unittest modules.verify.test_l10n_nllb_engine` → **13 tests, OK**
- `python -m unittest modules.verify.test_l10n_translator` → **3 tests, OK**

`_print_progress_bar()` has no automated test (display-only formatting; its one
real edge case, `total == 0`, is guarded with `if total else 1.0`). The
graceful-cancel save path's loop integration was reasoned through (BaseException
propagation + `finally`) and the extracted `_finalize_locale` is unit-tested;
the live KeyboardInterrupt-mid-run behavior is left for the operator to confirm
(see What to test) because triggering it requires a real translation run.

### 5. Localization validation

SKIPPED [C-NOT-IN-SCOPE] — no Flutter/Dart UI strings and no extension TS UI
strings changed. (The `l10n/bundle.l10n.*` content changes in the working tree
are the operator's separate translation-run output, not part of this task.)

### 6. Project maintenance & tracking

- **CHANGELOG.md:** 2 bullets added under `## [8.0.1] → ### Changed` (graceful
  CTRL-C; GPU + progress bar + reworded fallback). Present in the working file
  (lines 48–49) but **left uncommitted** — see Section 9 entanglement note.
- **README:** verified — no updates needed (shipped language count unchanged;
  the 15-language expansion is planned, not shipped).
- **package.json / lock:** SKIPPED — no release or dependency change.
- **ROADMAP.md:** added plan 058 under "Unscored — needs Wow/Effort assignment."
- **Plans:** created `plans/058_plan-expand-translation-locales.md` (active).
- **Guides:** reviewed — nothing user-facing changed.
- **LAUNCH_TEST.md:** N/A — not present in this repo.
- **Bug archival:** No bug archive — task did not close a `bugs/*.md` file.

### 7. Persist finish report

Finish report saved:
`plans/history/2026.06/2026.06.10/translate-l10n-gpu-progress-graceful-cancel.md`
(this file, Case B — no pre-existing bug/plan was closed; plan 058 is newly
created and remains active with Phases 1–2 open).

### 8. Files changed (this task)

- `scripts/modules/verify/l10n_nllb_engine.py` — `_register_cuda_dll_dirs()` +
  call site; loading notice; reworded fallback message.
- `scripts/modules/verify/l10n_translator.py` — `_finalize_locale()`; save moved
  into `finally`.
- `scripts/modules/verify/l10n_actions.py` — `_print_progress_bar()`;
  KeyboardInterrupt handler in `run_translate`.
- `scripts/modules/verify/test_l10n_nllb_engine.py` — `CudaDllRegistrationTests`.
- `scripts/modules/verify/test_l10n_translator.py` — new (FinalizeLocaleTests).
- `plans/058_plan-expand-translation-locales.md` — new (active plan).
- `ROADMAP.md` — plan 058 row.
- `plans/history/2026.06/2026.06.10/translate-l10n-gpu-progress-graceful-cancel.md`
  — this report.

### 9. Entanglement note (not committed by this task)

The working tree also contains a separate publish/translation workstream that
predates this task and is left for the operator to commit:

- `CHANGELOG.md` (−235) / `CHANGELOG_ARCHIVE.md` (+228): a clean rotation of
  versions 7.8.0–7.11.2 into the archive. My 2 changelog bullets live in
  `CHANGELOG.md` and will commit alongside this rotation.
- `l10n/bundle.l10n.{de,es,json}.json` and `l10n/provenance/{de,es}.json`:
  output of an NLLB translation run (shipped MT content; provenance-stamped).

These were excluded so this commit stays scoped to the tooling + plan, and so
shipped machine-translation content is committed under the operator's own
verified action rather than folded into a tooling commit.

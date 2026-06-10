# NLLB-200-3.3B translation engine for the l10n pipeline

**Triggered by:** the user asked to review the Saropa Contacts `setup_arb_translate.py` NLLB pipeline and then said, verbatim, "i want the best translation quality and that is NLLB" and "fix it! i said we are going to use nllb" — i.e. make NLLB the actual translation engine for saropa-log-capture's bundle translation, replacing the silent Google-only path.

The log-capture l10n pipeline translated UI bundles via Google Translate (`deep-translator`), the lowest-quality tier. This task adds an offline Meta NLLB-200-3.3B engine (via CTranslate2) as the primary engine with Google as an automatic fallback, wires it into the existing `translate_locale` flow without disturbing brand-shielding / validation / bundle-merge, and makes the engine choice visible per run.

## Finish Report (2026-06-09)

**Reviewed by another AI.**

### Scope
(C) docs/scripts only — Python build tooling under `scripts/`. No Flutter/Dart (none in this repo) and no TypeScript extension code touched.

### What changed
- **New** `scripts/modules/verify/l10n_nllb_engine.py` — self-contained NLLB engine vendored from the battle-tested parts of the contacts pipeline:
  - Device cascade CUDA float16 → CPU int8 → CPU float16, each with a probe-translate that catches lazy cuBLAS/MKL failures at load time.
  - Per-string wall-clock deadline via daemon thread (CTranslate2 has no cancel API); a degenerate input falls back to English instead of wedging the run.
  - Source-token gate, greedy decode (`beam_size=1`, `repetition_penalty=1.2`, `no_repeat_ngram_size=3`, input-scaled `max_decoding_length` capped at 256).
  - `{0}`/`{count}` format-placeholder masking to copy-through tokens (NLLB mangles braces; the Google path tolerated raw braces, so masking is engine-internal).
  - 12-entry FLORES-200 map for the project's exact locales, with base-subtag fallback.
  - **Never auto-downloads** the ~7 GB model. `is_available()` only checks importability + on-disk cache. `_resolve_model_path()` probes `SAROPA_NLLB_MODEL_DIR` → HF default cache → `<drive>\tools\meta_nllb` (the contacts convention) so an already-downloaded model is reused.
  - Session `_load_failed` flag so a broken device cascade is probed once, not per locale.
- **Modified** `scripts/modules/verify/l10n_translator.py`:
  - New `_make_translator(locale)` → `(translator, engine)`: NLLB when available, else Google. Signature/return of `translate_locale` unchanged (callers `translate_l10n.py` and `checks_build.py` untouched).
  - Socket timeout + inter-call throttle + rate-limit circuit breaker now gated to `engine == "google"` (NLLB is local, never throttles).
  - `_announce_engine()` prints the chosen engine once per run, with the fallback reason, so a silent Google fallback can no longer hide.
- **Modified** `scripts/translate_l10n.py` — header note (version 1.3.0) documenting NLLB-first behavior, the deps, the one-time model download, and the `SAROPA_SKIP_NLLB=1` kill switch.
- **New** `scripts/modules/verify/test_l10n_nllb_engine.py` — 11 pure-logic unit tests (no model/deps): FLORES mapping incl. zh-cn/zh-tw split and pt-br base fallback, placeholder mask/unmask round trip, cache-dir candidate ordering + env override, and the `SAROPA_SKIP_NLLB` gate.
- **CHANGELOG.md** — `[Unreleased]` entry was authored for this work but was swept into an unrelated parallel commit (`bf592a2f`, a context-menu fix) by a concurrent session committing to this same branch. It is therefore already in git history, not in this task's commit. Content is correct and honest (tooling capability only; no regenerated translations ship).

### Deep review notes
- Double-checked locking on the model singleton (`_load_lock`); `_load_failed` set inside the lock.
- Daemon-thread deadline: the abandoned worker may append to the result box after timeout — benign (discarded). Worker exceptions are re-raised on the main thread.
- NLLB misses (timeout / over-length / echoed-source) return `None`, which the existing caller maps to "keep English" → counted as a healthy "validate_fail", never "net_fail", so the rate-limit breaker cannot spuriously trip on NLLB.
- Brand tokens (`<B0>`) are NOT re-masked; the existing `validate_brands` + one-retry + None-fallback path is the backstop if NLLB perturbs them.

### Tests
- `python -m unittest modules.verify.test_l10n_nllb_engine -v` → **11 passed**.
- `python -m py_compile` on all changed files → clean.
- Import smoke (NLLB disabled and with auto-discovery) → engine + translator import with stdlib only; `is_available()` correctly False under `SAROPA_SKIP_NLLB=1` and True via on-disk model auto-discovery with no env var.
- Existing-test audit: no `*.test.ts` references any changed Python symbol; no Python test harness previously existed.

### Maintenance
- README verified — the Translations section lists locales only (no engine description); no update needed. The 11-locale count and shipped languages are unchanged.
- ROADMAP.md — no translation/NLLB entry; this was a direct user request, not a tracked roadmap item. Not modified.
- `package.json` — unchanged (Python deps are not tracked there; documented in the script header instead).
- No bug archive — task did not close a `bugs/*.md` file.
- `docs/LAUNCH_TEST.md` — does not exist in this project; not applicable.

### Not verified (cannot be, by policy)
The actual NLLB translation *output quality* and the live GPU/CPU device path are **unverified by me** — running an NLLB translation job is a hard prohibition I hold to (an unattended NLLB GPU job previously locked the user's machine). All setup is done and the engine resolves the cached model; the translation run itself is the user's to start.

### Repository anomaly noted
The branch `feat/reports-bucket-and-newer-alert` advanced during this session through unrelated commits made by a concurrent session (HEAD moved from `d3a8e0d3` to `3634ea9a`; drag-drop/flow-map/context-menu work). My CHANGELOG edit was swept into `bf592a2f`. The three Python files plus the test and this report remained cleanly isolated in the working tree and are committed together as the atomic NLLB change.

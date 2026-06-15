# translate_l10n.py — progress diagnostics, sentence-mode translation, and honest NLLB fallback

The l10n translation tool (`scripts/translate_l10n.py` and its `scripts/modules/verify/l10n_*`
modules) drives multi-hour NLLB / Google translation passes over the viewer's runtime string
bundles. Several operator-facing defects made those long runs hard to read and, in one case,
actively misleading: the live progress bar showed only a percentage with no throughput or
finish-time estimate; per-string failures were printed inline but never collected anywhere
durable; the gap-export step blocked on an interactive prompt; long paragraphs were sent to the
engine whole (where NLLB silently truncates and bleeds context across sentences); the per-locale
label printed before the one-time model-load output, stranding it above the engine setup noise;
and — most seriously — when a cached model failed to load on every device, the fallback reported
"NLLB model not cached (~7 GB)", telling the operator to re-download a model already on disk
instead of addressing the real cause (host-memory allocation failure).

## Finish Report (2026-06-15)

### Scope

(C) docs/scripts only — Python build tooling under `scripts/modules/verify/` plus `CHANGELOG.md`.
No Flutter/Dart app code and no VS Code extension TypeScript was touched.

### What changed and why

**Live throughput + ETA on the progress bar.** `translate_locale` now tracks a running
source-word total and passes it to the progress callback (signature widened to
`on_progress(done, total, words)`). The renderer computes words-per-minute and a remaining-time
estimate from measured per-item time, formatted `H:MM:SS`. The clock starts on the first
translated string, so the one-time ~7 GB model-load is excluded from the rate; the readout is
suppressed for the first sub-second tick to avoid a divide-by-zero and a meaningless first number.
A trailing CSI erase clears stale digits as the ETA shrinks.

**Run-wide error audit file.** Every non-success outcome — network/engine errors and
brand-validation rejects — is collected across all locales and flushed to
`reports/YYYY.MM/YYYY.MM.DD/*_l10n_translation_errors.json`, matching the existing audit-report
path convention. Each record carries the untruncated English source and a reason; the file also
holds per-locale and per-type counts. A clean run writes no file. Inline `WARN` lines are
unchanged.

**Gap export no longer prompts.** When gaps remain on an interactive run, both JSON and CSV
exports are written unconditionally and both paths printed, instead of presenting a 1/2/0 menu.
The two formats serve different consumers (JSON for re-import tooling, CSV for spreadsheets /
external translators). Non-interactive runs still skip the export.

**Sentence-by-sentence translation (default on).** A multi-sentence source string is split on its
sentence boundaries (`. ! ?` followed by whitespace), each sentence translated independently, and
the results rejoined. The splitter captures the inter-sentence whitespace as its own segment, so
the rejoin is lossless — original spacing and newlines survive verbatim. Both engines, NLLB
especially, produce materially better output on single sentences than on long paragraphs, which
risk silent truncation at the model's token limit and cross-sentence context bleed. If any
sentence in a string fails, the whole string keeps English for a clean re-run rather than shipping
a half-translated paragraph. Brand shielding and validation now run per sentence. A new
`--paragraph-mode` CLI flag restores the prior whole-string behavior; single-sentence strings are
unaffected either way. The mode is held as a module flag set once per run (`set_sentence_mode`)
rather than threaded through the call chain, which already sits at the parameter limit.

**Locale label no longer stranded above the NLLB setup output.** The per-locale label was printed
before `translate_locale` ran, so the one-time model-load and engine-selection lines landed
underneath it. The label is no longer pre-printed; the progress bar (which reprints the label every
tick) supplies it, and dry-run / no-work locales get a labeled summary line via an explicit branch.

**Honest NLLB-fallback diagnosis.** The device-load cascade now captures each device's error
string instead of discarding it, and records the aggregate in module state. `cache_hint()` was
rewritten to diagnose the actual blocker — disabled by env, deps missing, model genuinely absent,
or cached-but-no-device-loaded — rather than always claiming "not cached" whenever the deps were
importable. The cached-but-failed case now reports the real device errors (e.g.
`mkl_malloc: failed to allocate memory`) and names concrete remedies (free RAM and re-run, force
CPU with `SAROPA_NLLB_DEVICE=cpu`, install `nvidia-cublas-cu12` for GPU). The fallback prints a
red `⚠ WARNING: NOT using offline NLLB` block so the switch to the lower-quality online engine is
loud, not silent.

### Files changed

- `scripts/modules/verify/l10n_actions.py` — WPM/ETA readout, `_format_duration`, error-sink
  collection + audit write, gap-export-without-prompt, label-stranding fix.
- `scripts/modules/verify/l10n_translator.py` — `on_progress` widened to carry words; `error_sink`
  threaded into `_apply_translation`; `_translate_one` refactored into `_translate_segment` +
  `_translate_segments` + `_split_sentences`; sentence-mode flag and `set_sentence_mode`; loud
  fallback warning.
- `scripts/modules/verify/l10n_bundle_audit.py` — `write_translation_error_audit`.
- `scripts/modules/verify/l10n_cli.py` — `--paragraph-mode` flag wired to `set_sentence_mode`.
- `scripts/modules/verify/l10n_nllb_engine.py` — `_try_load_device` returns the error; cascade
  aggregates failures into `_load_failure_detail`; `cache_hint` diagnoses the true blocker.
- `scripts/modules/verify/test_l10n_translator.py` — tests for `_split_sentences` (lossless
  round-trip, single vs multi sentence) and `set_sentence_mode`.
- `scripts/modules/verify/test_l10n_nllb_engine.py` — tests for `cache_hint` (skip-env message;
  cached-but-device-failed reports the real reason and does not claim "not cached").
- `CHANGELOG.md` — `[Unreleased]` Maintenance / Build tooling entries.

### Verification

- `python -m unittest modules.verify.test_l10n_translator` — 7 tests pass (was 3).
- `python -m unittest modules.verify.test_l10n_nllb_engine` — 15 tests pass (was 13).
- `python -m py_compile` clean on all five changed modules and both test files.
- Sentence-splitter round-trip verified lossless across single-sentence, multi-sentence,
  newline-separated, multi-space, and trailing-separator inputs.
- WPM/ETA math and `H:MM:SS` formatting verified across early, mid, and near-complete ticks, with
  the first-tick suppression confirmed.
- `cache_hint()` confirmed to emit the device-failure detail and omit "not cached" for the
  cached-but-OOM state.
- No Python linter (ruff) is configured in this environment; static checks limited to byte
  compilation and the unit tests above.

### Out of scope / not done

- The machine-translation pipeline itself was not run; these are tooling changes only. Operator
  remains responsible for running NLLB/Google passes.
- The three modules `l10n_translator.py`, `l10n_nllb_engine.py`, and `l10n_bundle_audit.py` exceed
  300 lines when docstrings are counted. They predate these changes at that size and no linter
  enforces the limit on Python here; a future split into smaller modules (the established
  `l10n_*` extraction pattern) is the cleanup path if enforcement is added.

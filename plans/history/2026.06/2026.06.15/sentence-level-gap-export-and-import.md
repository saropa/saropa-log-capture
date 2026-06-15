# Sentence-level l10n gap export with a reassembling import

The l10n gap export (`scripts/translate_l10n.py`) listed each untranslated string as a whole
paragraph and its on-screen instructions pointed at a `--import <file>` command that did not exist
anywhere in `scripts/` — so an external translator received multi-sentence blocks and had no way to
get their work back into the bundles. Whole-paragraph translation is also lower quality than
per-sentence translation, the same reason the engine path already splits internally. The export now
emits one fill box per sentence and a real import reassembles them losslessly into the whole-string
keys.

## Finish Report (2026-06-15)

### Scope

(C) docs/scripts only — Python build tooling under `scripts/modules/verify/` plus `CHANGELOG.md`.
No Flutter/Dart app code and no VS Code extension TypeScript was touched.

### What changed and why

**Shared sentence segmenter (`l10n_sentences.py`).** A new module exposes `split_segments` (the
lossless splitter: sentence and whitespace-separator segments, `"".join(...) == source`) and
`sentence_parts` (just the translatable sentences). It is the single source of truth used by three
consumers — the engine's per-sentence translation, the gap export, and the import reassembly — so
they cannot disagree on where sentences begin. The translator's previously private
`_split_sentences` / `_SENTENCE_SPLIT_RE` were removed and the engine now calls `split_segments`,
eliminating the duplicate regex.

**Sentence-level export (`write_gap_export_sentences` in `l10n_bundle_audit.py`).** Writes
`*_l10n_gaps_sentences.json`: a nested per-key structure where each entry keeps the whole `en` plus
a `sentences: [{i, en, translation}]` list, one fill box per source sentence. JSON only — a flat
CSV would lose the per-key grouping. A gap with no splittable sentence content falls back to a
single box over the whole value so every gap is always fillable. The interactive audit export and
the non-interactive `--run-mode audit` gap export both now produce this file; the publish
pipeline's separate whole-string CSV worklist (`write_gap_export`) is untouched.

**Reassembling import (`import_gap_file` in `l10n_translator.py`, CLI `--import <file>`).** Reads
the filled JSON and, per entry, re-splits the English with the same `split_segments` and replaces
each sentence segment (in order) with its translation, leaving the captured whitespace separators
untouched — so spacing and newlines are restored exactly without the export ever carrying
separators. Reassembled values are written to `l10n/bundle.l10n.<locale>.json` and stamped
provenance `manual` (a high-quality engine in the provenance model), which is what stops the NLLB
low-quality upgrade pass from later overwriting hand-translated work. A key is skipped — left
untranslated, counted in the summary — when its filled sentence count drifts from the source (a
translator merged or split sentences) or any sentence translation is blank, so a partial fill can
never store a half-translated string.

### Files changed

- `scripts/modules/verify/l10n_sentences.py` — NEW. `split_segments`, `sentence_parts`.
- `scripts/modules/verify/l10n_translator.py` — use shared `split_segments`; add
  `_reassemble_sentences`, `_merge_into_bundle`, `import_gap_file`; import `ENGINE_MANUAL`.
- `scripts/modules/verify/l10n_bundle_audit.py` — add `write_gap_export_sentences`
  (`write_gap_export` retained for the publish CSV worklist).
- `scripts/modules/verify/l10n_actions.py` — interactive auto-export now writes the sentence-level
  JSON and prints the `--import` next step.
- `scripts/modules/verify/l10n_cli.py` — `--import` argument, `_run_import` dispatch, non-interactive
  gap export switched to the sentence form.
- `scripts/modules/verify/test_l10n_sentences.py` — NEW. Splitter round-trip + `sentence_parts`.
- `scripts/modules/verify/test_l10n_translator.py` — reassembly tests (lossless rejoin, count-drift
  skip, blank skip, single sentence).
- `CHANGELOG.md` — `[Unreleased]` Build-tooling entry (supersedes the prior JSON+CSV gap-export
  entry from the same unreleased cycle).

### Verification

- `python -m unittest` — `test_l10n_sentences` (5), `test_l10n_translator` (9), `test_l10n_nllb_engine`
  (15), `test_l10n_provenance` all pass.
- `py_compile` clean on all five changed modules and both test files.
- Reassembly verified directly: separators (spaces and `\n`) preserved on rejoin; identity-fill
  round-trips to the source byte-for-byte; count drift and blank sentence each return None (skip);
  single-sentence strings reassemble.
- `import_gap_file` verified end-to-end with the bundle write stubbed: 3 written, 1 skipped (count
  drift), grouped correctly by locale with separators intact.
- `translate_l10n.py --help` lists `--import` and `--paragraph-mode`.
- Test audit: only the two new test files reference the changed symbols; no pre-existing test
  pinned them, so none broke. The publish pipeline's `write_gap_export` caller (`checks_build.py`)
  is unaffected.
- No Python linter (ruff) is configured here; static checks limited to byte compilation and the
  unit tests above.

### Out of scope / not done

- The machine-translation pipeline was not run; these are tooling changes only.
- Sentence-mode export is JSON only by decision; a spreadsheet (CSV) sentence form was not added.
- Abbreviation over-split (e.g. "e.g.") remains a known splitter limitation; the import's
  count-match guard turns any resulting drift into a skipped key rather than a corrupted one.

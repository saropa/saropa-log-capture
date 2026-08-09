# l10n Verified-Identical Reset/Re-Translate Loop

`_key_action()` in the translation script did not consult `VERIFIED_IDENTICAL` (human-confirmed English-is-correct keys), so those keys were re-sent to the engine on every "translate gaps" run and reset back to English by the garbled-acronym sync on every sync — an infinite loop that also produced spurious errors on otherwise 100%-complete locales.

## Finish Report (2026-08-08)

### Problem

Running `python scripts/translate_l10n.py` (action 3, sync + translate gaps) repeatedly reported the same four keys as garbled and reset every single run, even immediately after a "COMPLETE" coverage audit:

```
de: reset 1 garbled — Perf
es: reset 1 garbled — local
fr: reset 1 garbled — Ver
it: reset 1 garbled — Display
```

The sync step (`_reset_garbled_acronyms` in `scripts/modules/verify/l10n_actions.py`) correctly detects when a `VERIFIED_IDENTICAL` key's stored value has drifted from English and resets it. But the very next translation pass treated those same keys (value == English key, no provenance) as untranslated gaps and re-sent them to the Qwen/NLLB engine, which produced:

- `de:"Perf"` → `"Leistung"` (a real German translation of an English loanword the team had manually pinned as identity)
- `es:"local"` → `"local /no_think"` (a Qwen prompt-artifact leak)
- `fr:"Ver"`, `it:"Display"` → engine happened to echo back the same value, so no visible drift, but still resent to the engine every run

On the next sync, the drifted keys (de, es) were detected as garbled and reset, and the loop repeated indefinitely. This also explains coverage reports showing "100.0% COMPLETE" for a locale in one section of output and then a translation pass immediately afterward that reports errors for that same locale — the "complete" locale still had en-copy values for its `VERIFIED_IDENTICAL` keys, which `_key_action` misclassified as gaps.

### Root cause

`_key_action()` (`scripts/modules/verify/l10n_translator.py:321`) gated identity handling on three locale-independent predicates only:

```python
if is_brand_only(en_key) or is_acronym_only(en_key) or is_no_translatable_content(en_key):
    return "identity"
```

It never called the per-locale `is_verified_identical(en_key, locale)` — the same predicate `is_forced_identity()` (used by both the coverage audit and the garbled-reset sync) already includes. The two code paths disagreed on what counts as "correctly identity," and the translator's narrower view kept re-opening a gap the sync had just closed.

### Fix

- `scripts/modules/verify/l10n_translator.py` (initial fix): added a `locale: str` parameter to `_key_action()` and an `is_verified_identical(en_key, locale)` check to the identity gate. Both call sites in `translate_locale()` now pass `locale=locale`.
- `scripts/modules/verify/l10n_translator.py` (follow-up hardening): replaced the four-predicate inline check in `_key_action()` with a single call to `is_forced_identity(en_key, locale)` — the same helper the coverage audit and garbled-reset sync already use. This closes the class of bug, not just this instance: any future divergence between `_key_action`'s notion of "identity" and `is_forced_identity`'s is now structurally impossible, since there is only one definition. Removed the now-unused direct imports of `is_acronym_only`, `is_no_translatable_content`, `is_verified_identical` from `l10n_brands`; added `is_forced_identity` import from `l10n_provenance` (`is_brand_only` import retained — still used directly elsewhere in the file for brand-shielding logic).
- Manually reset the two bundles left corrupted from the run that surfaced this bug (the sync-then-immediately-re-corrupt cycle happened once more before the code fix landed): `l10n/bundle.l10n.de.json` `"Perf"` → `"Perf"` (was `"Leistung"`), `l10n/bundle.l10n.es.json` `"local"` → `"local"` (was `"local /no_think"`, a Qwen prompt-artifact leak). Provenance for both stamped to `"manual"` in `l10n/provenance/de.json` / `es.json`. `fr:"Ver"` and `it:"Display"` were already correct (the engine happened to echo the same value back).
- Added `KeyActionVerifiedIdenticalTests` to `scripts/modules/verify/test_l10n_translator.py`: asserts every key in `VERIFIED_IDENTICAL` (all locales) resolves to `"identity"` under scope `"gaps"`, and that an ordinary en-copy key still resolves to `"translate"` (regression guard against over-broadening the gate).
- `CHANGELOG.md`: one-line maintenance entry under `[9.3.10]`.

### Verification

`python -m unittest discover -s modules/verify -p "test_l10n*.py" -v` from `scripts/` — 94/94 pass, including the 2 new tests, both before and after the `is_forced_identity` refactor. The new test fails against the pre-fix code (confirmed by inspection: pre-fix `_key_action` had no `is_verified_identical`/`is_forced_identity` check, so it would have returned `"translate"` for every `VERIFIED_IDENTICAL` key).

Confirmed live: `python scripts/translate_l10n.py --run-mode audit` after the fix showed zero garbled-reset lines and all 10 locales COMPLETE (see follow-up sections below for the second round of live confirmation, after the broader classification gap was closed).

## Follow-up: deterministic (non-flaky) `validate_fail` errors on the same class of key (2026-08-08, same day)

### Problem

A live `translate gaps` run after the initial fix landed still reported 12 `validate_fail` errors (`Zoom` in 5 locales, `Commit` in 4, `File`/`Debug {0}` in `it`, plus one `it` sentence gap). These were initially — incorrectly — characterized as unrelated "engine flakiness." Comparing four translation-error reports generated earlier the same day (`20260808_195407`, `_200056`, `_204222`, `_212328`) showed the exact same keys failing identically, run after run, 100% reproducibly. Flakiness would show inconsistency; this did not.

### Root cause

The same classification gap as the primary fix, one layer deeper: several words had already been **manually verified as correct-identity translations** for specific locales — the bundle held the English value with `provenance: "manual"` — but were never added to the `VERIFIED_IDENTICAL` registry in `scripts/modules/verify/l10n_brands.py`. Because `_key_action` only trusts `VERIFIED_IDENTICAL` (via `is_forced_identity`), these keys still read as "untranslated gaps" every run, got re-sent to the local Qwen 8B model, and the model deterministically returned empty output for them (`validate_fail`) — most likely treating bare words like "Zoom" and "Commit" as proper nouns/brand names it won't translate.

Confirmed via `l10n/bundle.l10n.*.json` + `l10n/provenance/*.json` inspection: every failing key already had `value == key` with `provenance == "manual"` in its bundle/provenance pair, for every locale it failed in — i.e. a human had already settled the answer; the registry just didn't know it.

### Fix

Added the following to `VERIFIED_IDENTICAL` in `scripts/modules/verify/l10n_brands.py`, matching the bundle/provenance state already on disk:
- `"Zoom"` → de, es, fr, it, pt-br (was in none of them)
- `"Commit"` → es, fr, it, pt-br (was only in de)
- `"File"`, `"Debug {0}"` → it (only `"file"`/`"Debug"` lowercase/no-placeholder variants were already present)

The one genuine gap in this batch — `it` key `flowMap.exportSvgShotsOmitted` (`"({0} screenshot thumbnails were left out — they only load inside the panel)"`) — was **not** identity; it needed a real translation. Manually translated to `"({0} miniature screenshot omesse — si caricano solo all'interno del pannello)"`, matching existing `it` bundle terminology for "screenshot"/"pannello"/em-dash usage. Bundle value and provenance (`manual`) updated directly in `l10n/bundle.l10n.it.json` / `l10n/provenance/it.json`.

### Verification

`python -m unittest discover -s modules/verify -p "test_l10n*.py" -v` — 94/94 pass (the existing `KeyActionVerifiedIdenticalTests` regression guard automatically covers the new registry entries, since it iterates every locale/key in `VERIFIED_IDENTICAL`).

`python scripts/translate_l10n.py --run-mode audit` — all 10 locales report `COMPLETE`, including `it` (previously showed "1 untranslated"). Not re-run: a live `translate gaps` pass to confirm zero `validate_fail` errors for these specific keys end-to-end (would need the local Ollama/Qwen daemon; the fix removes them from the translate-candidate set entirely, so absence of a network call is the expected outcome, not something that needs the engine to confirm).

## Follow-up: terminal color semantics (2026-08-08, same day, user-requested)

### Problem

User: "stop using RED TEXT in table and output in the terminal unless errors." The `l10n_audit_display.py` coverage/provenance tables and `l10n_quality_audit.py` round-trip audit used red for routine gap/quality-signal states (missing keys, low-quality-engine counts, untranslated entries, quality-audit flags) — not actual runtime errors — making normal, expected output (e.g. `untracked:1162` in the provenance table, which is the default state for an NLLB/local-engine bundle) read as alarming.

### Fix

Changed `red(...)` → `yellow(...)` for all gap/quality-signal states in:
- `scripts/modules/verify/l10n_audit_display.py`: `_print_bundle_issues` (MISSING from bundle), `_coverage_status` (N missing / N untranslated), `_engine_breakdown` (low-quality engine counts), `_print_provenance_table` (Low-Q column), `print_untranslated_detail` (MISSING/EN-COPY tags). Removed the now-unused `red` import from this module; updated its module docstring to state red is reserved for runtime errors and never appears here.
- `scripts/modules/verify/l10n_quality_audit.py`: the round-trip audit's `FLAG` marker and flagged-count summaries.
- `scripts/modules/verify/l10n_actions.py`: `run_sync`'s "Removed: N orphan(s)" line (routine cleanup, not an error).

Left red as-is everywhere it represents a genuine runtime failure: translation errors kept as English fallback, rate-limit aborts, Qwen-not-ready / bundle-not-found preconditions, CLI errors (unknown locale, unknown choice, file not found).

### Verification

`python -m unittest discover -s modules/verify -p "test_l10n*.py" -v` — 94/94 pass (no test asserts on color, so this is a behavior-preserving presentation change; verified by re-running the full suite for regressions elsewhere in the same files). `python scripts/translate_l10n.py --run-mode audit` run live to confirm the CLI still executes correctly end-to-end with the color changes; grep of `l10n_audit_display.py` confirms zero remaining `red(` calls in that module.

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

Not re-run: the live Qwen/Ollama translation pass end-to-end (requires the local Ollama model and takes minutes per locale). The fix is verified at the unit level; the next real `python scripts/translate_l10n.py` run should show zero garbled-reset lines for `Perf`/`local`/`Ver`/`Display` and no gap reported for these keys on already-complete locales.

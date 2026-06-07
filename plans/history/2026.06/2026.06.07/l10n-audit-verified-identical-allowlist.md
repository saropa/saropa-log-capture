# l10n audit flagged verified cognates as "untranslated" on every publish

User request: "fill these localizations" — a `/publish` Step 9 run listed 39 strings still English in one or more locales (de/es/fr/it/ja/pt-br) and asked for hand translation. After review, most were genuine cognates/loanwords/abbreviations whose correct rendering IS the English word, so the user followed up: "ok, but i dont want the warnings. do we have an exclusion list?" The work corrected the three strings that were actually wrong and added a per-locale allowlist so the audit stops re-flagging the verified cognates.

## Finish Report (2026-06-07)

**This work will be reviewed by another AI.**

### Scope

**(C) docs/scripts/data only** — Python developer publish-pipeline tooling (the l10n bundle audit), VS Code extension NLS bundle data (`l10n/bundle.l10n.de.json`, `l10n/bundle.l10n.fr.json`), and a CHANGELOG Maintenance note. No Flutter/Dart app code (A) and no VS Code extension TypeScript source (B).

### Problem

`/publish` Step 9 emitted a `[WARN]` block listing 39 strings (58 locale×string pairs) "still English in one or more locales." The audit ([l10n_bundle_audit.py](../../../../scripts/modules/verify/l10n_bundle_audit.py)) counts any locale value equal to its English source as untranslated. Its existing skip lists ([l10n_brands.py](../../../../scripts/modules/verify/l10n_brands.py)) — `is_brand_only`, `is_acronym_only`, `is_no_translatable_content` — only cover strings forced English in **every** locale (brands like `Saropa Lints`; acronyms `SQL`/`ANR`/`OK`; symbol-only strings). They cannot cover **per-locale coincidences**: German "Pause"/"Audio"/"System", Spanish "Error"/"local", Italian "Debug"/"file", French "Sources"/"Session" are correct cognates in those locales but would be wrong in others (Spanish "Error" is correct, German is "Fehler"). The author had even *deliberately* kept `Dev`/`Perf`/`Ver`/`FATAL`/`Info`/`Debug` translatable (comment at l10n_brands.py) so a human decides per locale — which is exactly why they surfaced for review.

### Fix

Two parts.

**1. Corrected three strings that were genuinely wrong (not cognates):**

| Locale | English | Was (untranslated) | Now |
|---|---|---|---|
| fr | `Volume:` | `Volume:` | `Volume :` — French puts a space before colons; the rest of the fr bundle already does ("Taille de la police :") |
| fr | `Crashes` | `Crashes` | `Plantages` — correct French software term; the fr bundle already uses "plantages" in a full sentence. The English `-es` plural showed it was never translated |
| de | `Highlights: {0}` | `Highlights: {0}` | `Hervorhebungen: {0}` — the de bundle translates the highlight concept as "Hervorhebung" in 4 of 5 places |

**2. Added a per-locale verified-identical allowlist** so the audit stops counting confirmed cognates as gaps:

- `VERIFIED_IDENTICAL: dict[str, frozenset[str]]` in [l10n_brands.py](../../../../scripts/modules/verify/l10n_brands.py) — maps each locale to the English strings a human confirmed are correct as-is in that locale (36 entries across de/es/fr/it/ja/pt-br).
- `is_verified_identical(en_value, locale)` helper — per-locale lookup, mirroring the existing `is_brand_only` / `is_acronym_only` shape but keyed by locale (those are global; this is not).
- Wired into the `untranslated_keys` filter in [l10n_bundle_audit.py](../../../../scripts/modules/verify/l10n_bundle_audit.py) as `and not is_verified_identical(k, locale)`.

Audit-only. The translator's publish path (`only_missing=True`) already leaves en-copy keys in place (line 265), so these were never re-sent to Google; only the audit surfaced them. A *new* English-copy string that is not on the list still flags, so real gaps stay visible.

### Deep Review

- **Logic & Safety:** `is_verified_identical` uses `VERIFIED_IDENTICAL.get(locale, frozenset())` — unknown locale returns an empty set, so every key flags as before (fail-open toward surfacing gaps, never hiding them). No mutation, no recursion, no I/O.
- **Architecture & Adherence:** Follows the existing exclusion pattern in `l10n_brands.py` (frozensets + `is_*` predicate) rather than spawning a parallel mechanism. The audit gains one more `and not …` clause consistent with the three already there. No logic duplication.
- **Performance:** Set membership lookup per key; negligible against the existing per-bundle scan.
- **Documentation:** Both new symbols carry docstrings stating *why* this differs from the global brand/acronym lists (per-locale vs every-locale) and the rule for adding entries (confirm true cognate, not un-translated gap). The audit comment was extended to name the new category.
- **Refactoring:** None beyond scope.

### Testing Validation

**A. Existing-test audit (mandatory):**
- Grepped `src/test/` for `bundle.l10n`, `Volume:`, `Crashes`, `Highlights:`, `Plantages`, `Hervorhebungen` — **zero** matches. No TS test pins l10n bundle values.
- Grepped `scripts/` for `l10n_brands`, `is_verified_identical`, `VERIFIED_IDENTICAL`, `is_brand_only`, `is_acronym_only`, `l10n_bundle_audit`, `untranslated` in any `*test*.py` — **zero** matches. `scripts/modules/test/` holds only vscode-test runner helpers (`patch-vscode-test.js`, `run-coverage.js`, `run-vscode-test-file.mjs`), no Python unit tests.
- Confirmed no Python test harness exists (no `pytest.ini` / `conftest.py` / `pyproject.toml` / `tox.ini`; no `test_*.py` / `*_test.py` under `scripts/`).
- Conclusion: no existing test breaks.

**B. New-behavior verification:**
- No Python unit-test framework is present in the repo; adding pytest would be net-new infrastructure (out of scope without permission). Verified end-to-end instead by running the actual audit the publish pipeline uses:
  - `python -c "from modules.verify.l10n_bundle_audit import run_audit; ..."` → **TOTAL untranslated remaining: 0**, `has_gaps: False` (was 58 across locales before).
  - JSON validity of both edited bundles: `node -e "JSON.parse(...)"` → both valid.

### Localization (l10n) Validation — Flutter UI scope

SKIPPED [B-NOT-IN-SCOPE] — Section 5 governs the Flutter ARB pipeline (`lib/l10n/app_*.arb`, `flutter gen-l10n`, `remote_app_localizations.dart`). This project is a VS Code extension whose l10n uses the VS Code NLS bundle format (`l10n/bundle.l10n.*.json`), not Flutter ARB. The bundle edits here were validated by the publish audit above.

### Project Maintenance & Tracking

- **CHANGELOG:** Updated — Maintenance bullet under the in-progress 7.17.4 section naming the allowlist plus the three corrected translations.
- **README:** README verified — no updates needed (no product fact changed; the audit allowlist is internal tooling and the label corrections are not README-documented).
- **package.json / lock:** Not part of this task. (`package.json` shows as modified in the tree but predates this work and is unrelated — left unstaged.)
- **Guides:** guides reviewed — no user-facing guide affected.
- **LAUNCH_TEST:** No new or changed user-facing *feature*; the de/fr label corrections are minor copy fixes with no new flow to script.
- **Roadmap:** SKIPPED [C-NOT-IN-SCOPE] — no roadmap item involved.
- **Bug archival:** No bug archive — task did not close a `bugs/*.md` file.

### Finish report saved

`plans/history/2026.06/2026.06.07/l10n-audit-verified-identical-allowlist.md`

### Files changed

- `scripts/modules/verify/l10n_brands.py` — added `VERIFIED_IDENTICAL` dict + `is_verified_identical()`.
- `scripts/modules/verify/l10n_bundle_audit.py` — import + `and not is_verified_identical(k, locale)` in the untranslated filter; extended the explanatory comment.
- `l10n/bundle.l10n.fr.json` — `Volume:` → `Volume :`; `Crashes` → `Plantages`.
- `l10n/bundle.l10n.de.json` — `Highlights: {0}` → `Hervorhebungen: {0}`.
- `CHANGELOG.md` — Maintenance note.
- `plans/history/2026.06/2026.06.07/l10n-audit-verified-identical-allowlist.md` — this report.

### Outstanding work

None. The other 33 flagged strings are deliberately left as English (verified cognates) and silenced via the allowlist; that is the intended end state, not deferred work.

# Crashlytics issue-list strings localized to 100% across all locales

The 15 new Crashlytics issue-list strings introduced in release 8.1.0 (archive
and unarchive actions plus their confirmation toasts, the "Regressed" and
"Repetitive" badges and their tooltips, the sort-by labels, "Show archived", and
the background new-issue alerts) shipped present only in the English source
bundle. Every non-English locale fell back to English for these keys, and the
publish-time l10n audit reported each of the ten locales at 99% with 15 missing
strings. The runtime l10n bundles (`l10n/bundle.l10n.<locale>.json`) are keyed by
the exact English string value, so a key absent from a locale bundle renders the
English text verbatim in that locale.

## Finish Report (2026-06-12)

### Scope

(C) data only — runtime l10n translation catalogs, their provenance sidecars, and
the changelog. No TypeScript extension code and no Dart app code changed.

### What changed

- **Translations added** — for each of the ten locales (de, es, fr, it, ja, ko,
  pt-br, ru, zh-cn, zh-tw), the 15 Crashlytics strings were hand-translated and
  written into `l10n/bundle.l10n.<locale>.json`, keyed by their English source
  value per the VS Code `vscode.l10n.t()` convention.
- **Brand preservation** — the "Crashlytics" brand token is left untranslated in
  every locale, matching the brand-shielding the translation pipeline enforces,
  so the audit's `validate_brands` check does not flag the new entries.
- **Placeholder preservation** — every `{0}` positional placeholder in the four
  parameterized message strings is carried through unchanged in all locales.
- **Provenance tracked** — each new key is recorded as `manual` in
  `l10n/provenance/<locale>.json`. Without a provenance record a translated key
  is classified as `untracked` (low quality / upgrade candidate); the `manual`
  marker classifies these as high quality so they are not re-flagged for a future
  machine-translation upgrade pass.
- **Changelog** — a new `## [Unreleased]` section documents the localization
  under a `### Changed` entry, since 8.1.0 was already tagged and published.

### Why

The strings shipped English-in-locale in 8.1.0. Leaving them English defeats the
runtime l10n system for the entire Crashlytics issue list in nine languages and
keeps the publish audit below its 100% gate. Hand translation (not the
machine-translation pipeline) was used because the count is small and the strings
are short UI labels and alerts where quality matters.

### Verification

- `python scripts/translate_l10n.py --run-mode audit` — all ten locales report
  `100.0% COMPLETE` (previously 99%, 15 missing each). Provenance `manual` count
  rose by 15 per locale.
- The machine-translation pipeline (NLLB / Google) was **not** run. Adding
  source-language hand translations is independent of that operator-run step.
- No existing test pins these bundle values; the Crashlytics-signal tests
  (`crashlytics-issue-signals.test.ts`) cover the issue-classification logic,
  which is unchanged. The l10n audit is the verifier for translation-data changes.

### Files

- `l10n/bundle.l10n.{de,es,fr,it,ja,ko,pt-br,ru,zh-cn,zh-tw}.json` — +15 keys each
- `l10n/provenance/{de,es,fr,it,ja,ko,pt-br,ru,zh-cn,zh-tw}.json` — +15 `manual` keys each
- `CHANGELOG.md` — new `## [Unreleased]` section
- `plans/history/2026.06/2026.06.12/crashlytics-l10n-100pct.md` — this report

### Outstanding

None. All ten locales at 100%. The translations ride the next version bump as
unreleased work.

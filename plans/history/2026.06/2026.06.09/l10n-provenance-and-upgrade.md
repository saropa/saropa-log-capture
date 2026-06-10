# Translation provenance + low-quality upgrade pass

**Triggered by:** after the NLLB engine landed, the user asked whether running the
script would re-translate old Google output and "do you have providence?"
(provenance). It did not, and there was none. The user then directed, verbatim:
"do B and give me an option to translate gaps (no translation) or low-quality
translations. also the audio [audit] should show providence or assume low if
none (current)." This implements the Saropa Contacts provenance + upgrade model,
adapted to this project's flat bundles.

## Finish Report (2026-06-09)

**Reviewed by another AI.**

### Scope
(C) docs/scripts only — Python build tooling under `scripts/`. No Dart, no
TypeScript extension code.

### What changed
- **New** [l10n_provenance.py](../../../../scripts/modules/verify/l10n_provenance.py) — per-locale sidecar storage
  (`l10n/provenance/<locale>.json` = `{english_key: engine}`, atomic write, kept
  out of the `bundle.l10n.*` discovery glob) + the engine quality taxonomy.
  NLLB / manual / verified-identity = high quality; Google + other free MT +
  `untracked` (no record) + unknown = low. `is_low_quality`, `is_forced_identity`,
  `classify_translated_keys` (untracked-by-absence; identity-by-shape), `quality_split`.
- **Modified** [l10n_translator.py](../../../../scripts/modules/verify/l10n_translator.py):
  - Replaced the `only_missing` bool with a `scope` enum on `translate_locale`:
    `"missing"` (absent keys only — publish), `"gaps"` (absent + en-copy), and
    `"low_quality"` (re-translate existing weak/untracked keys — the Google→NLLB
    upgrade). New `_key_action` helper centralizes the per-key decision.
  - Stamps the producing engine into provenance on every successful write.
  - `_apply_translation` gained `keep_existing_on_failure` so a failed NLLB
    upgrade keeps the prior Google value instead of overwriting it with English.
  - **Bug fixed mid-task:** the translator was built at the top of
    `translate_locale`, so with NLLB as the engine a dry run or a no-op locale
    would load the 7 GB model and probe-translate. Engine construction now
    happens only when `not dry_run and total_todo > 0`.
- **Modified** [checks_build.py](../../../../scripts/modules/publish/checks_build.py) — publish call migrated
  `only_missing=True` → `scope="missing"`; the "via Google Translate" banner is
  now engine-neutral.
- **Modified** [l10n_bundle_audit.py](../../../../scripts/modules/verify/l10n_bundle_audit.py) — `LocaleCoverage`
  gains `engine_counts` + `high_quality_count`/`low_quality_count` properties;
  `run_audit` classifies the really-translated keys via provenance; report
  schema bumped to v2 with per-locale `engines` + quality split.
- **Modified** [l10n_audit_display.py](../../../../scripts/modules/verify/l10n_audit_display.py) — new colored
  Translation Provenance table (per-locale engine breakdown, High-Q/Low-Q
  columns, low/untracked engines in red).
- **Modified** [l10n_actions.py](../../../../scripts/modules/verify/l10n_actions.py) +
  [l10n_cli.py](../../../../scripts/modules/verify/l10n_cli.py) — `run_translate` gained `scope`; menu now offers
  gaps (3/4) and upgrade-low-quality (5/6) for all/specific locales, with a
  context-aware default that points at the upgrade pass once gaps are clear;
  `--scope gaps|low_quality` exposed to CI; brand-reset skipped for the upgrade
  pass (mangled brands re-translate directly as low quality).
- **New** [test_l10n_provenance.py](../../../../scripts/modules/verify/test_l10n_provenance.py) — 8 taxonomy tests.

### Tests
- `python -m unittest modules.verify.test_l10n_provenance modules.verify.test_l10n_nllb_engine` → **19 passed**.
- `py_compile` on all 8 touched files → clean.
- Audit smoke (`--run-mode audit`): the new provenance table renders; every
  existing translation classifies as `untracked` = Low-Q (e.g. de: 25 identity
  High-Q, 1173 untracked Low-Q) — the "assume low if none" behavior requested.
- Dry-run `translate_locale` for all three scopes runs WITHOUT loading NLLB and
  the counts reconcile with the audit (de: missing=70, gaps=83, low_quality=1173
  == the audit's untracked:1173).
- Existing-test audit: no `*.test.ts` references the changed Python symbols.

### Maintenance
- CHANGELOG updated (`[Unreleased]` → Changed).
- README verified — Translations section lists locales only; no engine/provenance
  detail there, no update needed.
- `package.json` unchanged. `docs/LAUNCH_TEST.md` absent (N/A).
- No bug archive — task did not close a `bugs/*.md` file.
- `l10n/provenance/` does not exist yet (created on the first real translate /
  upgrade run); it should be committed as translation metadata when it appears.

### Not verified (cannot be, by policy)
No translation was run — that is the user's to start (hard prohibition on
running NLLB). So actual upgraded output quality and the live model path are
unverified by me. The selection logic, counts, provenance stamping path, and
audit classification are verified by dry-run + unit tests + the audit smoke.

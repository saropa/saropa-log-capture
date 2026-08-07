# l10n Manual Gap Fill

25 untranslated strings remained across 10 locales after the trouble-chart legend keys and flow-map screenshot labels were added in v9.3.8. The audit flagged them as `[EN-COPY]` — bundle value identical to the English key with no provenance entry.

## Finish Report (2026-08-06)

### Problem

Five English source strings lacked locale translations:

| Key | English | Locales missing |
|-----|---------|----------------|
| `viewer.troubleChart.legend.database` | "DB {0}" | all 10 |
| `viewer.troubleChart.legend.debug` | "Debug {0}" | de, fr, it, pt-br |
| `viewer.troubleChart.legend.todo` | "TODO {0}" | 9 (all except zh-tw) |
| `flowMap.shot.title` | "Screenshot" | it |
| `flowMap.shot.trigger` | "Trigger" | it |

### Resolution

**Actual translations applied:**

- "DB {0}" → locale-native abbreviations where one exists: es/fr/pt-br → "BD {0}", ru → "БД {0}", zh-cn → "数据库 {0}", zh-tw → "資料庫 {0}". Kept as "DB {0}" in de/it/ja/ko (universally understood abbreviation, confirmed via manual provenance).
- "Debug {0}" → de: "Debuggen {0}", fr: "Débogage {0}", pt-br: "Depuração {0}". Italian kept "Debug {0}" (standard loanword, manual provenance).
- "TODO {0}" → kept as-is across all locales (universal programming term, manual provenance). zh-tw already had "待辦事項 {0}".
- "Screenshot" → it: "Schermata".
- "Trigger" → it: "Attivazione".

**Provenance:** all 25 entries marked `"manual"` in `l10n/provenance/<locale>.json`. The audit's gap detector exempts keys with manual provenance even when the value equals English (line 307 of `l10n_bundle_audit.py`).

### Prevention: `is_acronym_only` enhancement

The root cause was `is_acronym_only()` doing exact-match only — "DB" matched but "DB {0}" did not. Enhanced to strip `{n}`/`{name}` placeholders before checking, so acronym+placeholder patterns are now classified as identity automatically. This prevents the same class of gap from recurring when new acronym-based legend keys are added.

### Prevention: `--run-mode fill-identity`

New pipeline action (CLI `--run-mode fill-identity`, interactive menu option 8) that scans the audit's untranslated entries, identifies those where `is_acronym_only` returns true, and marks them as `"manual"` provenance in one step. Supports `--dry-run` for preview. This replaces the manual per-file provenance editing done for this batch.

### Hardening (follow-up)

**Dead-code fix:** `run_fill_identity` originally iterated the audit's `untranslated_entries` and checked `is_acronym_only` — but the audit already filters out acronym matches, so the check always returned False. Refactored to scan locale bundles directly for EN-COPY entries (value == key) without provenance that match `is_forced_identity()` (acronyms, brands, symbols, verified cognates).

**Confirmation prompt:** Interactive menu option 8 now previews with `--dry-run`, then asks "Apply? [y/N]" before writing provenance.

**ACRONYM_ONLY_STRINGS expanded:** Added "APP" (application badge) and "FW" (framework badge) — both had garbled MT output in all 10 locales (NLLB hallucinated sentences from 2–3 character inputs). A future translate pass will overwrite the garbled values with identity.

### Prevention: compile gate `verify:acronym-coverage`

New compile gate (`npm run verify:acronym-coverage`, wired into the compile chain) that scans every `strings-*.ts` file for source strings whose entire translatable content (after stripping `{n}` placeholders) is a single uppercase word. If that word is not in `ACRONYM_ONLY_STRINGS` and not in the known-uppercase-words exclusion list, the build fails with a message naming the file, key, and unregistered acronym. Catches new acronym-based legend keys at compile time instead of at translation audit time.

### Verification

Post-change audit: all 10 locales report 100.0% COMPLETE, 0 gaps. `verify:acronym-coverage` passes (8 registered acronyms, 17 source files scanned).

### Files changed

- `l10n/bundle.l10n.<locale>.json` (8 files with value changes; 2 identity-only)
- `l10n/provenance/<locale>.json` (all 10 files — manual provenance added)
- `scripts/modules/verify/l10n_brands.py` — `is_acronym_only` enhanced; "APP"/"FW" added to `ACRONYM_ONLY_STRINGS`
- `scripts/modules/verify/l10n_actions.py` — `run_fill_identity()` refactored to scan bundles directly
- `scripts/modules/verify/l10n_cli.py` — `fill-identity` with dry-run preview + confirmation; locale-prompt deduplication
- `scripts/modules/verify/verify-acronym-coverage.mjs` — new compile gate
- `package.json` — `verify:acronym-coverage` script + wired into compile chain
- `CHANGELOG.md`

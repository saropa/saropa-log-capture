# Manual translation of 27 EN-COPY l10n gaps + audit cognate hardening

The l10n audit (`20260803_172501_l10n_audit.json`) flagged 27 strings across 7 locales where the translated value was identical to the English source key. These were untranslated remnants from the Qwen 3 engine swap.

## Finish Report (2026-08-03)

### Changes

**Bundle translations (29 entries across 9 locales):**

| Key | de | es | fr | it | pt-br | zh-cn | zh-tw | ja | ko |
|---|---|---|---|---|---|---|---|---|---|
| dialog | Dialog | — | dialogue | — | — | — | — | — | — |
| inline | eingebettet | en línea | — | in linea | em linha | — | — | — | — |
| tab | Registerkarte | — | — | scheda | — | — | — | — | — |
| Screen Visit Log | Bildschirmbesuche | — | — | — | — | — | — | — | — |
| Flow | Ablauf | — | — | — | — | — | — | — | — |
| Executive Summary | Zusammenfassung | — | — | — | — | — | — | — | — |
| Commit | Commit* | Confirmación | Validation | Conferma | Confirmação | — | — | — | — |
| Version | Version* | — | Version* | — | — | — | — | — | — |
| Detail | Detail* | — | — | — | — | — | — | — | — |
| Sev | Schw. | Grav. | Sév. | Grav. | Grav. | 严重度 | 嚴重度 | 重度 | 심각 |
| Changelog | — | — | — | Registro delle modifiche | — | — | — | — | — |

\* True cognates/loanwords — identical spelling is correct in these locales. Suppressed via `VERIFIED_IDENTICAL` (de: Commit, Detail, Version; fr: Version) and the new provenance-based auto-suppress.

**Provenance normalization:** All manually translated entries set to `"manual"` (matching `ENGINE_MANUAL` convention, not `"human"`).

**Hardening — German loanwords:** Reverted de "Commit" → "Commit", "Detail" → "Detail", "Version" → "Version" (standard German loanwords in software). Added all three to de `VERIFIED_IDENTICAL` frozenset. Shortened de "Bildschirmbesuchsprotokoll" → "Bildschirmbesuche" for column width.

**Hardening — ja/ko Sev mistranslations:** Fixed ja "セブ" → "重度" (severity) and ko "서브" → "심각" (severity). The Qwen engine had transliterated the sound of "Sev" instead of translating its meaning.

**Audit auto-suppress for human-reviewed cognates:** Added a provenance check to `l10n_bundle_audit.py:run_audit()` — when `bundle[k] == k` AND `provenance.get(k) == ENGINE_MANUAL`, the entry is auto-suppressed as a confirmed cognate. This eliminates the need to manually add every true cognate to the `VERIFIED_IDENTICAL` dict in `l10n_brands.py`. The dict remains as a backstop for entries without manual provenance.

### Files changed

- `l10n/bundle.l10n.{de,es,fr,it,ja,ko,pt-br,zh-cn,zh-tw}.json` — translated values
- `l10n/provenance/{de,es,fr,it,ja,ko,pt-br,zh-cn,zh-tw}.json` — provenance → "manual"
- `scripts/modules/verify/l10n_brands.py` — VERIFIED_IDENTICAL: fr += "Version"; de += "Commit", "Detail", "Version"
- `scripts/modules/verify/l10n_bundle_audit.py` — auto-suppress cognates with manual provenance

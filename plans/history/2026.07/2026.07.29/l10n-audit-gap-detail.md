# l10n audit: surface untranslated string detail in console output

The l10n audit CLI printed the total count of untranslated strings ("5 untranslated string(s) remain") but did not list which strings were affected. The operator had to open the JSON audit report to find out.

## Finish Report (2026-07-29)

### Change

`write_report_and_offer_export()` in `scripts/modules/verify/l10n_actions.py` now calls the existing `print_untranslated_detail()` function (from `l10n_audit_display.py`) between the gap count and the help text. This prints each locale's untranslated entries — symbolic key, reason (MISSING vs EN-COPY vs brand_mangled), and the English value — directly in the console.

### Files changed

| File | Change |
|---|---|
| `scripts/modules/verify/l10n_actions.py` | Added import of `print_untranslated_detail`; call it when `audit.has_gaps` is true |
| `CHANGELOG.md` | Added entry under Changed |

### What was NOT changed

`print_untranslated_detail` already existed in `l10n_audit_display.py` (with truncation, color-coded tags, and a cap of 10 entries per locale). No modifications were needed to that function.

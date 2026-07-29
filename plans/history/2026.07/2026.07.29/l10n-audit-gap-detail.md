# l10n audit: surface untranslated string detail in console output

The l10n audit CLI printed the total count of untranslated strings ("5 untranslated string(s) remain") but did not list which strings were affected. The operator had to open the JSON audit report to find out.

## Finish Report (2026-07-29)

### Changes

1. **Interactive detail** — `write_report_and_offer_export()` in `l10n_actions.py` calls `print_untranslated_detail()` when gaps exist, printing each locale's untranslated entries (symbolic key, reason tag, English value) directly in the terminal.

2. **`max_entries` parameter** — `print_untranslated_detail()` gained a keyword-only `max_entries: int | None` (default 10). `None` removes the cap entirely. Existing callers are unaffected (default preserves the original 10-entry limit).

3. **`--verbose` flag** — the non-interactive CLI (`--run-mode audit|sync|translate`) gained `--verbose`. When set, the per-string detail prints after the audit report with no entry cap (`max_entries=None`). Without the flag, non-interactive output stays compact for CI.

4. **Spacing fix** — removed a stray `\n` prefix from the dim help text that followed the detail output, which produced a double blank line.

### Files changed

| File | Change |
|---|---|
| `scripts/modules/verify/l10n_audit_display.py` | Added `max_entries` keyword param to `print_untranslated_detail`; uses it for slicing and remainder count |
| `scripts/modules/verify/l10n_actions.py` | Fixed `\n` spacing in dim help text |
| `scripts/modules/verify/l10n_cli.py` | Added `--verbose` argparse flag; imported `print_untranslated_detail`; calls it in audit-only and post-translate paths when verbose + has_gaps |
| `CHANGELOG.md` | Updated entry under Changed |

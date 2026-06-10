# -*- coding: utf-8 -*-
"""Console rendering of an ``AuditResult`` for the l10n CLI.

Pure presentation: takes the audit produced by ``l10n_bundle_audit.run_audit``
and prints the status header, English-bundle issues (missing / orphan keys), the
per-locale coverage table, and the untranslated-gap detail. Color is semantic —
green = complete, yellow = partial gap, red = missing — so a glance at the table
tells the operator where the work is. No mutation, no I/O beyond stdout.
"""

from modules.verify.l10n_bundle_audit import AuditResult
from modules.verify.l10n_console import bold, cyan, dim, green, header, red, yellow


def _truncate(text: str, limit: int = 60, hard: int = 63) -> str:
    """Trim ``text`` to ``limit`` chars with an ellipsis past ``hard``."""
    return text[:limit] + "..." if len(text) > hard else text


def _print_bundle_issues(audit: AuditResult) -> None:
    """Print missing-from-bundle (red) and orphan-in-bundle (yellow) sections."""
    if audit.missing_from_bundle:
        print(f"\n  {red(f'MISSING from English bundle: {len(audit.missing_from_bundle)}')}")
        for sym_key, en_val in audit.missing_from_bundle[:8]:
            print(f'    - [{cyan(sym_key)}] "{_truncate(en_val)}"')
        remaining = len(audit.missing_from_bundle) - 8
        if remaining > 0:
            print(dim(f"    ... and {remaining} more"))

    if audit.orphan_in_bundle:
        print(f"\n  {yellow(f'ORPHAN in English bundle: {len(audit.orphan_in_bundle)}')}")
        for key in audit.orphan_in_bundle[:5]:
            print(f'    - "{_truncate(key)}"')
        remaining = len(audit.orphan_in_bundle) - 5
        if remaining > 0:
            print(dim(f"    ... and {remaining} more"))


def _coverage_status(missing_count: int, untranslated_count: int) -> str:
    """Build the colored per-locale status cell (COMPLETE / N missing / N untranslated)."""
    if missing_count == 0 and untranslated_count == 0:
        return green("COMPLETE")
    parts = []
    if missing_count > 0:
        parts.append(red(f"{missing_count} missing"))
    if untranslated_count > 0:
        parts.append(yellow(f"{untranslated_count} untranslated"))
    return ", ".join(parts)


def _print_coverage_table(audit: AuditResult) -> None:
    """Print the per-locale coverage table with colored progress bars."""
    if not audit.locale_coverage:
        return
    canonical = audit.locale_coverage[0].total_keys
    label = (
        f"Translation Coverage ({canonical} strings, "
        f"{len(audit.locale_coverage)} locales):"
    )
    print(f"\n  {cyan(label)}")
    print(f"  {'Locale':<10} {'Progress':>22}  Status")
    print(dim(f"  {'-' * 10} {'-' * 22}  {'-' * 30}"))

    bar_width = 15
    for lc in audit.locale_coverage:
        complete = lc.missing_count == 0 and lc.untranslated_count == 0
        filled = round(lc.pct / 100 * bar_width)
        raw_bar = "#" * filled + "." * (bar_width - filled)
        # Green bar when fully translated, yellow while a gap remains — the
        # bar's hue alone signals locale health before reading the status cell.
        bar = green(raw_bar) if complete else yellow(raw_bar)
        pct_str = f"{lc.pct:5.1f}%"
        status = _coverage_status(lc.missing_count, lc.untranslated_count)
        print(f"  {lc.locale:<10} [{bar}] {pct_str}  {status}")


def print_untranslated_detail(audit: AuditResult) -> None:
    """Print per-locale untranslated entries so the user can see what's left."""
    for lc in audit.locale_coverage:
        if not lc.untranslated_entries:
            continue
        print(f"\n  {bold(lc.locale)} — {yellow(f'{len(lc.untranslated_entries)} gap(s)')}:")
        for entry in lc.untranslated_entries[:10]:
            # Missing (absent) is more severe than en-copy (present, untranslated).
            tag = red("MISSING") if entry.reason == "missing" else yellow("EN-COPY")
            print(f'    [{tag}] {entry.sym_key}: "{_truncate(entry.en_value, 55, 58)}"')
        remaining = len(lc.untranslated_entries) - 10
        if remaining > 0:
            print(dim(f"    ... and {remaining} more"))


def print_audit(audit: AuditResult) -> None:
    """Print the full audit: status header, bundle issues, coverage, gap detail."""
    header("l10n Bundle Status")
    print()
    print(f"  Source strings (TS):  {cyan(str(audit.source_key_count))}")
    print(f"  English bundle keys: {cyan(str(audit.bundle_key_count))}")
    _print_bundle_issues(audit)
    _print_coverage_table(audit)
    print_untranslated_detail(audit)

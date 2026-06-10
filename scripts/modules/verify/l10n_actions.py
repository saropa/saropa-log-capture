# -*- coding: utf-8 -*-
"""Translation pipeline actions for the l10n CLI.

The three things a run actually *does*: sync the English bundle to the TS source
strings, translate missing strings for a locale set, and write the audit report
(offering a gap export). Each prints colored progress — green for work done, red
for errors/orphans, yellow for gaps — and delegates the real work to
``l10n_bundle_audit`` and ``l10n_translator``. No menu logic lives here; see
``l10n_cli``.
"""

import sys
import time

from modules.verify.l10n_bundle_audit import (
    AuditResult,
    sync_english_bundle,
    write_audit_report,
    write_gap_export,
)
from modules.verify.l10n_console import cyan, dim, green, header, red, yellow
from modules.verify.l10n_translator import (
    fix_mangled_brands,
    get_canonical_keys,
    translate_locale,
)


def run_sync() -> None:
    """Sync the English bundle to match the TS source strings."""
    header("Syncing English bundle")
    added, kept, removed = sync_english_bundle()
    print(f"\n  Kept:    {kept}")
    print(f"  Added:   {green(str(added))}")
    print(f"  Removed: {red(str(removed))} orphan(s)")
    print(f"  Total:   {cyan(str(kept + added))} keys")


def _reset_mangled_brands(locales: list[str], canonical: set[str]) -> None:
    """Reset translations that mangled brand names so they retranslate cleanly."""
    total_fixed = 0
    for locale in locales:
        fixed = fix_mangled_brands(locale, canonical)
        if fixed > 0:
            total_fixed += fixed
            print(f"  {cyan(locale)}: reset {yellow(str(fixed))} mangled brand translation(s)")
    if total_fixed > 0:
        print(f"  Total: {yellow(str(total_fixed))} brand fix(es) — will retranslate")


def _print_locale_summary(
    translated: int, kept: int, brand_count: int, errors: int, *, dry_run: bool,
) -> None:
    """Print the per-locale result line; buckets sum to the locale total."""
    if dry_run:
        print(f"{translated} to translate, {kept} already done, {brand_count} brand")
        return
    parts = [green(f"{translated} translated"), dim(f"{kept} kept")]
    if brand_count > 0:
        parts.append(cyan(f"{brand_count} brand"))
    if errors > 0:
        parts.append(red(f"{errors} errors"))
    total = translated + kept + brand_count + errors
    print(f"{', '.join(parts)} = {total}")


def _translate_one_locale(
    locale: str, canonical: set[str], *, dry_run: bool,
) -> tuple[int, int, bool]:
    """Translate one locale. Returns (translated, errors, aborted)."""
    # Live counter (\r) so a multi-minute run shows motion, not a frozen prompt.
    # Default arg binds the loop's current locale into the closure.
    def on_progress(done: int, total: int, _loc: str = locale) -> None:
        print(f"\r  {_loc}: {done}/{total} translated…", end="", flush=True)

    print(f"\n  {cyan(locale)}:", end=" ", flush=True)
    translated, kept, brand_count, errors, aborted = translate_locale(
        locale, canonical, dry_run=dry_run, on_progress=on_progress,
    )
    # Close the transient \r line before the per-locale summary.
    if not dry_run and (translated or errors):
        print()
    _print_locale_summary(translated, kept, brand_count, errors, dry_run=dry_run)
    return translated, errors, aborted


def run_translate(locales: list[str], *, dry_run: bool = False) -> None:
    """Translate missing strings for the given locales, with live progress."""
    canonical = get_canonical_keys()
    # Fix mangled brands first — resets bad translations to English so
    # translate_locale() retranslates them with brand shielding.
    if not dry_run:
        _reset_mangled_brands(locales, canonical)

    label = "Translate (dry run)" if dry_run else "Translating"
    header(f"{label}: {len(locales)} locale(s), {len(canonical)} strings")

    total_translated = 0
    total_errors = 0
    t0 = time.time()
    for locale in locales:
        translated, errors, aborted = _translate_one_locale(
            locale, canonical, dry_run=dry_run,
        )
        total_translated += translated
        total_errors += errors
        # Per-IP rate limiting hits every locale the same way, so stop the whole
        # run once the breaker trips rather than burning the timeout budget.
        if aborted:
            print(red(
                "\n  Rate-limited by the translation endpoint — stopped early. "
                "Re-run later to fill the remaining gaps."
            ))
            break

    elapsed = time.time() - t0
    print(f"\n  Done in {elapsed:.1f}s. {green(f'{total_translated} translations')}")
    if total_errors > 0:
        print(f"  {red(f'{total_errors} errors')} (kept English as fallback)")


def write_report_and_offer_export(audit: AuditResult) -> None:
    """Write the audit report and, on a TTY with gaps, offer a gap export."""
    report_path = write_audit_report(audit)
    print(f"\n  Audit report: {cyan(str(report_path))}")

    if not audit.has_gaps or not sys.stdin.isatty():
        return

    total_gaps = sum(
        lc.missing_count + lc.untranslated_count for lc in audit.locale_coverage
    )
    print(f"\n  {yellow(f'{total_gaps} untranslated string(s) remain.')}")
    print("  Export gaps for external translation?")
    print("    1  Export as JSON")
    print("    2  Export as CSV")
    print("    0  No export")
    try:
        choice = input("\n  Choice [0]: ").strip() or "0"
    except (EOFError, KeyboardInterrupt):
        print()
        return

    fmt = {"1": "json", "2": "csv"}.get(choice)
    if fmt:
        path = write_gap_export(audit, fmt=fmt)
        if path:
            print(f"  {green('Exported')}: {path}")

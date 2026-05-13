#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# ##############################################################################
# Saropa Log Capture — l10n Translation Pipeline
# ##############################################################################
#
# .SYNOPSIS
#   Audit, sync, and translate l10n bundles for the VS Code extension.
#
# .DESCRIPTION
#   Interactive mode (no args, TTY):
#     Shows audit status, then a menu:
#       1. Audit only (read-only)
#       2. Sync English bundle
#       3. Sync + translate all locales
#       4. Sync + translate specific locales
#       0. Exit
#
#   Non-interactive / CI (--run-mode):
#     --run-mode audit       read-only status report
#     --run-mode sync        sync English bundle only
#     --run-mode translate   sync + translate all locales
#     --dry-run              preview without writing files
#     --locales de,fr        scope translation to listed locales
#
#   Programmatic (imported by publish pipeline):
#     checks_build.py calls run_audit / sync_english_bundle / translate_locale
#     directly via the modules — this entry point is never imported.
#
#   Every run writes a timestamped audit report to reports/. When gaps remain
#   after translation, the script offers to export them as CSV or JSON for
#   external translation tools or AI-assisted batch translation.
#
# .NOTES
#   Version:   1.2.0
#   Requires:  Python 3.10+
#   Translate: pip install deep-translator
#
# Exit Codes:
#   0  Success
#   1  Audit found issues and no action was taken
#   2  User cancelled
#
# ##############################################################################

import io
import sys
import time

# Force UTF-8 stdout on Windows so Unicode strings (arrows, ellipsis, etc.)
# don't crash with UnicodeEncodeError on cp1252 consoles.
if sys.stdout.encoding != "utf-8":
    sys.stdout = io.TextIOWrapper(
        sys.stdout.buffer, encoding="utf-8", errors="replace",
    )

from modules.verify.l10n_bundle_audit import (
    AuditResult,
    run_audit,
    sync_english_bundle,
    write_audit_report,
    write_gap_export,
)
from modules.verify.l10n_translator import (
    fix_mangled_brands,
    get_canonical_keys,
    get_translation_locales,
    translate_locale,
)


# ── Audit display ──────────────────────────────────────────────


def _print_audit(audit: AuditResult) -> None:
    """Print the audit results as a progress report."""
    print("=" * 60)
    print("  l10n Bundle Status")
    print("=" * 60)
    print()
    print(f"  Source strings (TS):  {audit.source_key_count}")
    print(f"  English bundle keys: {audit.bundle_key_count}")

    if audit.missing_from_bundle:
        print(
            f"\n  MISSING from English bundle: "
            f"{len(audit.missing_from_bundle)}"
        )
        for sym_key, en_val in audit.missing_from_bundle[:8]:
            display = en_val[:60] + "..." if len(en_val) > 63 else en_val
            print(f'    - [{sym_key}] "{display}"')
        remaining = len(audit.missing_from_bundle) - 8
        if remaining > 0:
            print(f"    ... and {remaining} more")

    if audit.orphan_in_bundle:
        print(
            f"\n  ORPHAN in English bundle: "
            f"{len(audit.orphan_in_bundle)}"
        )
        for key in audit.orphan_in_bundle[:5]:
            display = key[:60] + "..." if len(key) > 63 else key
            print(f'    - "{display}"')
        remaining = len(audit.orphan_in_bundle) - 5
        if remaining > 0:
            print(f"    ... and {remaining} more")

    # Translation coverage table
    if audit.locale_coverage:
        canonical = audit.locale_coverage[0].total_keys
        print(
            f"\n  Translation Coverage "
            f"({canonical} strings, "
            f"{len(audit.locale_coverage)} locales):"
        )
        print(f"  {'Locale':<10} {'Progress':>22}  Status")
        print(f"  {'-' * 10} {'-' * 22}  {'-' * 30}")

        for lc in audit.locale_coverage:
            bar_width = 15
            filled = round(lc.pct / 100 * bar_width)
            bar = "#" * filled + "." * (bar_width - filled)
            pct_str = f"{lc.pct:5.1f}%"

            if lc.missing_count == 0 and lc.untranslated_count == 0:
                status = "COMPLETE"
            else:
                parts = []
                if lc.missing_count > 0:
                    parts.append(f"{lc.missing_count} missing")
                if lc.untranslated_count > 0:
                    parts.append(f"{lc.untranslated_count} untranslated")
                status = ", ".join(parts)

            print(
                f"  {lc.locale:<10} [{bar}] {pct_str}  {status}"
            )

    # Show untranslated detail when there are gaps.
    _print_untranslated_detail(audit)


def _print_untranslated_detail(audit: AuditResult) -> None:
    """Print per-locale untranslated entries so the user can see what's left."""
    for lc in audit.locale_coverage:
        if not lc.untranslated_entries:
            continue
        print(f"\n  {lc.locale} — {len(lc.untranslated_entries)} gap(s):")
        for entry in lc.untranslated_entries[:10]:
            reason_tag = "MISSING" if entry.reason == "missing" else "EN-COPY"
            display = entry.en_value[:55] + "..." if len(entry.en_value) > 58 else entry.en_value
            print(f'    [{reason_tag}] {entry.sym_key}: "{display}"')
        remaining = len(lc.untranslated_entries) - 10
        if remaining > 0:
            print(f"    ... and {remaining} more")


# ── Actions ────────────────────────────────────────────────────


def _run_sync() -> None:
    """Sync the English bundle to match TS source strings."""
    print(f"\n{'=' * 60}")
    print("  Syncing English bundle")
    print("=" * 60)
    added, kept, removed = sync_english_bundle()
    print(f"\n  Kept:    {kept}")
    print(f"  Added:   {added}")
    print(f"  Removed: {removed} orphan(s)")
    print(f"  Total:   {kept + added} keys")


def _run_translate(
    locales: list[str],
    *,
    dry_run: bool = False,
) -> None:
    """Translate missing strings for the given locale list."""
    canonical = get_canonical_keys()

    # Fix mangled brand names first — resets bad translations to English
    # so translate_locale() will retranslate them with brand shielding.
    if not dry_run:
        total_fixed = 0
        for locale in locales:
            fixed = fix_mangled_brands(locale, canonical)
            if fixed > 0:
                total_fixed += fixed
                print(f"  {locale}: reset {fixed} mangled brand translation(s)")
        if total_fixed > 0:
            print(f"  Total: {total_fixed} brand fix(es) — will retranslate")

    print(f"\n{'=' * 60}")
    label = "Translate (dry run)" if dry_run else "Translating"
    print(
        f"  {label}: {len(locales)} locale(s), "
        f"{len(canonical)} strings"
    )
    print("=" * 60)

    total_translated = 0
    total_errors = 0
    t0 = time.time()

    for locale in locales:
        print(f"\n  {locale}:", end=" ", flush=True)
        translated, kept, brand_count, errors = translate_locale(
            locale, canonical, dry_run=dry_run,
        )
        total_translated += translated
        total_errors += errors

        if dry_run:
            print(
                f"{translated} to translate, "
                f"{kept} already done, "
                f"{brand_count} brand"
            )
        else:
            # Show all buckets so the numbers add up to the total.
            parts = [f"{translated} translated", f"{kept} kept"]
            if brand_count > 0:
                parts.append(f"{brand_count} brand")
            if errors > 0:
                parts.append(f"{errors} errors")
            total = translated + kept + brand_count + errors
            print(f"{', '.join(parts)} = {total}")

    elapsed = time.time() - t0
    print(f"\n  Done in {elapsed:.1f}s. {total_translated} translations")
    if total_errors > 0:
        print(f"  {total_errors} errors (kept English as fallback)")


def _write_report_and_offer_export(audit: AuditResult) -> None:
    """Write the audit report and offer gap export if there are gaps."""
    report_path = write_audit_report(audit)
    print(f"\n  Audit report: {report_path}")

    if not audit.has_gaps:
        return

    # Only prompt in interactive TTY mode.
    if not sys.stdin.isatty():
        return

    total_gaps = sum(
        lc.missing_count + lc.untranslated_count
        for lc in audit.locale_coverage
    )

    print(f"\n  {total_gaps} untranslated string(s) remain.")
    print("  Export gaps for external translation?")
    print("    1  Export as JSON")
    print("    2  Export as CSV")
    print("    0  No export")

    try:
        choice = input("\n  Choice [0]: ").strip() or "0"
    except (EOFError, KeyboardInterrupt):
        print()
        return

    if choice == "1":
        path = write_gap_export(audit, fmt="json")
        if path:
            print(f"  Exported: {path}")
    elif choice == "2":
        path = write_gap_export(audit, fmt="csv")
        if path:
            print(f"  Exported: {path}")


# ── Interactive menu ───────────────────────────────────────────


def _prompt_locale_codes() -> list[str] | None:
    """Ask the user for comma-separated locale codes.

    Returns the validated list, or None if the user cancels.
    """
    available = get_translation_locales()
    print(f"\n  Available locales: {', '.join(available)}")
    try:
        raw = input("  Enter locales (comma-separated): ").strip()
    except (EOFError, KeyboardInterrupt):
        print()
        return None

    if not raw:
        return None

    codes = [c.strip() for c in raw.split(",") if c.strip()]
    available_set = set(available)
    invalid = [c for c in codes if c not in available_set]
    if invalid:
        print(f"  Unknown locale(s): {', '.join(invalid)}")
        return None
    return codes


def _interactive_menu() -> int:
    """Show audit then prompt for an action. Returns exit code."""

    # Always show current state first.
    audit = run_audit()
    _print_audit(audit)

    has_english_issues = bool(
        audit.missing_from_bundle or audit.orphan_in_bundle
    )
    has_translation_gaps = audit.has_gaps

    # Menu
    print(f"\n{'=' * 60}")
    print("  Actions")
    print("=" * 60)
    print("  1  Audit only (already shown above)")
    print("  2  Sync English bundle (add missing, remove orphans)")
    print("  3  Sync + translate ALL locales")
    print("  4  Sync + translate SPECIFIC locales")
    print("  0  Exit")

    # Hint at what's needed based on audit state.
    if has_english_issues and has_translation_gaps:
        default = "3"
        hint = "sync + translate"
    elif has_english_issues:
        default = "2"
        hint = "sync"
    elif has_translation_gaps:
        default = "3"
        hint = "translate"
    else:
        default = "1"
        hint = "nothing to do"

    try:
        raw = input(f"\n  Choice [{default}] ({hint}): ").strip()
    except (EOFError, KeyboardInterrupt):
        print()
        return 2

    choice = raw or default

    if choice == "0":
        return 0

    if choice == "1":
        # Audit was already printed above. Write report + offer export.
        _write_report_and_offer_export(audit)
        return 0

    if choice == "2":
        _run_sync()
        final = run_audit()
        _print_audit(final)
        _write_report_and_offer_export(final)
        return 0

    if choice == "3":
        _run_sync()
        _run_translate(get_translation_locales())
        final = run_audit()
        print()
        _print_audit(final)
        _write_report_and_offer_export(final)
        return 0

    if choice == "4":
        codes = _prompt_locale_codes()
        if not codes:
            print("  Cancelled.")
            return 2
        _run_sync()
        _run_translate(codes)
        final = run_audit()
        print()
        _print_audit(final)
        _write_report_and_offer_export(final)
        return 0

    print(f"  Unknown choice: {choice}")
    return 1


# ── Non-interactive (CI / --run-mode) ─────────────────────────


def _non_interactive() -> int:
    """Parse CLI args and run the requested mode. No prompts."""
    import argparse

    p = argparse.ArgumentParser(
        description="l10n translation pipeline (non-interactive).",
    )
    p.add_argument(
        "--run-mode",
        choices=["audit", "sync", "translate"],
        default="audit",
        help="Pipeline mode: audit (read-only), sync, or translate.",
    )
    p.add_argument(
        "--locales",
        type=str,
        default="",
        help="Comma-separated locale codes (default: all).",
    )
    p.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview without writing files.",
    )
    args = p.parse_args()

    audit = run_audit()
    _print_audit(audit)

    if args.run_mode == "audit":
        report_path = write_audit_report(audit)
        print(f"\n  Audit report: {report_path}")
        if audit.has_gaps:
            # Non-interactive: always write JSON gap export when gaps exist.
            gap_path = write_gap_export(audit, fmt="json")
            if gap_path:
                print(f"  Gap export:   {gap_path}")
        if audit.missing_from_bundle:
            return 1
        return 0

    if args.run_mode in ("sync", "translate"):
        _run_sync()

    if args.run_mode == "translate":
        target = get_translation_locales()
        if args.locales:
            target = [
                c.strip() for c in args.locales.split(",") if c.strip()
            ]
            available = set(get_translation_locales())
            invalid = [c for c in target if c not in available]
            if invalid:
                print(f"  Unknown locale(s): {', '.join(invalid)}")
                print(
                    f"  Available: {', '.join(sorted(available))}"
                )
                return 1

        _run_translate(target, dry_run=args.dry_run)

    # Final audit + report after any mutation.
    final = run_audit()
    print()
    _print_audit(final)
    report_path = write_audit_report(final)
    print(f"\n  Audit report: {report_path}")
    if final.has_gaps:
        gap_path = write_gap_export(final, fmt="json")
        if gap_path:
            print(f"  Gap export:   {gap_path}")

    return 0


# ── Entry point ────────────────────────────────────────────────


def main() -> int:
    # Interactive when running in a TTY with no CLI args (beyond the
    # script name). Non-interactive when piped or when --run-mode is given.
    if sys.stdin.isatty() and len(sys.argv) == 1:
        return _interactive_menu()
    return _non_interactive()


if __name__ == "__main__":
    sys.exit(main())

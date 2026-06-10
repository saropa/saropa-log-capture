# -*- coding: utf-8 -*-
"""Command surface for the l10n translation pipeline.

Two entry paths, both thin over ``l10n_actions``:

  - ``interactive_menu()`` — TTY flow: show the audit, present the numbered
    action menu with a context-aware default, dispatch the choice.
  - ``run_non_interactive()`` — ``--run-mode`` flow for CI / scripted use.

Keeping the menu and arg parsing here lets ``translate_l10n.py`` stay a thin
launcher (UTF-8 setup + pick interactive vs not).
"""

import argparse
import sys

from modules.verify.l10n_actions import (
    run_sync,
    run_translate,
    write_report_and_offer_export,
)
from modules.verify.l10n_audit_display import print_audit
from modules.verify.l10n_bundle_audit import (
    AuditResult,
    run_audit,
    write_audit_report,
    write_gap_export,
)
from modules.verify.l10n_console import cyan, header, red, yellow
from modules.verify.l10n_translator import get_translation_locales


# ── Interactive menu ───────────────────────────────────────────


def prompt_locale_codes() -> list[str] | None:
    """Ask for comma-separated locale codes. Returns the list, or None to cancel."""
    available = get_translation_locales()
    print(f"\n  Available locales: {cyan(', '.join(available))}")
    try:
        raw = input("  Enter locales (comma-separated): ").strip()
    except (EOFError, KeyboardInterrupt):
        print()
        return None
    if not raw:
        return None
    codes = [c.strip() for c in raw.split(",") if c.strip()]
    invalid = [c for c in codes if c not in set(available)]
    if invalid:
        print(red(f"  Unknown locale(s): {', '.join(invalid)}"))
        return None
    return codes


def _resolve_menu_default(audit: AuditResult) -> tuple[str, str]:
    """Pick the menu default + hint from what the audit found needs doing."""
    has_english_issues = bool(audit.missing_from_bundle or audit.orphan_in_bundle)
    if has_english_issues and audit.has_gaps:
        return "3", "sync + translate"
    if has_english_issues:
        return "2", "sync"
    if audit.has_gaps:
        return "3", "translate"
    return "1", "nothing to do"


def _print_menu() -> None:
    """Print the action menu."""
    header("Actions")
    print("  1  Audit only (already shown above)")
    print("  2  Sync English bundle (add missing, remove orphans)")
    print("  3  Sync + translate ALL locales")
    print("  4  Sync + translate SPECIFIC locales")
    print("  0  Exit")


def _sync_translate_reaudit(locales_to_translate: list[str] | None) -> int:
    """Sync, optionally translate, then re-audit and offer a gap export.

    ``locales_to_translate`` is None for sync-only (menu option 2); a list for
    options 3 (all locales) and 4 (specific).
    """
    run_sync()
    if locales_to_translate is not None:
        run_translate(locales_to_translate)
    final = run_audit()
    print()
    print_audit(final)
    write_report_and_offer_export(final)
    return 0


def interactive_menu() -> int:
    """Show the audit, then prompt for an action. Returns the exit code."""
    audit = run_audit()
    print_audit(audit)
    _print_menu()
    default, hint = _resolve_menu_default(audit)
    try:
        raw = input(f"\n  Choice [{default}] ({hint}): ").strip()
    except (EOFError, KeyboardInterrupt):
        print()
        return 2

    choice = raw or default
    if choice == "0":
        return 0
    if choice == "1":
        # Audit already printed above; just persist it and offer the export.
        write_report_and_offer_export(audit)
        return 0
    if choice == "2":
        return _sync_translate_reaudit(None)
    if choice == "3":
        return _sync_translate_reaudit(get_translation_locales())
    if choice == "4":
        codes = prompt_locale_codes()
        if not codes:
            print(yellow("  Cancelled."))
            return 2
        return _sync_translate_reaudit(codes)
    print(red(f"  Unknown choice: {choice}"))
    return 1


# ── Non-interactive (CI / --run-mode) ─────────────────────────


def _parse_args() -> argparse.Namespace:
    """Parse CLI args for the non-interactive flow."""
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
    return p.parse_args()


def _write_report_with_json_gaps(audit: AuditResult) -> None:
    """Write the audit report and, when gaps exist, always write the JSON gap export."""
    report_path = write_audit_report(audit)
    print(f"\n  Audit report: {cyan(str(report_path))}")
    if audit.has_gaps:
        gap_path = write_gap_export(audit, fmt="json")
        if gap_path:
            print(f"  Gap export:   {cyan(str(gap_path))}")


def _resolve_targets(args: argparse.Namespace) -> list[str] | None:
    """Resolve the translate target locales from --locales. None if any are invalid."""
    if not args.locales:
        return get_translation_locales()
    target = [c.strip() for c in args.locales.split(",") if c.strip()]
    available = set(get_translation_locales())
    invalid = [c for c in target if c not in available]
    if invalid:
        print(red(f"  Unknown locale(s): {', '.join(invalid)}"))
        print(f"  Available: {', '.join(sorted(available))}")
        return None
    return target


def run_non_interactive() -> int:
    """Parse args and run the requested mode. No prompts. Returns the exit code."""
    args = _parse_args()
    audit = run_audit()
    print_audit(audit)

    if args.run_mode == "audit":
        _write_report_with_json_gaps(audit)
        # Missing-from-bundle is a hard failure for CI; gaps alone are not.
        return 1 if audit.missing_from_bundle else 0

    run_sync()
    if args.run_mode == "translate":
        targets = _resolve_targets(args)
        if targets is None:
            return 1
        run_translate(targets, dry_run=args.dry_run)

    final = run_audit()
    print()
    print_audit(final)
    _write_report_with_json_gaps(final)
    return 0

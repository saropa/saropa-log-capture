#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# ##############################################################################
# Saropa Log Capture — l10n Translation Pipeline (entry point)
# ##############################################################################
#
# .SYNOPSIS
#   Audit, sync, and translate l10n bundles for the VS Code extension.
#
# .DESCRIPTION
#   Thin launcher. UTF-8 stdout setup + interactive-vs-CLI dispatch only; the
#   pipeline lives in colorized modules under scripts/modules/verify/:
#     l10n_console.py        ANSI color helpers (reuse the shared palette)
#     l10n_audit_display.py  print_audit / coverage table / gap detail
#     l10n_actions.py        run_sync / run_translate / report + gap export
#     l10n_cli.py            interactive menu + --run-mode arg handling
#     l10n_bundle_audit.py   audit, sync, report/export (data layer)
#     l10n_translator.py     translation engine (NLLB first, Google fallback)
#     l10n_brands.py         brand shielding
#
#   Interactive mode (no args, TTY): shows the audit then a menu —
#     1 Audit only · 2 Sync English · 3 Sync + translate all ·
#     4 Sync + translate specific · 0 Exit
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
# .NOTES
#   Version:   1.4.0
#   Requires:  Python 3.10+
#   Translate: Offline NLLB-200-3.3B is used automatically when its model is
#              cached (higher quality, no rate limits); otherwise the pipeline
#              falls back to Google Translate.
#                NLLB:   pip install ctranslate2 sentencepiece huggingface_hub
#                        huggingface-cli download JustFrederik/nllb-200-3.3B-ct2-float16
#                Google: pip install deep-translator
#              Set SAROPA_SKIP_NLLB=1 to force the Google path.
#
# Exit Codes:
#   0  Success
#   1  Audit found issues and no action was taken
#   2  User cancelled
#
# ##############################################################################

import io
import sys

# Force UTF-8 stdout on Windows so Unicode strings (arrows, ellipsis, etc.) and
# ANSI color render instead of crashing with UnicodeEncodeError on cp1252
# consoles. Done BEFORE importing the modules below, whose color layer wraps
# this stream — reconfiguring it afterward would unwrap the color handling.
if sys.stdout.encoding != "utf-8":
    sys.stdout = io.TextIOWrapper(
        sys.stdout.buffer, encoding="utf-8", errors="replace",
    )

from modules.verify.l10n_cli import (  # noqa: E402  (import after stdout setup)
    interactive_menu,
    run_non_interactive,
)


def main() -> int:
    """Interactive when run in a TTY with no CLI args; non-interactive otherwise."""
    if sys.stdin.isatty() and len(sys.argv) == 1:
        return interactive_menu()
    return run_non_interactive()


if __name__ == "__main__":
    sys.exit(main())

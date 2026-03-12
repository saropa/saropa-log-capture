#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# ##############################################################################
# Saropa Log Capture — Developer Toolkit & Publish Pipeline
# ##############################################################################
#
# .SYNOPSIS
#   Developer toolkit: setup, build, and local install for the extension.
#   Publish pipeline: gated analyze-then-publish to VS Code Marketplace.
#
# .DESCRIPTION
#   Analysis phase (all must pass):
#     Step 1:  Prerequisites (Node 18+, npm, git, VS Code CLI)
#     Step 2:  Global npm packages (yo, generator-code)
#     Step 3:  VS Code extensions (esbuild, eslint, test runner)
#     Step 4:  Working tree (clean git state)
#     Step 5:  Remote sync (fetch, pull if behind)
#     Step 6:  Dependencies (npm install if needed)
#     Step 7:  Compile (type-check + lint + esbuild)
#     Step 8:  Tests (npm run test)
#     Step 9:  Quality checks (300-line file limit)
#     Step 10: Version & CHANGELOG (resolve version, stamp CHANGELOG)
#
#   Analyze-only mode (--analyze-only):
#     → Package .vsix, show install instructions, offer local install
#
#   Publish phase (irreversible, needs confirmation):
#     Step 11: Git commit & push
#     Step 12: Git tag (v{version})
#     Step 13: Publish to VS Code Marketplace
#     Step 14: Publish to Open VSX (Cursor / VSCodium)
#     Step 15: Create GitHub release (attach .vsix)
#
# .USAGE
#   python scripts/publish.py                   # full analyze + publish pipeline
#   python scripts/publish.py --analyze-only    # build + package + local install
#   python scripts/publish.py --skip-tests      # skip test step
#   python scripts/publish.py --skip-extensions # skip VS Code extension checks
#   python scripts/publish.py --skip-global-npm # skip global npm package checks
#   python scripts/publish.py --auto-install    # auto-install .vsix (no prompt)
#   python scripts/publish.py --no-logo         # suppress Saropa ASCII art
#
# .NOTES
#   Version:      4.0.0
#   Requires:     Python 3.10+
#   colorama is auto-installed when missing (for Windows terminal color support)
#
# Exit Codes:
#    0  SUCCESS              8  VERSION_INVALID
#    1  PREREQUISITE_FAILED  9  CHANGELOG_FAILED
#    2  WORKING_TREE_DIRTY  10  PACKAGE_FAILED
#    3  REMOTE_SYNC_FAILED  11  GIT_FAILED
#    4  DEPENDENCY_FAILED   12  PUBLISH_FAILED
#    5  COMPILE_FAILED      13  RELEASE_FAILED
#    6  TEST_FAILED         14  USER_CANCELLED
#    7  QUALITY_FAILED      15  OPENVSX_FAILED
#
# ##############################################################################

import argparse
import subprocess
import sys

# Ensure colorama is available so modules.constants can init it on Windows.
try:
    import colorama  # noqa: F401
except ImportError:
    print("Installing colorama for terminal colors…")
    subprocess.run(
        [sys.executable, "-m", "pip", "install", "colorama", "-q"],
        check=False,
        capture_output=True,
    )

from modules.constants import C, ExitCode, PROJECT_ROOT
from modules.display import dim, heading, info, show_logo
from modules.utils import get_installed_extension_versions, read_package_version
from modules.report import print_timing, save_report
from modules.install import prompt_open_report
from modules.publish_confirm import confirm_publish
from modules.orchestrator import (
    ask_publish_stores,
    package_and_install,
    print_report_path,
    run_analysis,
    run_publish,
    save_and_print_report,
)


# ── CLI ──────────────────────────────────────────────────────

_CLI_FLAGS = [
    ("--analyze-only", "Run analysis + build + package, offer local install. No publish."),
    ("--yes", "Accept version and stamp CHANGELOG without prompting (non-interactive / CI)."),
    ("--skip-tests", "Skip the test step during analysis."),
    ("--skip-extensions", "Skip VS Code extension checks."),
    ("--skip-global-npm", "Skip global npm package checks."),
    ("--auto-install", "Auto-install .vsix without prompting (for CI)."),
    ("--no-logo", "Suppress the Saropa ASCII art logo."),
]


def parse_args() -> argparse.Namespace:
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(
        description="Saropa Log Capture — Developer Toolkit & Publish Pipeline",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    for flag, help_text in _CLI_FLAGS:
        parser.add_argument(flag, action="store_true", help=help_text)
    return parser.parse_args()


# ── Exit Codes ───────────────────────────────────────────────

_STEP_EXIT_CODES = {
    "Node.js": ExitCode.PREREQUISITE_FAILED,
    "npm": ExitCode.PREREQUISITE_FAILED,
    "git": ExitCode.PREREQUISITE_FAILED,
    "GitHub CLI": ExitCode.PREREQUISITE_FAILED,
    "VS Code CLI": ExitCode.PREREQUISITE_FAILED,
    "vsce PAT": ExitCode.PREREQUISITE_FAILED,
    "Global npm pkgs": ExitCode.PREREQUISITE_FAILED,
    "VS Code extensions": ExitCode.PREREQUISITE_FAILED,
    "Working tree": ExitCode.WORKING_TREE_DIRTY,
    "Remote sync": ExitCode.REMOTE_SYNC_FAILED,
    "Dependencies": ExitCode.DEPENDENCY_FAILED,
    "Compile": ExitCode.COMPILE_FAILED,
    "Tests": ExitCode.TEST_FAILED,
    "File line limits": ExitCode.QUALITY_FAILED,
    "Version validation": ExitCode.VERSION_INVALID,
    "Package": ExitCode.PACKAGE_FAILED,
    "Git commit & push": ExitCode.GIT_FAILED,
    "Git tag": ExitCode.GIT_FAILED,
    "Marketplace publish": ExitCode.PUBLISH_FAILED,
    "Open VSX publish": ExitCode.OPENVSX_FAILED,
    "GitHub release": ExitCode.RELEASE_FAILED,
}


def _exit_code_from_results(results: list[tuple[str, bool, float]]) -> int:
    """Derive an exit code from the last failing step name."""
    for name, passed, _ in reversed(results):
        if not passed:
            return _STEP_EXIT_CODES.get(name, 1)
    return 1


# ── Main ─────────────────────────────────────────────────────


def _print_banner(args: argparse.Namespace, version: str) -> None:
    """Print the script banner (logo or compact header)."""
    if not args.no_logo:
        show_logo(version)
    else:
        print(f"\n  {C.BOLD}Saropa Log Capture — Developer Toolkit{C.RESET}"
              f"  {dim(f'v{version}')}")
    print(f"  Project root: {dim(PROJECT_ROOT)}")


def main() -> int:
    """Main entry point — developer toolkit + publish pipeline.

    Flow:
    1. Run analysis phase (Steps 1-10) — all must pass
    2. Package .vsix and offer local install (always)
    3. If --analyze-only: stop here
    4. Otherwise: confirm → credentials → publish (Steps 11-15)
    """
    args = parse_args()
    version = read_package_version()
    results: list[tuple[str, bool, float]] = []

    _print_banner(args, version)

    # ── ANALYSIS PHASE ──
    version, passed = run_analysis(args, results)
    if not passed:
        print_timing(results)
        save_and_print_report(results, version)
        return _exit_code_from_results(results)

    # ── PACKAGE + LOCAL INSTALL ──
    vsix_path = package_and_install(args, results, version)
    if not vsix_path:
        return ExitCode.PACKAGE_FAILED

    # ── ANALYZE-ONLY: stop here ──
    if args.analyze_only:
        report = save_report(results, version, vsix_path)
        print_timing(results)
        print_report_path(report)
        if report:
            prompt_open_report(report)
        return ExitCode.SUCCESS

    # ── PUBLISH PHASE ──
    heading("Publish Confirmation")
    if not confirm_publish(version):
        info("Publish cancelled by user.")
        return ExitCode.USER_CANCELLED

    stores = "both"
    if not get_installed_extension_versions():
        stores = ask_publish_stores()
    if not run_publish(version, vsix_path, results, stores):
        return _exit_code_from_results(results)

    return ExitCode.SUCCESS


if __name__ == "__main__":
    sys.exit(main())

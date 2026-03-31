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
#     Step 16: Verify registries (poll APIs until version visible; 30s interval, 10 min max)
#
# .USAGE
#   python scripts/publish.py                   # full analyze + publish pipeline
#   python scripts/publish.py --analyze-only    # build + package + local install
#   python scripts/publish.py --skip-tests      # skip test step
#   python scripts/publish.py --skip-extensions # skip VS Code extension checks
#   python scripts/publish.py --skip-global-npm # skip global npm package checks
#   python scripts/publish.py --auto-install    # auto-install .vsix (no prompt)
#   python scripts/publish.py --no-logo         # suppress Saropa ASCII art
#   python scripts/publish.py --store-versions  # only Step 16 (registries vs package.json)
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
#                       16  STORE_VERSION_MISMATCH
#
# ##############################################################################

import argparse
import os
import shutil
import subprocess
import sys

# ── Bootstrap: auto-install optional dependencies ────────────
# These imports run before any project module because modules.constants
# calls colorama.init() at import time. If colorama is missing, the
# import would fail with an unhelpful traceback — so we install it first.
try:
    import colorama  # noqa: F401
except ImportError:
    print("Installing colorama for terminal colors…")
    subprocess.run(
        [sys.executable, "-m", "pip", "install", "colorama", "-q"],
        # check=False: don't crash if pip fails — the script can still
        # run without colors, just with raw ANSI escapes on some terminals.
        check=False,
        capture_output=True,
    )

# Python's readline module enables input() pre-fill and history editing.
# On Windows, the stdlib readline doesn't exist — pyreadline3 provides
# a drop-in replacement so the version-bump prompt can pre-populate the
# current version for the user to edit in-place.
if sys.platform == "win32":
    try:
        import readline  # noqa: F401
    except ImportError:
        try:
            import pyreadline3  # noqa: F401
        except ImportError:
            subprocess.run(
                [sys.executable, "-m", "pip", "install", "pyreadline3", "-q"],
                check=False,
                capture_output=True,
            )
            try:
                # Re-import after install so readline is available for
                # this session without requiring a script restart.
                import pyreadline3  # noqa: F401
            except ImportError:
                # Non-fatal: the version prompt will still work, it just
                # won't pre-fill the current version for editing.
                pass

# ── Project imports ──────────────────────────────────────────
# Grouped by layer: constants/config → display → data → actions.
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

# Boolean flags are defined as (flag, help) tuples so the parser loop
# below can add them all uniformly. Non-boolean args (like --on-test-fail)
# are added separately because they need extra argparse options.
_CLI_FLAGS = [
    ("--analyze-only", "Run analysis + build + package, offer local install. No publish."),
    ("--yes", "Accept version and stamp CHANGELOG without prompting (non-interactive / CI)."),
    ("--skip-tests", "Skip the test step during analysis."),
    ("--skip-extensions", "Skip VS Code extension checks."),
    ("--skip-global-npm", "Skip global npm package checks."),
    ("--auto-install", "Auto-install .vsix without prompting (for CI)."),
    ("--no-logo", "Suppress the Saropa ASCII art logo."),
    (
        "--store-versions",
        "Report Open VSX + VS Marketplace vs package.json (check-stores-version.ps1 -ReportOnly).",
    ),
]


def parse_args() -> argparse.Namespace:
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(
        description="Saropa Log Capture — Developer Toolkit & Publish Pipeline",
        # RawDescriptionHelpFormatter preserves whitespace in the epilog/description
        # so the .USAGE block renders correctly with `--help`.
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    for flag, help_text in _CLI_FLAGS:
        parser.add_argument(flag, action="store_true", help=help_text)
    # --on-test-fail controls test failure behavior without requiring
    # interactive input, making it suitable for CI pipelines.
    parser.add_argument(
        "--on-test-fail",
        choices=["ask", "retry", "skip", "stop"],
        default="ask",
        help="Behavior when tests fail: ask (interactive), retry, skip, or stop (default: ask).",
    )
    return parser.parse_args()


# ── Exit Codes ───────────────────────────────────────────────

# Maps human-readable step names (as stored in results tuples) to their
# corresponding process exit codes. This lets CI scripts distinguish
# _which_ phase failed without parsing stdout — e.g. exit 5 always
# means "compile failed" regardless of the error message text.
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
    "Store propagation": ExitCode.STORE_VERSION_MISMATCH,
}


def _exit_code_from_results(results: list[tuple[str, bool, float]]) -> int:
    """Derive an exit code from the last failing step name."""
    # Walk results in reverse so the exit code reflects the most recent
    # failure — earlier failures may have been superseded by later ones
    # (e.g. a test failure followed by a compile retry that also failed).
    for name, passed, _ in reversed(results):
        if not passed:
            return _STEP_EXIT_CODES.get(name, 1)
    # Fallback: if no explicit failure found, return generic error.
    # This shouldn't happen in practice — callers only invoke this
    # function when at least one step has failed.
    return 1


# ── Main ─────────────────────────────────────────────────────


def _check_stores_ps_and_script() -> tuple[str, str] | None:
    """Return (powershell_exe, script_path) for modules/check-stores-version.ps1, or None."""
    # Prefer pwsh (PowerShell Core, cross-platform) over the Windows-only
    # "powershell" / "powershell.exe" which ships with older .NET runtime.
    ps = shutil.which("pwsh") or shutil.which("powershell") or shutil.which("powershell.exe")
    if not ps:
        print(
            "ERROR: PowerShell not found (install PowerShell Core 'pwsh', or use Windows PowerShell).",
            file=sys.stderr,
        )
        return None
    # The store-version check lives in a separate PowerShell script because
    # it handles HTTP polling with retries — logic that's simpler in PS
    # than shelling out to curl/Invoke-WebRequest from Python.
    script = os.path.join(PROJECT_ROOT, "scripts", "modules", "check-stores-version.ps1")
    if not os.path.isfile(script):
        print(f"ERROR: Missing {script}", file=sys.stderr)
        return None
    return (ps, script)


def run_store_versions_report(expected_version: str) -> int:
    """Run modules/check-stores-version.ps1 -ReportOnly; store HTTP logic lives only in PowerShell."""
    pair = _check_stores_ps_and_script()
    if pair is None:
        return ExitCode.PREREQUISITE_FAILED
    ps, script = pair
    # -NoProfile: skip user's PS profile to avoid side-effects.
    # -ExecutionPolicy Bypass: allow unsigned local scripts without
    #   requiring a system-wide policy change.
    # -ReportOnly: print current store versions vs expected, don't poll.
    cmd = [
        ps,
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        script,
        "-ReportOnly",
        "-ExpectedVersion",
        expected_version,
    ]
    proc = subprocess.run(cmd, cwd=PROJECT_ROOT)
    if proc.returncode != 0:
        return ExitCode.STORE_VERSION_MISMATCH
    return ExitCode.SUCCESS


def run_store_propagation_wait(expected_version: str, stores: str) -> int:
    """Poll store APIs until the published version is visible (30s between attempts, 10 min max).

    stores: same values as publish flow — vscode_only, openvsx_only, or both.
    """
    pair = _check_stores_ps_and_script()
    if pair is None:
        return ExitCode.PREREQUISITE_FAILED
    ps, script = pair
    # Translate Python-side store identifiers (snake_case, used by the
    # publish orchestrator) to PowerShell-side parameter values (PascalCase,
    # expected by check-stores-version.ps1's -Stores param).
    stores_map = {
        "vscode_only": "Marketplace",
        "openvsx_only": "OpenVsx",
        "both": "Both",
    }
    stores_arg = stores_map.get(stores, "Both")
    # IntervalSeconds/TotalMinutes control the polling cadence. 30s keeps
    # us under any rate-limit while 10 min is enough for typical CDN
    # propagation on both Marketplace and Open VSX.
    cmd = [
        ps,
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        script,
        "-ExpectedVersion",
        expected_version,
        "-IntervalSeconds",
        "30",
        "-TotalMinutes",
        "10",
        "-Stores",
        stores_arg,
    ]
    proc = subprocess.run(cmd, cwd=PROJECT_ROOT)
    if proc.returncode != 0:
        return ExitCode.STORE_VERSION_MISMATCH
    return ExitCode.SUCCESS


def _print_banner(args: argparse.Namespace, version: str) -> None:
    """Print the script banner (logo or compact header)."""
    if not args.no_logo:
        # Full ASCII art logo — used in interactive sessions for branding.
        show_logo(version)
    else:
        # Compact one-liner — used in CI or when piping output, where the
        # multi-line logo would just add noise.
        print(f"\n  {C.BOLD}Saropa Log Capture — Developer Toolkit{C.RESET}"
              f"  {dim(f'v{version}')}")
    # Always show the project root so the user can verify the script is
    # operating on the intended directory (guards against running from
    # a stale checkout or wrong clone).
    print(f"  Project root: {dim(PROJECT_ROOT)}")


def main() -> int:
    """Main entry point — developer toolkit + publish pipeline.

    Flow:
    1. Run analysis phase (Steps 1-10) — all must pass
    2. Package .vsix and offer local install (always)
    3. If --analyze-only: stop here
    4. Otherwise: confirm → credentials → publish (Steps 11-15) → store propagation poll (Step 16)
    """
    args = parse_args()
    # Read current version from package.json — this is the source of truth
    # for the extension's identity across npm, VS Code, and Open VSX.
    version = read_package_version()

    # --store-versions is a standalone mode: just compare registry versions
    # against package.json and exit. No analysis, no build, no publish.
    if args.store_versions:
        _print_banner(args, version)
        heading("Store versions (registries vs package.json)")
        return run_store_versions_report(version)

    # Accumulates (step_name, passed, elapsed_seconds) tuples as each step
    # completes. Used for timing reports and to determine exit codes.
    results: list[tuple[str, bool, float]] = []

    _print_banner(args, version)

    # ── ANALYSIS PHASE ──
    # Steps 1-10: prerequisites, clean tree, compile, test, version.
    # run_analysis may update `version` if the user bumps it during Step 10.
    version, passed = run_analysis(args, results)
    if not passed:
        # Bail early but still emit timing + report so the developer can
        # see exactly which step failed and how long each step took.
        print_timing(results)
        save_and_print_report(results, version)
        return _exit_code_from_results(results)

    # ── PACKAGE + LOCAL INSTALL ──
    # Build the .vsix bundle and optionally install it into the local
    # VS Code instance so the developer can smoke-test before publishing.
    vsix_path = package_and_install(args, results, version)
    if not vsix_path:
        return ExitCode.PACKAGE_FAILED

    # ── ANALYZE-ONLY: stop here ──
    # In this mode the developer just wanted a build artifact + local test.
    # Save the report and offer to open it, but don't touch git or registries.
    if args.analyze_only:
        report = save_report(results, version, vsix_path)
        print_timing(results)
        print_report_path(report)
        if report:
            prompt_open_report(report)
        return ExitCode.SUCCESS

    # ── PUBLISH PHASE ──
    # Everything below is irreversible (git push, marketplace upload),
    # so we gate it behind an explicit confirmation prompt.
    heading("Publish Confirmation")
    if not confirm_publish(version):
        info("Publish cancelled by user.")
        return ExitCode.USER_CANCELLED

    # Default to publishing to both stores. If neither vsce nor ovsx CLIs
    # are detected, ask the user which store(s) they have credentials for.
    stores = "both"
    if not get_installed_extension_versions():
        stores = ask_publish_stores()
    # Steps 11-15: commit, tag, marketplace publish, Open VSX, GitHub release.
    if not run_publish(version, vsix_path, results, stores):
        return _exit_code_from_results(results)

    # Step 16: poll registry APIs until the new version is live. This
    # catches CDN propagation delays so we don't close the terminal
    # thinking the release is done when users still see the old version.
    heading("Step 16 · Verify store propagation")
    info("Polling registry APIs until the new version is visible (30s interval, 10 min max).")
    store_rc = run_store_propagation_wait(version, stores)
    if store_rc != ExitCode.SUCCESS:
        return store_rc
    return ExitCode.SUCCESS


if __name__ == "__main__":
    sys.exit(main())

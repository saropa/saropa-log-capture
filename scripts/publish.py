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
#     Step 10: Version & CHANGELOG (resolve version, stamp CHANGELOG, verify release intro + log link)
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
#   python scripts/publish.py --non-interactive # no prompts, safe defaults (CI / remote / Claude)
#   python scripts/publish.py --log-file        # tee output to auto-timestamped log in reports/
#   python scripts/publish.py --log-file out.log  # tee output to a specific file
#
# .NOTES
#   Version:      4.1.0
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
import datetime
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

# cspell:ignore mismeasures Pr_ceed

# Deliberately NOT importing readline / pyreadline3. The pyreadline3 shim is
# the only "readline" available on Windows, and merely importing it makes
# Python's input() route through it for EVERY prompt. In the VS Code integrated
# terminal pyreadline3 cannot track the cursor: it mismeasures prompt width and
# repositions onto the line above, so the question is hidden or overwritten and
# the cursor lands mid-word in a printed line (corrupting "Proceed with
# publish?" → "Pr_ceed"). Native input() writes the prompt straight to the
# terminal, which renders ANSI color and tracks the cursor correctly.
# Trade-off: the version-bump prompt no longer pre-fills the current version for
# in-place editing — it is shown in the prompt instead and Enter accepts it.

# Force UTF-8 stdout so non-ASCII output never crashes the pipeline on a legacy
# cp1252 Windows console. Step 9 now prints the l10n manual-translation gap list
# verbatim — em dashes, ellipses, and CJK strings — which a cp1252 stdout cannot
# encode. Must run before colorama.init() (triggered by the project imports
# below) so colorama wraps the already-UTF-8 stream. Mirrors translate_l10n.py.
import io
try:
    if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
        sys.stdout = io.TextIOWrapper(
            sys.stdout.buffer, encoding="utf-8", errors="replace",
        )
except (AttributeError, ValueError):
    # Already-wrapped or detached stdout (e.g. under a test runner) — leave it.
    pass

# ── Log tee ──────────────────────────────────────────────────
# Duplicates all writes to both the original stream and a log file,
# so remote/CI runs capture full output without losing terminal display.
# Strips ANSI escape codes from the file copy since log viewers choke on them.

import re as _re

# Pre-compiled pattern for stripping ANSI escape sequences from log output.
# Matches CSI sequences (colors, cursor moves) and OSC sequences (title sets).
_ANSI_RE = _re.compile(r"\x1b\[[0-9;]*[A-Za-z]|\x1b\].*?\x07")


class _TeeWriter:
    """Write to both the original stream and a log file simultaneously.

    ANSI escape codes are stripped from the file copy so the log is
    human-readable in plain-text editors and grep-friendly in CI.
    """

    def __init__(self, original: io.TextIOBase, log_file: io.TextIOBase) -> None:
        self._original = original
        self._log_file = log_file

    def write(self, text: str) -> int:
        """Write text to both streams; strip ANSI for the file copy."""
        self._original.write(text)
        self._log_file.write(_ANSI_RE.sub("", text))
        return len(text)

    def flush(self) -> None:
        """Flush both streams so output appears promptly in remote monitors."""
        self._original.flush()
        self._log_file.flush()

    # Forward attribute access (encoding, buffer, etc.) to the original
    # stream so colorama and the UTF-8 wrapper still work correctly.
    def __getattr__(self, name: str):
        return getattr(self._original, name)


# ── Project imports ──────────────────────────────────────────
# Grouped by layer: constants/config → display → data → actions.
from modules.publish.constants import C, ExitCode, PROJECT_ROOT
from modules.publish.display import dim, heading, info, show_logo
from modules.publish.utils import get_installed_extension_versions, read_package_version
from modules.publish.report import print_timing, save_report
from modules.publish.install import prompt_open_report
from modules.publish.publish_confirm import confirm_publish
from modules.publish.orchestrator import (
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
    (
        "--non-interactive",
        "No prompts; use safe defaults for all choices. "
        "Implies --yes --no-logo --auto-install --on-test-fail stop.",
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
    # --log-file tees all output to a file for remote/CI monitoring.
    # Omit the path to auto-generate a timestamped file in reports/.
    parser.add_argument(
        "--log-file",
        nargs="?",
        const="auto",
        default=None,
        metavar="PATH",
        help="Tee all output to a log file. Omit PATH for auto-generated reports/<date>/run_*.log.",
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
    "Manifest compat": ExitCode.PREREQUISITE_FAILED,
    "vsce PAT": ExitCode.PREREQUISITE_FAILED,
    "Global npm pkgs": ExitCode.PREREQUISITE_FAILED,
    "VS Code extensions": ExitCode.PREREQUISITE_FAILED,
    "Working tree": ExitCode.WORKING_TREE_DIRTY,
    "Remote sync": ExitCode.REMOTE_SYNC_FAILED,
    "Dependencies": ExitCode.DEPENDENCY_FAILED,
    "Compile": ExitCode.COMPILE_FAILED,
    "Tests": ExitCode.TEST_FAILED,
    "File line limits": ExitCode.QUALITY_FAILED,
    "l10n bundle alignment": ExitCode.QUALITY_FAILED,
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


# ── Non-interactive & logging setup ──────────────────────────


def _apply_non_interactive(args: argparse.Namespace) -> None:
    """Force safe defaults for every interactive prompt.

    Closes stdin so every input() call in submodules raises EOFError,
    which their existing handlers already catch and resolve to the safe
    default (stop, ignore, accept suggested version, etc.).
    """
    args.yes = True
    args.no_logo = True
    args.auto_install = True
    # Deterministic test-failure behavior — don't hang waiting for a human.
    args.on_test_fail = "stop"
    # Close stdin so input() immediately raises EOFError everywhere.
    # The version module also checks sys.stdin.isatty(), which returns
    # False on a closed fd, giving us non-interactive behavior for free.
    try:
        sys.stdin.close()
    except Exception:
        pass


def _setup_log_file(args: argparse.Namespace) -> io.TextIOBase | None:
    """Open the log file and tee stdout/stderr into it.

    Returns the open file handle (caller closes it), or None if logging
    was not requested. When args.log_file is 'auto', generates a
    timestamped path under reports/<yyyymmdd>/.
    """
    path = args.log_file
    if path is None:
        return None

    if path == "auto":
        # Mirror the date-subfolder convention from report.py so all
        # pipeline output for a given day lands in the same directory.
        now = datetime.datetime.now()
        date_folder = now.strftime("%Y%m%d")
        log_dir = os.path.join(PROJECT_ROOT, "reports", date_folder)
        os.makedirs(log_dir, exist_ok=True)
        ts = now.strftime("%Y%m%d_%H%M%S")
        path = os.path.join(log_dir, f"{ts}_pipeline_run.log")

    # Ensure parent directory exists for user-supplied paths too.
    parent = os.path.dirname(os.path.abspath(path))
    os.makedirs(parent, exist_ok=True)

    log_fh = open(path, "w", encoding="utf-8")
    # Tee both streams so errors and warnings are captured alongside info.
    sys.stdout = _TeeWriter(sys.stdout, log_fh)
    sys.stderr = _TeeWriter(sys.stderr, log_fh)
    print(f"  Logging to: {os.path.abspath(path)}")
    return log_fh


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
    script = os.path.join(PROJECT_ROOT, "scripts", "modules", "publish", "check-stores-version.ps1")
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

    # --non-interactive closes stdin and forces safe defaults for every
    # prompt, so the entire pipeline can run unattended (CI, SSH, Claude).
    if args.non_interactive:
        _apply_non_interactive(args)

    # --log-file tees all output to a file. Must run after non-interactive
    # (which may set --no-logo) but before any output is printed.
    log_fh = _setup_log_file(args)

    # Read current version from package.json — this is the source of truth
    # for the extension's identity across npm, VS Code, and Open VSX.
    version = read_package_version()

    # --store-versions is a standalone mode: just compare registry versions
    # against package.json and exit. No analysis, no build, no publish.
    if args.store_versions:
        _print_banner(args, version)
        heading("Store versions (registries vs package.json)")
        rc = run_store_versions_report(version)
        if log_fh:
            log_fh.close()
        return rc

    # Accumulates (step_name, passed, elapsed_seconds) tuples as each step
    # completes. Used for timing reports and to determine exit codes.
    results: list[tuple[str, bool, float]] = []

    try:
        _print_banner(args, version)

        # Best-effort sweep of stale coverage/test junk (.nyc_output/, coverage/)
        # left by prior manual runs, before compile touches out/.
        from modules.publish.checks_build import cleanup_stray_output
        cleanup_stray_output()

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

    finally:
        # Close the log file handle so the full output is flushed to disk,
        # even on early returns or unhandled exceptions.
        if log_fh:
            log_fh.close()


if __name__ == "__main__":
    sys.exit(main())

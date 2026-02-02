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
#     Step 10: Version sync & validation (CHANGELOG → package.json)
#
#   Analyze-only mode (--analyze-only):
#     → Package .vsix, show install instructions, offer local install
#
#   Publish phase (irreversible, needs confirmation):
#     Step 11: Finalize CHANGELOG ([Unreleased] -> [version] - today's date)
#     Step 12: Package .vsix
#     Step 13: Git commit & push
#     Step 14: Git tag (v{version})
#     Step 15: Publish to VS Code Marketplace
#     Step 16: Create GitHub release (attach .vsix)
#
# .USAGE
#   python scripts/dev.py                   # full analyze + publish pipeline
#   python scripts/dev.py --analyze-only    # build + package + local install
#   python scripts/dev.py --skip-tests      # skip test step
#   python scripts/dev.py --skip-extensions # skip VS Code extension checks
#   python scripts/dev.py --skip-global-npm # skip global npm package checks
#   python scripts/dev.py --auto-install    # auto-install .vsix (no prompt)
#   python scripts/dev.py --no-logo         # suppress Saropa ASCII art
#
# .NOTES
#   Version:      3.0.0
#   Requires:     Python 3.10+
#   Optional:     colorama (`pip install colorama`) for Windows color support
#
# Exit Codes:
#    0  SUCCESS              8  VERSION_INVALID
#    1  PREREQUISITE_FAILED  9  CHANGELOG_FAILED
#    2  WORKING_TREE_DIRTY  10  PACKAGE_FAILED
#    3  REMOTE_SYNC_FAILED  11  GIT_FAILED
#    4  DEPENDENCY_FAILED   12  PUBLISH_FAILED
#    5  COMPILE_FAILED      13  RELEASE_FAILED
#    6  TEST_FAILED         14  USER_CANCELLED
#    7  QUALITY_FAILED
#
# ##############################################################################

import argparse
import os
import sys
import time

from modules.constants import C, ExitCode, PROJECT_ROOT
from modules.display import dim, heading, info, ok, show_logo, warn
from modules.utils import read_package_version, run, run_step

from modules.checks_prereqs import (
    check_gh_cli,
    check_git,
    check_node,
    check_npm,
    check_vsce_auth,
)
from modules.checks_environment import (
    check_global_npm_packages,
    check_vscode_cli,
    check_vscode_extensions,
)
from modules.checks_project import (
    check_file_line_limits,
    check_remote_sync,
    check_working_tree,
    ensure_dependencies,
    step_compile,
    step_test,
    validate_version_changelog,
)
from modules.publish import (
    confirm_publish,
    create_git_tag,
    create_github_release,
    finalize_changelog,
    git_commit_and_push,
    publish_marketplace,
    step_package,
)
from modules.report import (
    print_success_banner,
    print_timing,
    save_report,
)
from modules.install import (
    print_install_instructions,
    prompt_install,
    prompt_open_report,
)


# ── CLI ──────────────────────────────────────────────────────

# Argument definitions: (flag, help text)
_CLI_FLAGS = [
    ("--analyze-only", "Run analysis + build + package, offer local install. No publish."),
    ("--skip-tests", "Skip the test step during analysis."),
    ("--skip-extensions", "Skip VS Code extension checks."),
    ("--skip-global-npm", "Skip global npm package checks."),
    ("--auto-install", "Auto-install .vsix without prompting (for CI)."),
    ("--no-logo", "Suppress the Saropa ASCII art logo."),
]


def parse_args() -> argparse.Namespace:
    """Parse command-line arguments.

    All flags are boolean store_true. Definitions live in _CLI_FLAGS
    to keep this function short.
    """
    parser = argparse.ArgumentParser(
        description="Saropa Log Capture — Developer Toolkit & Publish Pipeline",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    for flag, help_text in _CLI_FLAGS:
        parser.add_argument(flag, action="store_true", help=help_text)
    return parser.parse_args()


# ── Orchestration ─────────────────────────────────────────────
# The pipeline is split into small orchestrator functions to keep each
# under the 30-line limit. The flow is:
#   main() → _run_analysis() → _run_build_and_validate()
#                             → confirm_publish() → _run_publish()


def _run_prerequisites(
    args: argparse.Namespace,
    results: list[tuple[str, bool, float]],
) -> bool:
    """Step 1: Check all prerequisite tools. Returns True if all pass.

    Checks Node, npm, git, and VS Code CLI. Publishing credentials
    (gh CLI, vsce PAT) are checked later, only after the user
    confirms publish intent — so they never block local builds.
    """
    heading("Step 1 · Prerequisites")
    for name, fn in [
        ("Node.js", check_node),
        ("npm", check_npm),
        ("git", check_git),
        ("VS Code CLI", check_vscode_cli),
    ]:
        if not run_step(name, fn, results):
            return False
    return True


def _run_dev_checks(
    args: argparse.Namespace,
    results: list[tuple[str, bool, float]],
) -> bool:
    """Steps 2-6: Dev environment setup and git state checks.

    Installs global npm packages and VS Code extensions (if not skipped),
    then verifies git state and project dependencies.
    """
    # Step 2: Global npm packages (skippable)
    if args.skip_global_npm:
        heading("Step 2 · Global npm Packages (skipped)")
    else:
        heading("Step 2 · Global npm Packages")
        if not run_step("Global npm pkgs",
                        check_global_npm_packages, results):
            return False

    # Step 3: VS Code extensions (skippable)
    if args.skip_extensions:
        heading("Step 3 · VS Code Extensions (skipped)")
    else:
        heading("Step 3 · VS Code Extensions")
        if not run_step("VS Code extensions",
                        check_vscode_extensions, results):
            return False

    # Step 4: Verify no unexpected uncommitted changes
    heading("Step 4 · Working Tree")
    if not run_step("Working tree", check_working_tree, results):
        return False

    # Step 5: Ensure we're building on top of the latest remote code
    heading("Step 5 · Remote Sync")
    if not run_step("Remote sync", check_remote_sync, results):
        return False

    # Step 6: Install/update node_modules if needed
    heading("Step 6 · Dependencies")
    if not run_step("Dependencies", ensure_dependencies, results):
        return False

    return True


def _run_analysis(
    args: argparse.Namespace,
    results: list[tuple[str, bool, float]],
) -> tuple[str, bool]:
    """Run all analysis steps (1-10). Returns (version, all_passed).

    Steps are ordered to fail fast on the cheapest checks first:
    prerequisites → dev env → git state → deps → compile → tests →
    quality → version sync & validation.
    """
    if not _run_prerequisites(args, results):
        return "", False
    if not _run_dev_checks(args, results):
        return "", False
    return _run_build_and_validate(args, results)


def _run_build_and_validate(
    args: argparse.Namespace,
    results: list[tuple[str, bool, float]],
) -> tuple[str, bool]:
    """Run compile, test, quality, and version steps (7-10).

    Split from _run_analysis() to keep each orchestrator under 30 lines.
    """
    # Step 7: Full compile (type-check + lint + esbuild bundle)
    heading("Step 7 · Compile")
    if not run_step("Compile", step_compile, results):
        return "", False

    # Step 8: Tests (skippable for quick iteration during development)
    if args.skip_tests:
        heading("Step 8 · Tests (skipped)")
    else:
        heading("Step 8 · Tests")
        if not run_step("Tests", step_test, results):
            return "", False

    # Step 9: Enforce the 300-line .ts file limit
    heading("Step 9 · Quality Checks")
    if not run_step("File line limits", check_file_line_limits, results):
        return "", False

    # Step 10: Sync package.json from CHANGELOG, verify tag is available.
    # Uses manual timing because validate_version_changelog()
    # returns a tuple rather than a simple bool.
    heading("Step 10 · Version Sync & Validation")
    t0 = time.time()
    version, version_ok = validate_version_changelog()
    elapsed = time.time() - t0
    results.append(("Version validation", version_ok, elapsed))
    if not version_ok:
        return "", False

    return version, True


def _run_publish_steps(
    version: str,
    results: list[tuple[str, bool, float]],
) -> str | None:
    """Run publish steps 11-14 (CHANGELOG, package, commit, tag).

    Returns the vsix_path on success, or None if any step fails.
    Split from _run_publish() to keep each orchestrator under 30 lines.
    """
    # Step 11: Stamp the CHANGELOG with today's date
    heading("Step 11 · Finalize CHANGELOG")
    if not run_step("Finalize CHANGELOG",
                    lambda: finalize_changelog(version), results):
        return None

    # Step 12: Build the .vsix package
    heading("Step 12 · Package")
    t0 = time.time()
    vsix_path = step_package()
    elapsed = time.time() - t0
    results.append(("Package", vsix_path is not None, elapsed))
    if not vsix_path:
        return None

    # Step 13: Commit the finalized CHANGELOG + any other changes
    heading("Step 13 · Git Commit & Push")
    if not run_step("Git commit & push",
                    lambda: git_commit_and_push(version), results):
        return None

    # Step 14: Tag the release commit
    heading("Step 14 · Git Tag")
    if not run_step("Git tag",
                    lambda: create_git_tag(version), results):
        return None

    return vsix_path


def _check_publish_credentials(
    results: list[tuple[str, bool, float]],
) -> bool:
    """Verify gh CLI and vsce PAT before irreversible publish steps.

    Checked after the user confirms publish intent, so these
    credentials never block local builds or analyze-only runs.
    """
    heading("Publish Credentials")
    if not run_step("GitHub CLI", check_gh_cli, results):
        return False
    if not run_step("vsce PAT", check_vsce_auth, results):
        return False
    return True


def _run_publish(
    version: str,
    results: list[tuple[str, bool, float]],
) -> bool:
    """Run all publish steps (11-16). Returns True on success.

    If the GitHub release (Step 16) fails but marketplace publish
    (Step 15) succeeded, we warn but still consider the publish
    successful — the extension is live, just missing its GH release.
    """
    if not _check_publish_credentials(results):
        return False
    vsix_path = _run_publish_steps(version, results)
    if not vsix_path:
        return False

    # Step 15: Upload to VS Code Marketplace
    heading("Step 15 · Publish to Marketplace")
    if not run_step("Marketplace publish",
                    lambda: publish_marketplace(vsix_path), results):
        return False

    # Step 16: Create GitHub release with .vsix attached
    heading("Step 16 · GitHub Release")
    if not run_step("GitHub release",
                    lambda: create_github_release(version, vsix_path),
                    results):
        # Non-fatal: the extension is already live on the marketplace
        warn("Marketplace publish succeeded but GitHub release failed.")
        warn(f"Create manually: gh release create v{version}")

    _finish_with_report(results, version, vsix_path)
    return True


def _finish_with_report(
    results: list[tuple[str, bool, float]],
    version: str,
    vsix_path: str,
) -> None:
    """Save the publish report, print timing chart, and show success banner."""
    report = save_report(results, version, vsix_path, is_publish=True)
    print_timing(results)
    print_success_banner(version, vsix_path)
    _print_report_path(report)


def _print_banner(args: argparse.Namespace, version: str) -> None:
    """Print the script banner (logo or compact header)."""
    if not args.no_logo:
        show_logo(version)
    else:
        print(f"\n  {C.BOLD}Saropa Log Capture — Developer Toolkit{C.RESET}"
              f"  {dim(f'v{version}')}")
    print(f"  Project root: {dim(PROJECT_ROOT)}")


def _save_and_print_report(
    results: list[tuple[str, bool, float]],
    version: str,
) -> None:
    """Save an analysis report and print its path."""
    report = save_report(results, version or "unknown")
    _print_report_path(report)


def _print_report_path(report: str | None) -> None:
    """Print the report file path if a report was saved."""
    if report:
        rel = os.path.relpath(report, PROJECT_ROOT)
        ok(f"Report: {C.WHITE}{rel}{C.RESET}")


def _package_and_install(
    args: argparse.Namespace,
    results: list[tuple[str, bool, float]],
    version: str,
) -> str | None:
    """Package .vsix and offer local install. Returns vsix path.

    Always runs after analysis, regardless of whether the user
    intends to publish. This ensures local testing before publishing.
    """
    heading("Package")
    t0 = time.time()
    vsix_path = step_package()
    elapsed = time.time() - t0
    results.append(("Package", vsix_path is not None, elapsed))

    if not vsix_path:
        print_timing(results)
        _save_and_print_report(results, version)
        return None

    heading("Local Install")
    ok(f"VSIX: {C.WHITE}{os.path.basename(vsix_path)}{C.RESET}")
    print_install_instructions(vsix_path)
    if args.auto_install:
        _auto_install_vsix(vsix_path)
    else:
        prompt_install(vsix_path)

    return vsix_path


def _auto_install_vsix(vsix_path: str) -> None:
    """CI mode: install .vsix via code CLI without prompting."""
    vsix_name = os.path.basename(vsix_path)
    info(f"Running: code --install-extension {vsix_name}")
    run(["code", "--install-extension", os.path.abspath(vsix_path)])


def main() -> int:
    """Main entry point — developer toolkit + publish pipeline.

    Flow:
    1. Run analysis phase (Steps 1-10) — all must pass
    2. Package .vsix and offer local install (always)
    3. If --analyze-only: stop here
    4. Otherwise: confirm → check credentials → publish (Steps 11-16)
    """
    args = parse_args()
    version = read_package_version()
    # Accumulates (name, passed, elapsed) tuples for timing and reporting
    results: list[tuple[str, bool, float]] = []

    _print_banner(args, version)

    # ── ANALYSIS PHASE (read-only, idempotent) ──
    version, passed = _run_analysis(args, results)
    if not passed:
        print_timing(results)
        _save_and_print_report(results, version)
        return _exit_code_from_results(results)

    # ── PACKAGE + LOCAL INSTALL (always, before publish) ──
    vsix_path = _package_and_install(args, results, version)
    if not vsix_path:
        return ExitCode.PACKAGE_FAILED

    # ── ANALYZE-ONLY: stop here ──
    if args.analyze_only:
        report = save_report(results, version, vsix_path)
        print_timing(results)
        _print_report_path(report)
        if report:
            prompt_open_report(report)
        return ExitCode.SUCCESS

    # ── PUBLISH PHASE (irreversible — requires explicit "y") ──
    heading("Publish Confirmation")
    if not confirm_publish(version):
        info("Publish cancelled by user.")
        return ExitCode.USER_CANCELLED

    if not _run_publish(version, results):
        return _exit_code_from_results(results)

    return ExitCode.SUCCESS


# Maps step names to exit codes for _exit_code_from_results().
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
    "Finalize CHANGELOG": ExitCode.CHANGELOG_FAILED,
    "Package": ExitCode.PACKAGE_FAILED,
    "Git commit & push": ExitCode.GIT_FAILED,
    "Git tag": ExitCode.GIT_FAILED,
    "Marketplace publish": ExitCode.PUBLISH_FAILED,
    "GitHub release": ExitCode.RELEASE_FAILED,
}


def _exit_code_from_results(
    results: list[tuple[str, bool, float]],
) -> int:
    """Derive an exit code from the last failing step name.

    Walks the results list in reverse to find the most recent failure,
    then maps its step name to the corresponding ExitCode value.
    """
    for name, passed, _ in reversed(results):
        if not passed:
            return _STEP_EXIT_CODES.get(name, 1)
    return 1


if __name__ == "__main__":
    sys.exit(main())

# -*- coding: utf-8 -*-
"""Pipeline orchestration: step runners and flow control.

This module contains the orchestration logic that ties together
all the individual check, build, and publish steps into a cohesive
pipeline. It manages the flow between analysis, packaging, and
publishing phases.
"""

import argparse
import os
import time

from modules.constants import C, PROJECT_ROOT
from modules.display import heading, info, ok, warn
from modules.utils import (
    get_installed_extension_versions,
    get_ovsx_pat,
    run,
    run_step,
)

from modules.checks_prereqs import (
    check_gh_cli,
    check_git,
    check_node,
    check_npm,
    check_ovsx_token,
    check_vsce_auth,
)
from modules.checks_environment import (
    check_global_npm_packages,
    check_vscode_cli,
    check_vscode_extensions,
)
from modules.checks_git import check_remote_sync, check_working_tree
from modules.checks_build import (
    check_file_line_limits,
    ensure_dependencies,
    step_compile,
    step_test,
)
from modules.version import validate_version_changelog
from modules.publish_git import create_git_tag, git_commit_and_push, is_version_tagged
from modules.publish_release import (
    create_github_release,
    get_marketplace_published_version,
    publish_marketplace,
    publish_openvsx,
    step_package,
)
from modules.report import print_success_banner, print_timing, save_report
from modules.install import print_install_instructions, prompt_install


def run_prerequisites(
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


def run_dev_checks(
    args: argparse.Namespace,
    results: list[tuple[str, bool, float]],
) -> bool:
    """Steps 2-6: Dev environment setup and git state checks.

    Installs global npm packages and VS Code extensions (if not skipped),
    then verifies git state and project dependencies.
    """
    if args.skip_global_npm:
        heading("Step 2 · Global npm Packages (skipped)")
    else:
        heading("Step 2 · Global npm Packages")
        if not run_step("Global npm pkgs", check_global_npm_packages, results):
            return False

    if args.skip_extensions:
        heading("Step 3 · VS Code Extensions (skipped)")
    else:
        heading("Step 3 · VS Code Extensions")
        if not run_step("VS Code extensions", check_vscode_extensions, results):
            return False

    heading("Step 4 · Working Tree")
    if not run_step("Working tree", check_working_tree, results):
        return False

    heading("Step 5 · Remote Sync")
    if not run_step("Remote sync", check_remote_sync, results):
        return False

    heading("Step 6 · Dependencies")
    if not run_step("Dependencies", ensure_dependencies, results):
        return False

    return True


def run_build_and_validate(
    args: argparse.Namespace,
    results: list[tuple[str, bool, float]],
) -> tuple[str, bool]:
    """Run compile, test, quality, and version steps (7-10).

    Returns (version, all_passed).
    """
    heading("Step 7 · Compile")
    if not run_step("Compile", step_compile, results):
        return "", False

    if args.skip_tests:
        heading("Step 8 · Tests (skipped)")
    else:
        heading("Step 8 · Tests")
        if not run_step("Tests", step_test, results):
            return "", False

    heading("Step 9 · Quality Checks")
    if not run_step("File line limits", check_file_line_limits, results):
        return "", False

    heading("Step 10 · Version & CHANGELOG")
    if getattr(args, "yes", False):
        os.environ["PUBLISH_YES"] = "1"
    t0 = time.time()
    version, version_ok = validate_version_changelog()
    elapsed = time.time() - t0
    results.append(("Version validation", version_ok, elapsed))
    if not version_ok:
        return "", False

    return version, True


def run_analysis(
    args: argparse.Namespace,
    results: list[tuple[str, bool, float]],
) -> tuple[str, bool]:
    """Run all analysis steps (1-10). Returns (version, all_passed).

    Steps are ordered to fail fast on the cheapest checks first.
    """
    if not run_prerequisites(args, results):
        return "", False
    if not run_dev_checks(args, results):
        return "", False
    return run_build_and_validate(args, results)


def ask_publish_stores() -> str:
    """Ask which store(s) to publish to when extension is not installed locally.

    Returns 'vscode_only', 'openvsx_only', or 'both'.
    """
    print(f"\n  {C.YELLOW}Which store(s) to publish to?{C.RESET}")
    print("    1 = VS Code Marketplace only")
    print("    2 = Open VSX only (Cursor / VSCodium)")
    print("    3 = both")
    try:
        raw = input(f"  Choice [3]: {C.RESET}").strip() or "3"
    except (EOFError, KeyboardInterrupt):
        print()
        return "both"
    if raw == "1":
        return "vscode_only"
    if raw == "2":
        return "openvsx_only"
    return "both"


def run_publish_steps(
    version: str,
    vsix_path: str,
    results: list[tuple[str, bool, float]],
    stores: str = "both",
) -> bool:
    """Commit, tag, and publish. Returns True on success.

    stores: 'vscode_only', 'openvsx_only', or 'both'. When version is
    already tagged (publish as-is), skip commit and tag.
    """
    if is_version_tagged(version):
        heading("Step 11 · Git Commit & Push")
        info(f"Tag v{version} already exists; skipping commit & tag.")
        heading("Step 12 · Git Tag")
        info("Skipped (tag exists).")
    else:
        heading("Step 11 · Git Commit & Push")
        if not run_step("Git commit & push",
                        lambda: git_commit_and_push(version), results):
            return False
        heading("Step 12 · Git Tag")
        if not run_step("Git tag",
                        lambda: create_git_tag(version), results):
            return False

    heading("Step 13 · Publish to Marketplace")
    if stores == "openvsx_only":
        info("Skipping (publish to Open VSX only).")
    else:
        published = get_marketplace_published_version()
        if published == version:
            info(f"VS Code Marketplace already has v{version}; skipping.")
        else:
            if not run_step("Marketplace publish",
                            lambda: publish_marketplace(vsix_path), results):
                return False

    heading("Step 14 · Publish to Open VSX")
    if stores == "vscode_only":
        info("Skipping (publish to VS Code Marketplace only).")
    else:
        pat = get_ovsx_pat()
        if not pat:
            try:
                import getpass
                prompt = "Paste Open VSX token (publish to Cursor) or Enter to skip: "
                pat = (getpass.getpass(prompt=prompt) or "").strip()
                if pat:
                    os.environ["OVSX_PAT"] = pat
            except (EOFError, KeyboardInterrupt):
                pat = ""
            if not pat:
                warn("No token; skipping Open VSX.")
        if pat:
            openvsx_ok = run_step("Open VSX publish",
                                  lambda: publish_openvsx(vsix_path), results)
            if not openvsx_ok:
                warn("Open VSX publish failed; continuing to GitHub release.")

    heading("Step 15 · GitHub Release")
    if not run_step("GitHub release",
                    lambda: create_github_release(version, vsix_path),
                    results):
        warn("Marketplace/Open VSX publish succeeded but GitHub release failed.")
        warn(f"Create manually: gh release create v{version}")

    return True


def check_publish_credentials(
    results: list[tuple[str, bool, float]],
    stores: str = "both",
) -> bool:
    """Verify credentials for chosen store(s)."""
    heading("Publish Credentials")
    if not run_step("GitHub CLI", check_gh_cli, results):
        return False
    if stores in ("both", "vscode_only"):
        if not run_step("vsce PAT", check_vsce_auth, results):
            return False
    else:
        info("Skipping vsce PAT (publish to Open VSX only).")
    if stores in ("both", "openvsx_only"):
        run_step("OVSX PAT", check_ovsx_token, results)
    else:
        info("Skipping OVSX PAT (publish to VS Code Marketplace only).")
    return True


def run_publish(
    version: str,
    vsix_path: str,
    results: list[tuple[str, bool, float]],
    stores: str,
) -> bool:
    """Run publish steps (11-15). Returns True on success."""
    if not check_publish_credentials(results, stores):
        return False
    if not run_publish_steps(version, vsix_path, results, stores=stores):
        return False

    finish_with_report(results, version, vsix_path)
    return True


def finish_with_report(
    results: list[tuple[str, bool, float]],
    version: str,
    vsix_path: str,
) -> None:
    """Save the publish report, print timing chart, and show success banner."""
    report = save_report(results, version, vsix_path, is_publish=True)
    print_timing(results)
    print_success_banner(version, vsix_path)
    print_report_path(report)


def print_report_path(report: str | None) -> None:
    """Print the report file path if a report was saved."""
    if report:
        rel = os.path.relpath(report, PROJECT_ROOT)
        ok(f"Report: {C.WHITE}{rel}{C.RESET}")


def save_and_print_report(
    results: list[tuple[str, bool, float]],
    version: str,
) -> None:
    """Save an analysis report and print its path."""
    report = save_report(results, version or "unknown")
    print_report_path(report)


def package_and_install(
    args: argparse.Namespace,
    results: list[tuple[str, bool, float]],
    version: str,
) -> str | None:
    """Package .vsix and offer local install. Returns vsix path.

    Always runs after analysis, regardless of whether the user
    intends to publish. This ensures local testing before publishing.
    """
    import sys

    heading("Package")
    t0 = time.time()
    vsix_path = step_package()
    elapsed = time.time() - t0
    results.append(("Package", vsix_path is not None, elapsed))

    if not vsix_path:
        print_timing(results)
        save_and_print_report(results, version)
        return None

    heading("Local Install")
    ok(f"VSIX: {C.WHITE}{os.path.basename(vsix_path)}{C.RESET}")
    installed = get_installed_extension_versions()
    if installed:
        parts = [f"{editor} v{ver}" for editor, ver in sorted(installed.items())]
        info(f"Installed locally: {', '.join(parts)}")
    else:
        info("Not installed in VS Code or Cursor.")
    print_install_instructions(vsix_path)
    if args.auto_install:
        auto_install_vsix(vsix_path)
    else:
        prompt_install(vsix_path)

    return vsix_path


def auto_install_vsix(vsix_path: str) -> None:
    """CI mode: install .vsix via code CLI without prompting."""
    import sys
    vsix_name = os.path.basename(vsix_path)
    info(f"Running: code --install-extension {vsix_name}")
    if sys.platform == "win32":
        info("A VS Code window may briefly appear...")
    run(["code", "--install-extension", os.path.abspath(vsix_path)])

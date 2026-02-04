#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# ##############################################################################
# Saropa Log Capture — Extension Removal Script
# ##############################################################################
#
# .SYNOPSIS
#   Completely remove Saropa Log Capture from VS Code.
#
# .DESCRIPTION
#   Removes all traces of the extension from the local VS Code installation:
#     Step 1: Uninstall via VS Code CLI
#     Step 2: Remove extension files from ~/.vscode/extensions/
#     Step 3: Remove global storage data
#     Step 4: Clear workspace state databases (fixes stuck webviews)
#     Step 5: Remove Extension Development Host state
#
#   Every destructive step requires explicit confirmation.
#   VS Code is NEVER killed automatically — the user is warned to close it.
#
# .USAGE
#   python scripts/remove_extension.py
#   python scripts/remove_extension.py --no-logo
#
# ##############################################################################

import argparse
import glob
import json
import os
import shutil
import sys

from modules.constants import C, PROJECT_ROOT
from modules.display import dim, fail, heading, info, ok, warn, ask_yn
from modules.utils import read_package_version, run

EXTENSION_ID = "saropa.saropa-log-capture"
EXTENSION_PREFIX = "saropa"

# cspell:ignore tasklist IMAGENAME vscdb


# ── CLI ──────────────────────────────────────────────────────


def parse_args() -> argparse.Namespace:
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(
        description="Saropa Log Capture — Extension Removal Script",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--no-logo", action="store_true",
        help="Suppress the banner.",
    )
    return parser.parse_args()


# ── Path helpers ─────────────────────────────────────────────


def _vscode_user_dir() -> str:
    """Return the VS Code User data directory."""
    return os.path.join(
        os.path.expanduser("~"),
        "AppData", "Roaming", "Code", "User",
    )


def _extensions_dir() -> str:
    """Return the VS Code extensions directory."""
    return os.path.join(os.path.expanduser("~"), ".vscode", "extensions")


# ── Steps ────────────────────────────────────────────────────


def _check_vscode_running() -> None:
    """Warn the user if VS Code appears to be running.

    Never kills processes — just advises the user to close VS Code.
    """
    heading("Pre-flight Check")
    r = run(["tasklist", "/FI", "IMAGENAME eq Code.exe", "/NH"])
    if r.returncode == 0 and "Code.exe" in r.stdout:
        warn("VS Code appears to be running.")
        warn("Close all VS Code windows first, then re-run this script.")
        if not ask_yn("Continue anyway? (files may be locked)"):
            info("Exiting. Close VS Code and try again.")
            sys.exit(0)
    else:
        ok("VS Code is not running.")


def _step_uninstall_cli() -> None:
    """Step 1: Uninstall via the VS Code CLI."""
    heading("Step 1 · Uninstall via CLI")
    info(f"Extension: {C.WHITE}{EXTENSION_ID}{C.RESET}")

    if not ask_yn("Uninstall via 'code --uninstall-extension'?"):
        info("Skipped CLI uninstall.")
        return

    r = run(["code", "--uninstall-extension", EXTENSION_ID])
    if r.returncode == 0:
        ok("CLI uninstall succeeded.")
    else:
        warn("CLI uninstall returned non-zero (may not be installed).")
        if r.stderr.strip():
            info(f"  {dim(r.stderr.strip())}")


def _step_remove_extension_files() -> None:
    """Step 2: Remove extension folders from ~/.vscode/extensions/."""
    heading("Step 2 · Remove Extension Files")
    ext_dir = _extensions_dir()

    if not os.path.isdir(ext_dir):
        info(f"Extensions dir not found: {dim(ext_dir)}")
        return

    pattern = os.path.join(ext_dir, f"{EXTENSION_PREFIX}*")
    matches = glob.glob(pattern)
    if not matches:
        ok("No matching extension folders found.")
        return

    for path in matches:
        info(f"  {C.WHITE}{os.path.basename(path)}{C.RESET}")

    if not ask_yn(f"Delete {len(matches)} folder(s)?"):
        info("Skipped.")
        return

    _delete_paths(matches)


def _step_remove_global_storage() -> None:
    """Step 3: Remove global storage for the extension."""
    heading("Step 3 · Remove Global Storage")
    storage = os.path.join(_vscode_user_dir(), "globalStorage", EXTENSION_ID)

    if not os.path.exists(storage):
        ok("No global storage found.")
        return

    info(f"  {C.WHITE}{storage}{C.RESET}")
    if not ask_yn("Delete global storage?"):
        info("Skipped.")
        return

    _delete_paths([storage])


def _step_clear_workspace_state() -> None:
    """Step 4: Clear workspace state databases that cache webview state.

    VS Code stores webview state in state.vscdb (SQLite) files inside
    workspace storage folders. Corrupted webview state here causes the
    sidebar to get stuck loading, even after reinstalling the extension.
    This step finds workspace folders linked to this project and deletes
    them so VS Code rebuilds fresh state on next launch.
    """
    heading("Step 4 · Clear Workspace State")
    ws_dir = os.path.join(_vscode_user_dir(), "workspaceStorage")

    if not os.path.isdir(ws_dir):
        ok("No workspace storage directory found.")
        return

    matches = _find_project_workspaces(ws_dir)
    if not matches:
        ok("No workspace storage entries for this project.")
        return

    for path in matches:
        info(f"  {C.WHITE}{os.path.basename(path)}{C.RESET}")
        _show_workspace_json(path)

    if not ask_yn(f"Delete {len(matches)} workspace state folder(s)?"):
        info("Skipped.")
        return

    _delete_paths(matches)


def _step_clear_ext_dev_state() -> None:
    """Step 5: Clear Extension Development Host state.

    The ext-dev folder stores state from F5 debug sessions. Corrupted
    state here causes the webview to get stuck in the dev host too.
    """
    heading("Step 5 · Extension Dev Host State")
    ext_dev = os.path.join(_vscode_user_dir(), "workspaceStorage", "ext-dev")

    if not os.path.isdir(ext_dev):
        ok("No ext-dev state found.")
        return

    size = _dir_size_kb(ext_dev)
    info(f"  {C.WHITE}{ext_dev}{C.RESET}  ({size} KB)")
    if not ask_yn("Delete Extension Development Host state?"):
        info("Skipped.")
        return

    _delete_paths([ext_dev])


# ── Helpers ──────────────────────────────────────────────────


def _find_project_workspaces(ws_dir: str) -> list[str]:
    """Find workspace storage folders that reference this project."""
    matches: list[str] = []
    try:
        entries = os.listdir(ws_dir)
    except OSError:
        return matches

    for entry in entries:
        if entry == "ext-dev":
            continue
        folder = os.path.join(ws_dir, entry)
        wj = os.path.join(folder, "workspace.json")
        if not os.path.isfile(wj):
            continue
        if _workspace_matches_project(wj):
            matches.append(folder)
    return matches


def _workspace_matches_project(wj_path: str) -> bool:
    """Check if a workspace.json references the saropa-log-capture project."""
    try:
        with open(wj_path, encoding="utf-8") as f:
            data = json.load(f)
        folder = data.get("folder", "")
        return "saropa-log-capture" in folder.lower()
    except (OSError, json.JSONDecodeError):
        return False


def _show_workspace_json(folder: str) -> None:
    """Print the workspace.json contents for context."""
    wj = os.path.join(folder, "workspace.json")
    try:
        with open(wj, encoding="utf-8") as f:
            data = json.load(f)
        uri = data.get("folder", "unknown")
        info(f"    → {dim(uri)}")
    except (OSError, json.JSONDecodeError):
        pass


def _dir_size_kb(path: str) -> int:
    """Calculate total size of a directory in KB."""
    total = 0
    for dirpath, _dirnames, filenames in os.walk(path):
        for f in filenames:
            try:
                total += os.path.getsize(os.path.join(dirpath, f))
            except OSError:
                pass
    return total // 1024


def _delete_paths(paths: list[str]) -> None:
    """Delete a list of file/directory paths, reporting each result."""
    for path in paths:
        try:
            if os.path.isdir(path):
                shutil.rmtree(path)
            else:
                os.remove(path)
            ok(f"Deleted: {dim(os.path.basename(path))}")
        except OSError as e:
            fail(f"Could not delete: {os.path.basename(path)}")
            info(f"  {e}")


# ── Main ─────────────────────────────────────────────────────


def _print_banner(version: str, no_logo: bool) -> None:
    """Print the script banner."""
    print()
    if not no_logo:
        print(f"  {C.CYAN}{'=' * 50}{C.RESET}")
        print(f"  {C.BOLD}Remove Extension — Saropa Log Capture{C.RESET}"
              f"  {dim(f'v{version}')}")
        print(f"  {C.CYAN}{'=' * 50}{C.RESET}")
    else:
        print(f"  {C.BOLD}Remove Extension{C.RESET}  {dim(f'v{version}')}")
    print(f"  Project root: {dim(PROJECT_ROOT)}\n")
    info("Every step asks for confirmation before deleting anything.")
    info("VS Code is never killed — close it yourself before running.")


def main() -> int:
    """Remove all traces of Saropa Log Capture from VS Code.

    Each step asks for confirmation before any destructive action.
    VS Code is never killed — user is warned to close it first.
    """
    args = parse_args()
    version = read_package_version()
    _print_banner(version, args.no_logo)

    _check_vscode_running()
    _step_uninstall_cli()
    _step_remove_extension_files()
    _step_remove_global_storage()
    _step_clear_workspace_state()
    _step_clear_ext_dev_state()

    heading("Done")
    ok("Removal complete. Restart VS Code for a clean slate.")
    info("To reinstall, run:")
    info(f"  code --install-extension {C.WHITE}<path-to-.vsix>{C.RESET}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

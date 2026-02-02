# -*- coding: utf-8 -*-
"""Prerequisite tool checks (Node, npm, git, gh CLI, vsce auth).

Each check returns True on success, False on blocking failure.
All prerequisites are blocking — the pipeline halts on the first failure
so the user gets a clear message about what to install.
"""

import shutil
import subprocess

from modules.constants import C, PROJECT_ROOT
from modules.display import fail, info, ok, warn
from modules.utils import run


def check_node() -> bool:
    """Verify Node.js is installed (>= 18).

    VS Code extensions require Node 18+ for the vsce packaging tool
    and for esbuild bundling.
    """
    result = run(["node", "--version"], check=False)
    if result.returncode != 0:
        fail("Node.js is not installed. Install from https://nodejs.org/")
        return False
    # node --version returns "vXX.YY.ZZ", strip the leading "v"
    version = result.stdout.strip().lstrip("v")
    major = int(version.split(".")[0])
    if major < 18:
        fail(f"Node.js {version} found — version 18+ required.")
        return False
    ok(f"Node.js {C.WHITE}{version}{C.RESET}")
    return True


def check_npm() -> bool:
    """Verify npm is installed.

    npm ships with Node.js, so a missing npm usually means a broken
    Node installation rather than a separate install step.
    """
    result = run(["npm", "--version"], check=False)
    if result.returncode != 0:
        fail("npm is not installed. It ships with Node.js — reinstall Node.")
        return False
    ok(f"npm {C.WHITE}{result.stdout.strip()}{C.RESET}")
    return True


def check_git() -> bool:
    """Verify git is installed.

    Required for working tree checks, commit, tag, and push operations
    during the publish phase.
    """
    result = run(["git", "--version"], check=False)
    if result.returncode != 0:
        fail("git is not installed. Install from https://git-scm.com/")
        return False
    ok(f"git — {C.WHITE}{result.stdout.strip()}{C.RESET}")
    return True


def check_gh_cli() -> bool:
    """Verify GitHub CLI is installed and authenticated.

    Only called when publishing (not --analyze-only). Blocking because
    Step 16 requires `gh release create` to attach the .vsix to a
    GitHub release. Failing early here prevents discovering the issue
    only after the marketplace publish has already succeeded.
    """
    if not shutil.which("gh"):
        fail("GitHub CLI (gh) is not installed.")
        info(f"  Install from {C.WHITE}https://cli.github.com/{C.RESET}")
        return False

    # Use a timeout because gh auth status can hang if the keyring is locked
    try:
        result = run(["gh", "auth", "status"], check=False, timeout=10)
    except subprocess.TimeoutExpired:
        fail("GitHub CLI auth check timed out.")
        return False
    if result.returncode != 0:
        fail(f"GitHub CLI not authenticated. "
             f"Run: {C.YELLOW}gh auth login{C.RESET}")
        return False
    ok("GitHub CLI — authenticated")
    return True


def check_vsce_auth() -> bool:
    """Verify vsce has valid marketplace credentials for 'saropa'.

    Only called when --analyze-only is NOT set, since credentials are
    only needed for the actual marketplace publish in Step 15.
    Uses `vsce verify-pat` which validates the PAT without publishing.
    """
    info("Checking marketplace credentials...")
    result = run(
        ["npx", "@vscode/vsce", "verify-pat", "saropa"],
        cwd=PROJECT_ROOT,
        check=False,
    )
    if result.returncode == 0:
        ok("Marketplace PAT verified for 'saropa'")
        return True

    # verify-pat may not exist in older vsce versions — treat as a
    # non-blocking warning rather than failing the entire pipeline
    stderr = (result.stderr or "").lower()
    if "unknown command" in stderr or "not a vsce command" in stderr:
        warn("Could not verify PAT (vsce verify-pat not available).")
        info("Publish may fail if credentials are missing.")
        return True

    fail("No valid marketplace PAT found for publisher 'saropa'.")
    info(f"  Run: {C.YELLOW}npx @vscode/vsce login saropa{C.RESET}")
    return False

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
#     Step 1:  Prerequisites (Node 18+, npm, git, gh, VS Code CLI)
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
#     Step 11: Finalize CHANGELOG (- Current -> today's date)
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
import datetime
import glob
import json
import os
import re
import shutil
import subprocess
import sys
import time
import webbrowser

# Resolve paths relative to this script so it works from any working directory.
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)

# Maximum lines allowed per TypeScript source file (from CLAUDE.md).
MAX_FILE_LINES = 300

MARKETPLACE_URL = (
    "https://marketplace.visualstudio.com"
    "/items?itemName=saropa.saropa-log-capture"
)
REPO_URL = "https://github.com/saropa/saropa-log-capture"

# cspell:ignore urrent startfile unpushed pubdev connor4312 dbaeumer

# VS Code extensions required for development.
REQUIRED_VSCODE_EXTENSIONS = [
    "connor4312.esbuild-problem-matchers",
    "dbaeumer.vscode-eslint",
    "ms-vscode.extension-test-runner",
]

# Global npm packages required for scaffolding/publishing.
REQUIRED_GLOBAL_NPM_PACKAGES = [
    "yo",
    "generator-code",
]


# ── Exit Codes ──────────────────────────────────────────────


class ExitCode:
    """Exit codes for each failure category."""
    SUCCESS = 0
    PREREQUISITE_FAILED = 1
    WORKING_TREE_DIRTY = 2
    REMOTE_SYNC_FAILED = 3
    DEPENDENCY_FAILED = 4
    COMPILE_FAILED = 5
    TEST_FAILED = 6
    QUALITY_FAILED = 7
    VERSION_INVALID = 8
    CHANGELOG_FAILED = 9
    PACKAGE_FAILED = 10
    GIT_FAILED = 11
    PUBLISH_FAILED = 12
    RELEASE_FAILED = 13
    USER_CANCELLED = 14


# ── Color Setup ──────────────────────────────────────────────
# Uses ANSI escape codes directly. colorama is optional on Windows
# to ensure the terminal interprets escape sequences correctly.


class _AnsiColors:
    """ANSI 256-color escape codes for terminal output."""
    RESET: str = "\033[0m"
    BOLD: str = "\033[1m"
    DIM: str = "\033[2m"
    GREEN: str = "\033[92m"
    YELLOW: str = "\033[93m"
    RED: str = "\033[91m"
    BLUE: str = "\033[94m"
    CYAN: str = "\033[96m"
    MAGENTA: str = "\033[95m"
    WHITE: str = "\033[97m"
    # Extended 256-color palette for the Saropa logo gradient.
    ORANGE_208: str = "\033[38;5;208m"
    ORANGE_209: str = "\033[38;5;209m"
    YELLOW_215: str = "\033[38;5;215m"
    YELLOW_220: str = "\033[38;5;220m"
    YELLOW_226: str = "\033[38;5;226m"
    GREEN_190: str = "\033[38;5;190m"
    GREEN_154: str = "\033[38;5;154m"
    GREEN_118: str = "\033[38;5;118m"
    CYAN_123: str = "\033[38;5;123m"
    CYAN_87: str = "\033[38;5;87m"
    BLUE_51: str = "\033[38;5;51m"
    BLUE_45: str = "\033[38;5;45m"
    BLUE_39: str = "\033[38;5;39m"
    BLUE_33: str = "\033[38;5;33m"
    BLUE_57: str = "\033[38;5;57m"
    PINK_195: str = "\033[38;5;195m"
    LIGHT_BLUE_117: str = "\033[38;5;117m"


class _FallbackColors:
    """No-op color strings for terminals that don't support ANSI codes."""
    RESET = BOLD = DIM = ""
    GREEN = YELLOW = RED = BLUE = CYAN = MAGENTA = WHITE = ""
    ORANGE_208 = ORANGE_209 = ""
    YELLOW_215 = YELLOW_220 = YELLOW_226 = ""
    GREEN_190 = GREEN_154 = GREEN_118 = ""
    CYAN_123 = CYAN_87 = ""
    BLUE_51 = BLUE_45 = BLUE_39 = BLUE_33 = BLUE_57 = ""
    PINK_195 = LIGHT_BLUE_117 = ""


# Try to initialise colorama for Windows compatibility; fall back gracefully.
try:
    import colorama
    colorama.init(autoreset=True)
    C = _AnsiColors
except ImportError:
    # colorama is optional — ANSI codes still work on most modern terminals.
    C = _FallbackColors


# ── Display Helpers ──────────────────────────────────────────

def heading(text: str) -> None:
    """Print a bold section heading."""
    bar = "=" * 60
    print(f"\n{C.CYAN}{bar}{C.RESET}")
    print(f"  {C.BOLD}{C.WHITE}{text}{C.RESET}")
    print(f"{C.CYAN}{bar}{C.RESET}")


def ok(text: str) -> None:
    print(f"  {C.GREEN}[OK]{C.RESET}   {text}")


def fix(text: str) -> None:
    """An issue was found and automatically repaired."""
    print(f"  {C.MAGENTA}[FIX]{C.RESET}  {text}")


def fail(text: str) -> None:
    print(f"  {C.RED}[FAIL]{C.RESET} {text}")


def warn(text: str) -> None:
    print(f"  {C.YELLOW}[WARN]{C.RESET} {text}")


def info(text: str) -> None:
    print(f"  {C.BLUE}[INFO]{C.RESET} {text}")


def dim(text: str) -> str:
    """Wrap text in dim ANSI codes for secondary information."""
    return f"{C.DIM}{text}{C.RESET}"


def ask_yn(question: str, default: bool = True) -> bool:
    """Prompt the user with a yes/no question. Returns the boolean answer.

    Handles EOF and Ctrl+C gracefully by returning the default.
    """
    hint = "Y/n" if default else "y/N"
    try:
        answer = input(
            f"  {C.YELLOW}{question} [{hint}]: {C.RESET}",
        ).strip().lower()
    except (EOFError, KeyboardInterrupt):
        print()
        return default
    if not answer:
        return default
    return answer in ("y", "yes")


# cSpell:disable
def show_logo(version: str) -> None:
    """Print the Saropa rainbow-gradient logo and script version."""
    logo = f"""
{C.ORANGE_208}                               ....{C.RESET}
{C.ORANGE_208}                       `-+shdmNMMMMNmdhs+-{C.RESET}
{C.ORANGE_209}                    -odMMMNyo/-..````.++:+o+/-{C.RESET}
{C.YELLOW_215}                 `/dMMMMMM/`            ````````{C.RESET}
{C.YELLOW_220}                `dMMMMMMMMNdhhhdddmmmNmmddhs+-{C.RESET}
{C.YELLOW_226}                QMMMMMMMMMMMMMMMMMMMMMMMMMMMMMNhs{C.RESET}
{C.GREEN_190}              . :sdmNNNNMMMMMNNNMMMMMMMMMMMMMMMMm+{C.RESET}
{C.GREEN_154}              o     `..~~~::~+==+~:/+sdNMMMMMMMMMMMo{C.RESET}
{C.GREEN_118}              m                        .+NMMMMMMMMMN{C.RESET}
{C.CYAN_123}              m+                         :MMMMMMMMMm{C.RESET}
{C.CYAN_87}              qN:                        :MMMMMMMMMF{C.RESET}
{C.BLUE_51}               oNs.                    `+NMMMMMMMMo{C.RESET}
{C.BLUE_45}                :dNy\\.              ./smMMMMMMMMm:{C.RESET}
{C.BLUE_39}                 `TdMNmhyso+++oosydNNMMMMMMMMMdP+{C.RESET}
{C.BLUE_33}                    .odMMMMMMMMMMMMMMMMMMMMdo-{C.RESET}
{C.BLUE_57}                       `-+shdNNMMMMNNdhs+-{C.RESET}
{C.BLUE_57}                               ````{C.RESET}

  {C.PINK_195}Saropa Log Capture — Developer Toolkit{C.RESET}
  {C.LIGHT_BLUE_117}Extension v{version}{C.RESET}
"""
    print(logo)
    print(f"{C.CYAN}{'-' * 60}{C.RESET}")
# cSpell:enable


# ── Utilities ────────────────────────────────────────────────

def run(cmd: list[str], **kwargs) -> subprocess.CompletedProcess[str]:
    """Run a shell command and return the result.

    shell=True is needed on Windows so that npm/npx/.cmd scripts resolve
    via PATH through cmd.exe. On macOS/Linux, shell=False is safer and
    avoids quoting issues.
    """
    return subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        # Windows needs shell=True because npm/npx are .cmd batch files
        # that only resolve through cmd.exe's PATH lookup.
        shell=(sys.platform == "win32"),
        **kwargs,
    )


def read_package_version() -> str:
    """Read the extension version from package.json.

    Returns "unknown" if the file can't be read or parsed, so callers
    can still display a banner before failing more specifically.
    """
    pkg_path = os.path.join(PROJECT_ROOT, "package.json")
    try:
        with open(pkg_path, encoding="utf-8") as f:
            data = json.load(f)
        return data.get("version", "unknown")
    except (OSError, json.JSONDecodeError):
        return "unknown"


def elapsed_str(seconds: float) -> str:
    """Format elapsed seconds as a human-readable string.

    Sub-second durations are shown in milliseconds for readability.
    """
    if seconds < 1:
        return f"{seconds * 1000:.0f}ms"
    return f"{seconds:.1f}s"


def run_step(
    name: str,
    fn: object,
    results: list[tuple[str, bool, float]],
) -> bool:
    """Time and record a single pipeline step.

    Wraps any step function with timing. The (name, passed, elapsed) tuple
    is appended to the results list for the timing chart and report.
    """
    t0 = time.time()
    passed = fn()  # type: ignore[operator]
    elapsed = time.time() - t0
    results.append((name, passed, elapsed))
    return passed


# ── Analysis: Prerequisites ──────────────────────────────────
# Each check returns True on success, False on blocking failure.
# All prerequisites are blocking — the pipeline halts on the first failure
# so the user gets a clear message about what to install.


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


# ── Analysis: Dev Environment ────────────────────────────────
# VS Code CLI, global npm packages, and VS Code extensions are
# developer conveniences — non-blocking warnings if unavailable,
# but will auto-install if missing and the tools are reachable.


def check_vscode_cli() -> bool:
    """Verify the 'code' CLI is available (non-blocking).

    The code CLI is needed for auto-installing .vsix files and
    VS Code extensions. If missing, the user can still install manually.
    """
    if not shutil.which("code"):
        warn("VS Code CLI (code) not found on PATH.")
        info(f"  Open VS Code → {C.YELLOW}Ctrl+Shift+P{C.RESET} → "
             f"'{C.WHITE}Shell Command: Install code command in PATH{C.RESET}'")
        return True  # non-blocking
    ok("VS Code CLI (code) available on PATH")
    return True


def check_global_npm_packages() -> bool:
    """Check and install required global npm packages.

    Parses `npm list -g --json` to find what's already installed,
    then auto-installs any missing packages from REQUIRED_GLOBAL_NPM_PACKAGES.
    """
    all_ok = True
    result = run(["npm", "list", "-g", "--depth=0", "--json"], check=False)

    # Parse the JSON output to see which packages are already installed.
    installed: set[str] = set()
    if result.returncode == 0:
        try:
            data = json.loads(result.stdout)
            installed = set(data.get("dependencies", {}).keys())
        except json.JSONDecodeError:
            pass

    for pkg in REQUIRED_GLOBAL_NPM_PACKAGES:
        if pkg in installed:
            ok(f"npm global: {C.WHITE}{pkg}{C.RESET}")
        else:
            fix(f"Installing global npm package: {C.WHITE}{pkg}{C.RESET}")
            install_result = run(
                ["npm", "install", "-g", pkg], check=False,
            )
            if install_result.returncode != 0:
                fail(f"Failed to install {pkg}: "
                     f"{install_result.stderr.strip()}")
                all_ok = False
            else:
                ok(f"Installed: {C.WHITE}{pkg}{C.RESET}")
    return all_ok


def check_vscode_extensions() -> bool:
    """Check and install required VS Code extensions.

    Skips silently if the 'code' CLI isn't available. Otherwise lists
    installed extensions and auto-installs any that are missing from
    REQUIRED_VSCODE_EXTENSIONS.
    """
    if not shutil.which("code"):
        warn("Skipping VS Code extension check — 'code' CLI not available.")
        return True

    result = run(["code", "--list-extensions"], check=False)
    if result.returncode != 0:
        warn("Could not list VS Code extensions.")
        return True

    # Case-insensitive comparison for extension IDs
    installed = set(result.stdout.strip().lower().splitlines())

    all_ok = True
    for ext in REQUIRED_VSCODE_EXTENSIONS:
        if ext.lower() in installed:
            ok(f"VS Code extension: {C.WHITE}{ext}{C.RESET}")
        else:
            fix(f"Installing VS Code extension: {C.WHITE}{ext}{C.RESET}")
            install_result = run(
                ["code", "--install-extension", ext], check=False,
            )
            if install_result.returncode != 0:
                fail(f"Failed to install {ext}: "
                     f"{install_result.stderr.strip()}")
                all_ok = False
            else:
                ok(f"Installed: {C.WHITE}{ext}{C.RESET}")
    return all_ok


# ── Analysis: Git & Dependencies ─────────────────────────────
# These checks validate the git state and project dependencies
# before we attempt any build or publish operations.


def check_working_tree() -> bool:
    """Verify git working tree is clean. Prompt if dirty.

    A dirty working tree is allowed during analysis (user confirms),
    but the publish phase will commit all staged changes, so the user
    needs to be aware of what will be included in the release commit.
    """
    # --porcelain gives machine-readable output: one line per changed file
    result = run(["git", "status", "--porcelain"], cwd=PROJECT_ROOT)
    if result.returncode != 0:
        fail("Could not check git status.")
        return False
    if not result.stdout.strip():
        ok("Working tree is clean")
        return True

    # Show up to 10 changed files so the user knows what's uncommitted
    changed = result.stdout.strip().splitlines()
    warn(f"{len(changed)} uncommitted change(s):")
    for line in changed[:10]:
        print(f"         {C.DIM}{line}{C.RESET}")
    if len(changed) > 10:
        print(f"         {C.DIM}... and {len(changed) - 10} more{C.RESET}")
    return ask_yn("Continue with dirty working tree?", default=False)


def _check_if_behind() -> bool:
    """Compare local HEAD against upstream. Pull if behind.

    Uses merge-base to determine the relationship:
    - If merge-base == local HEAD: local is behind, safe to fast-forward
    - If merge-base == remote HEAD: local is ahead (unpushed commits)
    - Otherwise: branches have diverged (fail — needs manual resolution)
    """
    local = run(["git", "rev-parse", "HEAD"], cwd=PROJECT_ROOT)
    # @{u} resolves to the upstream tracking branch (e.g., origin/main)
    remote = run(["git", "rev-parse", "@{u}"], cwd=PROJECT_ROOT)
    if remote.returncode != 0:
        warn("No upstream tracking branch. Skipping sync check.")
        return True
    if local.stdout.strip() == remote.stdout.strip():
        ok("Local branch is up to date with origin")
        return True

    base = run(["git", "merge-base", "HEAD", "@{u}"], cwd=PROJECT_ROOT)
    if base.stdout.strip() == local.stdout.strip():
        # Local is an ancestor of remote — safe to fast-forward
        fix("Local is behind origin. Pulling...")
        pull = run(["git", "pull", "--ff-only"], cwd=PROJECT_ROOT)
        if pull.returncode != 0:
            fail("git pull --ff-only failed (branches diverged?)")
            return False
        ok("Pulled latest from origin")
        return True
    # Local has commits that remote doesn't — they'll be pushed in Step 13
    ok("Local is ahead of origin (will push during publish)")
    return True


def check_remote_sync() -> bool:
    """Fetch origin and ensure local branch is up to date.

    Fetches first so that @{u} comparison in _check_if_behind()
    uses the latest remote state.
    """
    info("Fetching origin...")
    fetch = run(["git", "fetch", "origin"], cwd=PROJECT_ROOT)
    if fetch.returncode != 0:
        fail(f"git fetch failed: {fetch.stderr.strip()}")
        return False
    return _check_if_behind()


def ensure_dependencies() -> bool:
    """Run npm install if node_modules is stale or missing.

    Compares package.json mtime against node_modules/.package-lock.json
    to detect when dependencies need updating. This avoids running
    npm install on every invocation (which is slow).
    """
    node_modules = os.path.join(PROJECT_ROOT, "node_modules")
    pkg_json = os.path.join(PROJECT_ROOT, "package.json")

    if not os.path.isfile(pkg_json):
        fail("package.json not found.")
        return False

    if not os.path.isdir(node_modules):
        fix("node_modules/ missing — running npm install...")
        return _run_npm_install()

    # npm writes .package-lock.json inside node_modules after install.
    # If package.json is newer, dependencies may have changed.
    lock = os.path.join(node_modules, ".package-lock.json")
    if os.path.isfile(lock):
        if os.path.getmtime(pkg_json) > os.path.getmtime(lock):
            fix("package.json newer than lockfile — running npm install...")
            return _run_npm_install()

    ok("node_modules/ up to date")
    return True


def _run_npm_install() -> bool:
    """Run npm install and report result."""
    result = run(["npm", "install"], cwd=PROJECT_ROOT, check=False)
    if result.returncode != 0:
        fail(f"npm install failed: {result.stderr.strip()}")
        return False
    ok("npm install completed")
    return True


# ── Analysis: Build & Quality ────────────────────────────────
# These steps verify the code compiles, tests pass, and source files
# meet the project's quality constraints before we package anything.


def step_compile() -> bool:
    """Run the full compile: type-check + lint + esbuild bundle.

    This runs `npm run compile` which chains:
      1. tsc --noEmit (type checking)
      2. eslint src (linting)
      3. node esbuild.js (bundle into dist/extension.js)
    """
    info("Running npm run compile...")
    result = run(["npm", "run", "compile"], cwd=PROJECT_ROOT, check=False)
    if result.returncode != 0:
        fail("Compile failed:")
        # Show both stdout and stderr — tsc errors go to stdout,
        # while esbuild/eslint errors may go to stderr
        if result.stdout.strip():
            print(result.stdout)
        if result.stderr.strip():
            print(result.stderr)
        return False
    ok("Compile passed (type-check + lint + esbuild)")
    return True


def step_test() -> bool:
    """Run the test suite via npm run test.

    Uses @vscode/test-cli to launch tests inside VS Code's Extension
    Development Host. Tests run in a headless VS Code instance.
    """
    info("Running npm run test...")
    result = run(["npm", "run", "test"], cwd=PROJECT_ROOT, check=False)
    if result.returncode != 0:
        fail("Tests failed:")
        if result.stdout.strip():
            print(result.stdout)
        if result.stderr.strip():
            print(result.stderr)
        return False
    ok("Tests passed")
    return True


def check_file_line_limits() -> bool:
    """Enforce the 300-line hard limit on all TypeScript files in src/.

    This is a project quality gate defined in CLAUDE.md. Keeping files
    short encourages modular design and makes code review easier.
    The limit counts total lines (code + comments + blanks).
    """
    src_dir = os.path.join(PROJECT_ROOT, "src")
    violations: list[str] = []

    for dirpath, _dirs, filenames in os.walk(src_dir):
        for fname in filenames:
            if not fname.endswith(".ts"):
                continue
            filepath = os.path.join(dirpath, fname)
            # Count lines by iterating the file (memory-efficient)
            with open(filepath, encoding="utf-8") as f:
                count = sum(1 for _ in f)
            if count > MAX_FILE_LINES:
                rel = os.path.relpath(filepath, PROJECT_ROOT)
                violations.append(f"{rel} ({count} lines)")

    if violations:
        fail(f"{len(violations)} file(s) exceed {MAX_FILE_LINES}-line limit:")
        for v in violations:
            print(f"         {C.RED}{v}{C.RESET}")
        return False
    ok(f"All .ts files are within the {MAX_FILE_LINES}-line limit")
    return True


# ── Analysis: Version ────────────────────────────────────────
# The CHANGELOG "- Current" entry is the source of truth for version.
# If package.json differs, it's auto-synced to match. The version
# must not already be tagged in git (would mean it's already published).


def read_changelog_current_version() -> str | None:
    """If CHANGELOG.md has a '- Current' entry, return its version.

    Scans for lines like: ## [0.2.1] - Current
    The "- Current" marker indicates an in-progress version that hasn't
    been published yet. During publish, this gets replaced with today's date.
    """
    changelog_path = os.path.join(PROJECT_ROOT, "CHANGELOG.md")
    try:
        with open(changelog_path, encoding="utf-8") as f:
            for line in f:
                # Match "## [X.Y.Z] - Current" (case-insensitive "Current")
                match = re.match(
                    r'^## \[(\d+\.\d+\.\d+)\]\s+-\s+[Cc]urrent', line,
                )
                if match:
                    return match.group(1)
    except OSError:
        pass
    return None


def check_version_not_tagged(version: str) -> bool:
    """Verify the version tag does not already exist in git.

    If the tag already exists, this version was already published.
    The developer needs to bump the version before re-publishing.
    """
    tag = f"v{version}"
    result = run(["git", "tag", "-l", tag], cwd=PROJECT_ROOT)
    if result.stdout.strip():
        fail(f"Git tag '{tag}' already exists. Bump the version first.")
        return False
    ok(f"Tag '{tag}' is available")
    return True


def _sync_package_version(target: str) -> bool:
    """Update package.json version to match the target version.

    Reads package.json, overwrites the "version" field, and writes back.
    Returns True on success, False on any I/O or parse error.
    """
    pkg_path = os.path.join(PROJECT_ROOT, "package.json")
    try:
        with open(pkg_path, encoding="utf-8") as f:
            data = json.load(f)
    except (OSError, json.JSONDecodeError):
        fail("Could not read package.json for version sync")
        return False

    old_version = data.get("version", "unknown")
    data["version"] = target
    try:
        with open(pkg_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
            f.write("\n")
    except OSError:
        fail("Could not write package.json")
        return False

    fix(f"package.json: {C.WHITE}{old_version}{C.RESET}"
        f" → {C.WHITE}{target}{C.RESET}")
    return True


def validate_version_changelog() -> tuple[str, bool]:
    """Sync and validate version between package.json and CHANGELOG.

    1. CHANGELOG.md must have a "- Current" entry with a version
    2. If package.json version differs, auto-sync it to match CHANGELOG
    3. The version must not already be tagged in git
    """
    cl_version = read_changelog_current_version()
    if cl_version is None:
        fail("No '- Current' entry found in CHANGELOG.md")
        info("Add a section like: ## [X.Y.Z] - Current")
        return "unknown", False

    pkg_version = read_package_version()
    if pkg_version == "unknown":
        fail("Could not read version from package.json")
        return pkg_version, False

    # Auto-sync: update package.json to match CHANGELOG if they differ
    if cl_version != pkg_version:
        if not _sync_package_version(cl_version):
            return pkg_version, False

    if not check_version_not_tagged(cl_version):
        return cl_version, False

    ok(f"Version {C.WHITE}{cl_version}{C.RESET} validated")
    return cl_version, True


# ── Publish: Confirmation ────────────────────────────────────
# This is the critical gate between the read-only analysis phase and
# the irreversible publish phase. The user must explicitly type "y"
# (default is "n") to proceed.


def confirm_publish(version: str) -> bool:
    """Show publish summary and require explicit confirmation.

    Lists every irreversible action that will happen, so the user
    can make an informed decision. Defaults to "no" since marketplace
    publishes cannot be undone.
    """
    print(f"\n  {C.BOLD}{C.YELLOW}Publish Summary{C.RESET}")
    print(f"  {'─' * 40}")
    print(f"  Version:     {C.WHITE}v{version}{C.RESET}")
    print(f"  Marketplace: {C.WHITE}saropa.saropa-log-capture{C.RESET}")
    print(f"  Repository:  {C.WHITE}{REPO_URL}{C.RESET}")
    print(f"\n  {C.YELLOW}This will:{C.RESET}")
    print(f"    1. Finalize CHANGELOG.md (- Current -> today)")
    print(f"    2. Build .vsix package")
    print(f"    3. Commit and push to origin")
    print(f"    4. Create git tag v{version}")
    print(f"    5. Publish to VS Code Marketplace")
    print(f"    6. Create GitHub release with .vsix")
    print(f"\n  {C.RED}These actions are irreversible.{C.RESET}")
    return ask_yn("Proceed with publish?", default=False)


# ── Publish: CHANGELOG ───────────────────────────────────────
# The CHANGELOG uses "- Current" as a placeholder for the release date.
# Finalization replaces this with today's date, marking the version
# as officially released. Unlike publish_to_pubdev.py, we do NOT insert
# a new [Unreleased] section — the developer creates the next entry manually.


def finalize_changelog(version: str) -> bool:
    """Replace '- Current' with today's date in CHANGELOG.md.

    Transforms: ## [0.2.1] - Current
    Into:       ## [0.2.1] - 2026-02-02

    Uses regex substitution to preserve the rest of the line and file.
    """
    changelog_path = os.path.join(PROJECT_ROOT, "CHANGELOG.md")
    try:
        with open(changelog_path, encoding="utf-8") as f:
            content = f.read()
    except OSError:
        fail("Could not read CHANGELOG.md")
        return False

    today = datetime.datetime.now().strftime("%Y-%m-%d")
    # Match the exact version header with "- Current" suffix
    pattern = rf'(## \[{re.escape(version)}\])\s+-\s+[Cc]urrent'
    updated, count = re.subn(pattern, rf'\1 - {today}', content)

    if count == 0:
        fail(f"Could not find '## [{version}] - Current' in CHANGELOG.md")
        return False

    try:
        with open(changelog_path, "w", encoding="utf-8") as f:
            f.write(updated)
    except OSError:
        fail("Could not write CHANGELOG.md")
        return False

    ok(f"CHANGELOG.md: - Current -> - {today}")
    return True


# ── Publish: Package ─────────────────────────────────────────


def step_package() -> str | None:
    """Package the extension into a .vsix file. Returns the file path.

    Uses vsce (Visual Studio Code Extensions CLI) to create a .vsix archive.
    --no-dependencies skips bundling node_modules since esbuild already bundles
    everything into dist/.
    """
    info("Packaging .vsix file...")
    result = run(
        ["npx", "@vscode/vsce", "package", "--no-dependencies"],
        cwd=PROJECT_ROOT,
    )
    if result.returncode != 0:
        fail("Packaging failed:")
        if result.stdout.strip():
            print(result.stdout)
        if result.stderr.strip():
            print(result.stderr)
        return None

    # vsce writes the .vsix to the project root. If multiple exist
    # (e.g. from previous runs), pick the most recently modified one.
    pattern = os.path.join(PROJECT_ROOT, "*.vsix")
    vsix_files = sorted(glob.glob(pattern), key=os.path.getmtime)
    if not vsix_files:
        fail("No .vsix file found after packaging.")
        return None

    vsix_path = vsix_files[-1]
    size_kb = os.path.getsize(vsix_path) / 1024
    ok(f"Created: {os.path.basename(vsix_path)} ({size_kb:.0f} KB)")
    return vsix_path


# ── Publish: Git ─────────────────────────────────────────────
# Git operations are split into commit+push (Step 13) and tag (Step 14)
# so that a tag failure doesn't leave committed-but-untagged code.


def git_commit_and_push(version: str) -> bool:
    """Commit all staged changes and push to origin.

    Stages everything with `git add -A` so the finalized CHANGELOG.md
    and any other pending changes are included in the release commit.
    If there's nothing to commit (e.g., CHANGELOG was already finalized),
    this succeeds silently.
    """
    info("Staging changes...")
    run(["git", "add", "-A"], cwd=PROJECT_ROOT)

    # Check if there are staged changes after add -A
    status = run(["git", "status", "--porcelain"], cwd=PROJECT_ROOT)
    if not status.stdout.strip():
        ok("No changes to commit")
        return True

    info(f"Committing release v{version}...")
    commit = run(
        ["git", "commit", "-m", f"release: v{version}"],
        cwd=PROJECT_ROOT,
    )
    if commit.returncode != 0:
        fail(f"git commit failed: {commit.stderr.strip()}")
        return False

    return _push_to_origin()


def _push_to_origin() -> bool:
    """Push current branch to origin.

    Detects the current branch name dynamically rather than hardcoding
    "main", so this works on feature branches too.
    """
    info("Pushing to origin...")
    # Resolve current branch name (e.g., "main", "release/v1")
    branch = run(
        ["git", "rev-parse", "--abbrev-ref", "HEAD"],
        cwd=PROJECT_ROOT,
    )
    branch_name = branch.stdout.strip() or "main"
    push = run(
        ["git", "push", "origin", branch_name],
        cwd=PROJECT_ROOT,
    )
    if push.returncode != 0:
        fail(f"git push failed: {push.stderr.strip()}")
        return False
    ok(f"Pushed to origin/{branch_name}")
    return True


def create_git_tag(version: str) -> bool:
    """Create and push an annotated git tag.

    Uses annotated tags (-a) rather than lightweight tags because
    annotated tags store the tagger, date, and message — useful for
    `gh release create` which uses the tag message as the default body.
    """
    tag = f"v{version}"
    info(f"Creating tag {tag}...")
    result = run(
        ["git", "tag", "-a", tag, "-m", f"Release {version}"],
        cwd=PROJECT_ROOT,
    )
    if result.returncode != 0:
        fail(f"git tag failed: {result.stderr.strip()}")
        return False

    info(f"Pushing tag {tag}...")
    push = run(["git", "push", "origin", tag], cwd=PROJECT_ROOT)
    if push.returncode != 0:
        fail(f"git push tag failed: {push.stderr.strip()}")
        return False

    ok(f"Tag {tag} created and pushed")
    return True


# ── Publish: Marketplace ─────────────────────────────────────
# Uses --packagePath to publish the exact .vsix we already built and
# validated in Step 12, rather than letting vsce re-build from source
# (which would trigger vscode:prepublish again unnecessarily).


def publish_marketplace(vsix_path: str) -> bool:
    """Publish the pre-built .vsix to VS Code Marketplace.

    Requires a valid PAT (Personal Access Token) for the 'saropa' publisher.
    The PAT is stored in the system keychain via `npx @vscode/vsce login`.
    """
    info(f"Publishing {os.path.basename(vsix_path)} to marketplace...")
    # --packagePath skips the vscode:prepublish hook and publishes
    # the exact artifact we already validated
    result = run(
        ["npx", "@vscode/vsce", "publish", "--packagePath", vsix_path],
        cwd=PROJECT_ROOT,
    )
    if result.returncode != 0:
        fail("Marketplace publish failed:")
        if result.stdout.strip():
            print(result.stdout)
        if result.stderr.strip():
            print(result.stderr)
        return False
    ok("Published to VS Code Marketplace")
    return True


# ── Publish: GitHub Release ──────────────────────────────────
# Creates a GitHub release tagged with the version, using CHANGELOG
# content as the release notes and attaching the .vsix as a download.


def extract_changelog_section(version: str) -> str:
    """Extract the CHANGELOG content for a specific version.

    Reads everything between `## [X.Y.Z]` and the next `## [` header.
    Returns a generic "Release X.Y.Z" message if the section is empty
    or the file can't be read.
    """
    changelog_path = os.path.join(PROJECT_ROOT, "CHANGELOG.md")
    try:
        with open(changelog_path, encoding="utf-8") as f:
            lines = f.readlines()
    except OSError:
        return f"Release {version}"

    collecting = False
    section: list[str] = []
    for line in lines:
        # Start collecting after the version header
        if re.match(rf'^## \[{re.escape(version)}\]', line):
            collecting = True
            continue
        # Stop at the next version header
        if collecting and re.match(r'^## \[', line):
            break
        if collecting:
            section.append(line)

    notes = "".join(section).strip()
    return notes if notes else f"Release {version}"


def create_github_release(version: str, vsix_path: str) -> bool:
    """Create a GitHub release with the .vsix attached.

    Uses the `gh` CLI to create a release on GitHub. The .vsix file
    is attached as a downloadable asset, making it available to users
    who prefer to install from GitHub rather than the marketplace.
    """
    tag = f"v{version}"
    notes = extract_changelog_section(version)

    info(f"Creating GitHub release {tag}...")
    # gh release create attaches files listed after the tag name
    result = run(
        [
            "gh", "release", "create", tag,
            os.path.abspath(vsix_path),
            "--title", tag,
            "--notes", notes,
        ],
        cwd=PROJECT_ROOT,
    )
    if result.returncode != 0:
        fail("GitHub release failed:")
        if result.stderr.strip():
            print(f"         {result.stderr.strip()}")
        _print_gh_troubleshooting()
        return False

    ok(f"GitHub release {tag} created")
    return True


def _print_gh_troubleshooting() -> None:
    """Print troubleshooting hints for GitHub release failures.

    The most common cause is a stale GITHUB_TOKEN env var that
    overrides the gh CLI's keyring credentials.
    """
    info("Troubleshooting:")
    info(f"  1. Check auth: {C.YELLOW}gh auth status{C.RESET}")
    info(f"  2. If GITHUB_TOKEN is set, clear it:")
    info(f"     PowerShell: {C.YELLOW}$env:GITHUB_TOKEN = \"\"{C.RESET}")
    info(f"     Bash: {C.YELLOW}unset GITHUB_TOKEN{C.RESET}")


# ── Install (analyze-only) ────────────────────────────────────
# These functions support the local install workflow when running
# in --analyze-only mode: show instructions, offer CLI install,
# and offer to open the build report.


def print_install_instructions(vsix_path: str) -> None:
    """Print coloured instructions for installing the .vsix in VS Code.

    Shows three installation methods (Command Palette, CLI, drag-and-drop)
    and a quick-start guide for the extension after installing.
    """
    vsix_name = os.path.basename(vsix_path)
    abs_path = os.path.abspath(vsix_path)

    heading("Install Instructions")

    opt = f"{C.BOLD}{C.CYAN}"
    key = f"{C.YELLOW}"
    rst = C.RESET

    print(f"""
  {opt}Option 1 — Command Palette (recommended):{rst}

    1. Open VS Code
    2. Press  {key}Ctrl+Shift+P{rst}  (macOS: {key}Cmd+Shift+P{rst})
    3. Type:  {key}Extensions: Install from VSIX...{rst}
    4. Browse to:
       {C.WHITE}{abs_path}{rst}
    5. Click {key}"Install"{rst}
    6. Reload VS Code when prompted

  {opt}Option 2 — Command line:{rst}

    {C.WHITE}code --install-extension {vsix_name}{rst}

  {opt}Option 3 — Drag and drop:{rst}

    1. Open VS Code
    2. Open the Extensions sidebar  ({key}Ctrl+Shift+X{rst})
    3. Drag the .vsix file into the Extensions sidebar

  {opt}After installing:{rst}

    - Start any debug session ({key}F5{rst}) — capture begins automatically
    - Open the Saropa Log Capture panel to view live output
    - Press {key}Ctrl+Shift+P{rst} and type {key}"Saropa"{rst} to see all commands
""")


def prompt_install(vsix_path: str) -> None:
    """Ask the user whether to install the .vsix via the code CLI.

    Falls back gracefully if the 'code' CLI isn't on PATH.
    """
    if not shutil.which("code"):
        warn("VS Code CLI (code) not found on PATH — cannot auto-install.")
        info("Add it via: VS Code → Ctrl+Shift+P → "
             "'Shell Command: Install code command in PATH'")
        return

    if not ask_yn("Install via CLI now?", default=False):
        return

    vsix_name = os.path.basename(vsix_path)
    info(f"Running: code --install-extension {vsix_name}")
    result = run(
        ["code", "--install-extension", os.path.abspath(vsix_path)],
    )
    if result.returncode != 0:
        fail(f"Install failed: {result.stderr.strip()}")
        return
    ok("Extension installed successfully!")
    info("Reload VS Code to activate the updated extension.")


def prompt_open_report(report_path: str) -> None:
    """Ask the user whether to open the build report.

    Uses the platform-appropriate file opener (startfile on Windows,
    open on macOS, xdg-open on Linux).
    """
    if not ask_yn("Open build report?", default=False):
        return

    # cspell:ignore startfile
    abs_path = os.path.abspath(report_path)
    if sys.platform == "win32":
        os.startfile(abs_path)  # type: ignore[attr-defined]
    elif sys.platform == "darwin":
        subprocess.Popen(["open", abs_path])
    else:
        subprocess.Popen(["xdg-open", abs_path])


# ── Report & Display ─────────────────────────────────────────
# Reports are saved to reports/ (which is gitignored) so the user
# has a persistent record of each pipeline run. The timing chart
# gives a visual breakdown of where time was spent.


def _build_report_header(
    results: list[tuple[str, bool, float]],
    version: str,
    is_publish: bool,
) -> list[str]:
    """Build the header lines for a report."""
    total_time = sum(t for _, _, t in results)
    passed = sum(1 for _, p, _ in results if p)
    failed = len(results) - passed
    kind = "Publish" if is_publish else "Analysis"

    lines = [
        f"Saropa Log Capture — {kind} Report",
        f"Generated: {datetime.datetime.now().isoformat()}",
        f"Extension version: {version}",
        "",
        f"Results: {passed} passed, {failed} failed" if failed else
        f"Results: {passed} passed",
        f"Total time: {elapsed_str(total_time)}",
    ]
    return lines


def save_report(
    results: list[tuple[str, bool, float]],
    version: str,
    vsix_path: str | None = None,
    is_publish: bool = False,
) -> str | None:
    """Save a summary report to reports/. Returns the report path."""
    reports_dir = os.path.join(PROJECT_ROOT, "reports")
    os.makedirs(reports_dir, exist_ok=True)

    ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    kind = "publish" if is_publish else "analyze"
    report_name = f"{ts}_saropa_log_capture_{kind}_report.log"
    report_path = os.path.join(reports_dir, report_name)

    lines = _build_report_header(results, version, is_publish)

    if vsix_path and os.path.isfile(vsix_path):
        vsix_size = os.path.getsize(vsix_path) / 1024
        lines.append(f"VSIX file: {os.path.basename(vsix_path)}")
        lines.append(f"VSIX size: {vsix_size:.1f} KB")

    if is_publish:
        lines.append(f"Marketplace: {MARKETPLACE_URL}")
        lines.append(f"GitHub release: {REPO_URL}/releases/tag/v{version}")

    lines.append("")
    lines.append("Step Details:")
    for name, ok_flag, secs in results:
        status = "PASS" if ok_flag else "FAIL"
        lines.append(f"  [{status}] {name:<25s} {elapsed_str(secs):>8s}")

    with open(report_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")

    return report_path


def print_timing(results: list[tuple[str, bool, float]]) -> None:
    """Print a coloured timing bar chart for all recorded steps.

    Each step gets a proportional bar (max 30 chars wide) showing
    its share of total time. Failed steps show a red ✗ instead of ✓.
    """
    total = sum(t for _, _, t in results)
    heading("Timing")
    for name, passed, secs in results:
        icon = f"{C.GREEN}✓{C.RESET}" if passed else f"{C.RED}✗{C.RESET}"
        # Scale bar length proportionally to total time (max 30 chars)
        bar_len = int(min(secs / max(total, 0.001) * 30, 30))
        bar = f"{C.GREEN}{'█' * bar_len}{C.RESET}" if bar_len else ""
        print(f"  {icon} {name:<25s} {elapsed_str(secs):>8s}  {bar}")
    print(f"  {'─' * 45}")
    print(f"    {'Total':<23s} {C.BOLD}{elapsed_str(total)}{C.RESET}")


def print_success_banner(version: str, vsix_path: str) -> None:
    """Print the final success summary with links."""
    heading("Published Successfully!")
    print(f"""
  {C.GREEN}{C.BOLD}v{version} is live!{C.RESET}

  {C.CYAN}Marketplace:{C.RESET}
    {C.WHITE}{MARKETPLACE_URL}{C.RESET}

  {C.CYAN}GitHub Release:{C.RESET}
    {C.WHITE}{REPO_URL}/releases/tag/v{version}{C.RESET}

  {C.CYAN}VSIX:{C.RESET}
    {C.WHITE}{os.path.basename(vsix_path)}{C.RESET}
""")
    try:
        webbrowser.open(MARKETPLACE_URL)
    except Exception:
        pass


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


# ── Main ─────────────────────────────────────────────────────
# The pipeline is split into small orchestrator functions to keep each
# under the 30-line limit. The flow is:
#   main() → _run_analysis() → _run_build_and_validate()
#                             → confirm_publish() → _run_publish()


def _run_prerequisites(
    args: argparse.Namespace,
    results: list[tuple[str, bool, float]],
) -> bool:
    """Step 1: Check all prerequisite tools. Returns True if all pass.

    Checks Node, npm, git, gh CLI, and VS Code CLI. The vsce PAT
    check is only added when we're doing a full publish (not --analyze-only).
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
    # gh CLI and vsce PAT are only required for publishing.
    # In analyze-only mode they're not needed at all.
    if not args.analyze_only:
        if not run_step("GitHub CLI", check_gh_cli, results):
            return False
        if not run_step("vsce PAT", check_vsce_auth, results):
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


def _run_publish(
    version: str,
    results: list[tuple[str, bool, float]],
) -> bool:
    """Run all publish steps (11-16). Returns True on success.

    If the GitHub release (Step 16) fails but marketplace publish
    (Step 15) succeeded, we warn but still consider the publish
    successful — the extension is live, just missing its GH release.
    """
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


def _finish_analyze_only(
    args: argparse.Namespace,
    results: list[tuple[str, bool, float]],
    version: str,
) -> int:
    """Post-analysis: package .vsix and offer local install.

    This is the old dev.py "done" flow — build the package, print
    install instructions, and prompt the user to install locally.
    """
    # Package the .vsix (same as the old dev.py build step)
    heading("Package")
    t0 = time.time()
    vsix_path = step_package()
    elapsed = time.time() - t0
    results.append(("Package", vsix_path is not None, elapsed))

    report = save_report(results, version, vsix_path)
    print_timing(results)

    # If packaging failed, report and exit with failure code
    if not vsix_path:
        _print_report_path(report)
        return ExitCode.PACKAGE_FAILED

    heading("Done")
    passed_count = sum(1 for _, p, _ in results if p)
    ok(f"{C.BOLD}Build complete!{C.RESET} "
       f"{dim(f'{passed_count}/{len(results)} steps passed')}")
    ok(f"VSIX: {C.WHITE}{os.path.basename(vsix_path)}{C.RESET}")

    print_install_instructions(vsix_path)
    if args.auto_install:
        _auto_install_vsix(vsix_path)
    else:
        prompt_install(vsix_path)

    _print_report_path(report)
    if report:
        prompt_open_report(report)

    return ExitCode.SUCCESS


def _auto_install_vsix(vsix_path: str) -> None:
    """CI mode: install .vsix via code CLI without prompting."""
    vsix_name = os.path.basename(vsix_path)
    info(f"Running: code --install-extension {vsix_name}")
    run(["code", "--install-extension", os.path.abspath(vsix_path)])


def main() -> int:
    """Main entry point — developer toolkit + publish pipeline.

    Flow:
    1. Run analysis phase (Steps 1-10) — all must pass
    2. If --analyze-only: package .vsix, offer local install, exit
    3. Otherwise: show confirmation gate, then publish (Steps 11-16)
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

    # ── ANALYZE-ONLY: package + local install (like old dev.py) ──
    if args.analyze_only:
        return _finish_analyze_only(args, results, version)

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

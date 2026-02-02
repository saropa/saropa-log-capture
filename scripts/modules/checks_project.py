# -*- coding: utf-8 -*-
"""Project state checks: git, dependencies, build, quality, and version.

These checks validate the git state, project dependencies, build output,
and version consistency before we attempt any package or publish operations.
"""

import json
import os
import re

from modules.constants import C, MAX_FILE_LINES, PROJECT_ROOT
from modules.display import ask_yn, fail, fix, info, ok, warn
from modules.utils import read_package_version, run


# ── Git & Dependencies ─────────────────────────────────────


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


# ── Build & Quality ────────────────────────────────────────


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


# ── Version ────────────────────────────────────────────────


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

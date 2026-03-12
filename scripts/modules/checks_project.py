# -*- coding: utf-8 -*-
"""Project state checks: git, dependencies, build, quality, and version.

These checks validate the git state, project dependencies, build output,
and version consistency before we attempt any package or publish operations.
"""

import os
import re
import sys

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
    """Check the 300-line limit on all TypeScript files in src/.

    This is a project quality guideline. Keeping files
    short encourages modular design and makes code review easier.
    
    NOTE: This check triggers a WARNING only. It does not halt the build/publish
    process, allowing for legacy files or temporary exceptions.
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
        # Warn but don't block — treat as technical debt, not a hard gate
        warn(f"{len(violations)} file(s) exceed {MAX_FILE_LINES}-line limit:")
        for v in violations:
            print(f"         {C.RED}{v}{C.RESET}")
        return True

    ok(f"All .ts files are within the {MAX_FILE_LINES}-line limit")
    return True


# ── Version ────────────────────────────────────────────────


def _parse_semver(version: str) -> tuple[int, ...]:
    """Parse a semver string into a tuple of ints for comparison."""
    return tuple(int(x) for x in version.split("."))


def _get_changelog_max_version() -> str | None:
    """Return the highest versioned heading in CHANGELOG.md, or None."""
    changelog_path = os.path.join(PROJECT_ROOT, "CHANGELOG.md")
    versions: list[str] = []
    try:
        with open(changelog_path, encoding="utf-8") as f:
            for line in f:
                m = re.match(r'^## \[(\d+\.\d+\.\d+)\]', line)
                if m:
                    versions.append(m.group(1))
    except OSError:
        return None
    if not versions:
        return None
    return max(versions, key=_parse_semver)


# Keywords that mean "changelog not yet published" (any triggers auto-bump when tag exists).
_UNPUBLISHED_HEADING_RE = re.compile(
    r'^##\s*\[(?:Unreleased|Unpublished|Undefined)\]', re.IGNORECASE | re.MULTILINE
)


def _changelog_has_unpublished_heading() -> bool:
    """True if CHANGELOG has ## [Unreleased], [Unpublished], or [Undefined]."""
    changelog_path = os.path.join(PROJECT_ROOT, "CHANGELOG.md")
    try:
        with open(changelog_path, encoding="utf-8") as f:
            for line in f:
                if _UNPUBLISHED_HEADING_RE.match(line):
                    return True
    except OSError:
        pass
    return False


# First release heading: ## [x.y.z] (so we know where to insert [Unreleased])
_FIRST_RELEASE_HEADING_RE = re.compile(r'^##\s*\[\d+\.\d+\.\d+\]', re.MULTILINE)


def _ensure_unreleased_section() -> bool:
    """If CHANGELOG has no ## [Unreleased], insert it before the first ## [x.y.z] section.

    Keeps Keep a Changelog convention; the stamp step will replace it with [version].
    Returns True if the file now has an unreleased heading (added or already present).
    """
    if _changelog_has_unpublished_heading():
        return True
    changelog_path = os.path.join(PROJECT_ROOT, "CHANGELOG.md")
    try:
        with open(changelog_path, encoding="utf-8") as f:
            content = f.read()
    except OSError:
        fail("Could not read CHANGELOG.md")
        return False
    match = _FIRST_RELEASE_HEADING_RE.search(content)
    if not match:
        fail("CHANGELOG.md has no ## [Unreleased] and no ## [x.y.z] release heading.")
        return False
    insert = "## [Unreleased]\n\n"
    new_content = content[: match.start()] + insert + content[match.start() :]
    try:
        with open(changelog_path, "w", encoding="utf-8") as f:
            f.write(new_content)
    except OSError:
        fail("Could not write CHANGELOG.md")
        return False
    fix("Added ## [Unreleased] to CHANGELOG.md")
    return True


def has_unreleased_section() -> bool:
    """Check if CHANGELOG.md has an ## [Unreleased] section.

    The [Unreleased] heading (per Keep a Changelog convention) indicates
    work-in-progress changes. During publish, it gets replaced with the
    version number. Also accepts [Unpublished] / [Undefined].
    """
    return _changelog_has_unpublished_heading()


def _is_version_tagged(version: str) -> bool:
    """Check whether a git tag already exists for this version."""
    tag = f"v{version}"
    result = run(["git", "tag", "-l", tag], cwd=PROJECT_ROOT)
    return bool(result.stdout.strip())


def _bump_patch(version: str) -> str:
    """Increment the patch component of a semver string."""
    major, minor, patch = version.split(".")
    return f"{major}.{minor}.{int(patch) + 1}"


def _write_package_version(version: str) -> bool:
    """Write a new version string into package.json.

    Uses regex replacement to preserve key order and formatting,
    avoiding json.dump which alphabetizes keys.
    """
    pkg_path = os.path.join(PROJECT_ROOT, "package.json")
    try:
        with open(pkg_path, encoding="utf-8") as f:
            content = f.read()
    except OSError:
        fail("Could not read package.json")
        return False

    updated, count = re.subn(
        r'("version"\s*:\s*")([^"]+)(")',
        rf'\g<1>{version}\3',
        content,
        count=1,
    )
    if count == 0:
        fail("Could not find 'version' field in package.json")
        return False

    try:
        with open(pkg_path, "w", encoding="utf-8") as f:
            f.write(updated)
    except OSError:
        fail("Could not write package.json")
        return False
    return True


def _stamp_changelog(version: str) -> bool:
    """Replace '## [Unreleased]' (or [Unpublished]/[Undefined]) with '## [version]'.

    Version-only heading (no date). Called during validation so the
    CHANGELOG is finalized before packaging. If publish is cancelled,
    the change is uncommitted and easily reverted with git.
    """
    changelog_path = os.path.join(PROJECT_ROOT, "CHANGELOG.md")
    try:
        with open(changelog_path, encoding="utf-8") as f:
            content = f.read()
    except OSError:
        fail("Could not read CHANGELOG.md")
        return False

    replacement = f'## [{version}]'
    updated, count = _UNPUBLISHED_HEADING_RE.subn(replacement, content)
    if count == 0:
        fail("Could not find '## [Unreleased]' (or [Unpublished]/[Undefined]) in CHANGELOG.md")
        return False

    try:
        with open(changelog_path, "w", encoding="utf-8") as f:
            f.write(updated)
    except OSError:
        fail("Could not write CHANGELOG.md")
        return False

    ok(f"CHANGELOG: [Unreleased] → [{version}]")
    return True


def _prompt_version(suggested: str, min_version: str) -> str | None:
    """Prompt user to accept suggested version or enter custom. Returns version or None.

    User can press Enter to accept suggested, or type a semver string.
    The chosen version must be >= min_version.
    """
    if not sys.stdin.isatty():
        return suggested

    try:
        answer = input(
            f"  {C.YELLOW}Version [{suggested}]: {C.RESET}"
        ).strip()
    except (EOFError, KeyboardInterrupt):
        print()
        return None

    # Default (Enter) → use suggested
    if not answer:
        return suggested

    # Explicit cancel
    if answer.lower() in ("n", "no", "q", "quit", "exit"):
        return None

    # Custom version string → validate format and minimum
    if not re.match(r"^\d+\.\d+\.\d+$", answer):
        fail(f"Invalid version format: {answer} (expected x.y.z)")
        return None

    if _parse_semver(answer) < _parse_semver(min_version):
        fail(f"Version {answer} is below minimum {min_version}")
        return None

    return answer


def validate_version_changelog() -> tuple[str, bool]:
    """Validate version, prompt user, and stamp CHANGELOG.

    Simple flow:
    1. Determine minimum version (max of changelog versions)
    2. Suggest next patch version as default
    3. ONE prompt: user accepts or enters custom version (must be >= minimum)
    4. Check tag is available
    5. Stamp CHANGELOG
    """
    pkg_version = read_package_version()
    if pkg_version == "unknown":
        fail("Could not read version from package.json")
        return pkg_version, False

    # Minimum version = highest in changelog (if any)
    max_cl = _get_changelog_max_version()
    min_version = max_cl if max_cl else "0.0.0"

    # Suggest: bump patch from max(changelog, package), or use package if higher
    if max_cl and _parse_semver(pkg_version) <= _parse_semver(max_cl):
        suggested = _bump_patch(max_cl)
        info(f"package.json v{pkg_version}, CHANGELOG max v{max_cl}")
    else:
        suggested = pkg_version
        if max_cl:
            info(f"package.json v{pkg_version} > CHANGELOG max v{max_cl}")

    # Non-interactive mode: use suggested version
    if os.environ.get("PUBLISH_YES"):
        version = suggested
    else:
        version = _prompt_version(suggested, min_version)
        if version is None:
            fail("Version not confirmed.")
            return pkg_version, False

    # Write to package.json if changed
    if version != pkg_version:
        if not _write_package_version(version):
            return pkg_version, False
        fix(f"package.json: {pkg_version} → {C.WHITE}{version}{C.RESET}")

    # Check if this is a re-publish (tag already exists)
    is_republish = _is_version_tagged(version)
    if is_republish:
        info(f"Tag 'v{version}' exists (re-publish / sync)")
    else:
        ok(f"Tag 'v{version}' is available")

    # For new releases: ensure changelog has unreleased section and stamp it
    # For re-publish: skip changelog changes (already stamped)
    if not is_republish:
        if not has_unreleased_section():
            if not _ensure_unreleased_section():
                return version, False
        if not _stamp_changelog(version):
            return version, False

    ok(f"Version {C.WHITE}{version}{C.RESET} validated")
    return version, True

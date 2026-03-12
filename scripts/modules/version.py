# -*- coding: utf-8 -*-
"""Version validation and CHANGELOG operations.

Handles version resolution, user prompts, package.json updates,
and CHANGELOG stamping for the publish pipeline.
"""

import os
import re
import sys

from modules.constants import C, PROJECT_ROOT
from modules.display import fail, fix, info, ok
from modules.utils import read_package_version, run
from modules.publish_git import is_version_tagged


# Keywords that mean "changelog not yet published".
_UNPUBLISHED_HEADING_RE = re.compile(
    r'^##\s*\[(?:Unreleased|Unpublished|Undefined)\]', re.IGNORECASE | re.MULTILINE
)

# First release heading: ## [x.y.z]
_FIRST_RELEASE_HEADING_RE = re.compile(r'^##\s*\[\d+\.\d+\.\d+\]', re.MULTILINE)


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


def _ensure_unreleased_section() -> bool:
    """Insert ## [Unreleased] before the first ## [x.y.z] if missing.

    Keeps Keep a Changelog convention; the stamp step will replace it.
    Returns True if the file now has an unreleased heading.
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


def _bump_patch(version: str) -> str:
    """Increment the patch component of a semver string."""
    major, minor, patch = version.split(".")
    return f"{major}.{minor}.{int(patch) + 1}"


def _write_package_version(version: str) -> bool:
    """Write a new version string into package.json.

    Uses regex replacement to preserve key order and formatting.
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
    """Replace '## [Unreleased]' with '## [version]', then add new Unreleased.

    Version-only heading (no date). Called during validation so the
    CHANGELOG is finalized before packaging. After stamping, inserts a
    fresh '## [Unreleased]' section at the top for future development.
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
        fail("Could not find '## [Unreleased]' in CHANGELOG.md")
        return False

    # Insert a new ## [Unreleased] section before the just-stamped version
    new_unreleased = "## [Unreleased]\n\n---\n\n"
    updated = updated.replace(replacement, new_unreleased + replacement, 1)

    try:
        with open(changelog_path, "w", encoding="utf-8") as f:
            f.write(updated)
    except OSError:
        fail("Could not write CHANGELOG.md")
        return False

    ok(f"CHANGELOG: [Unreleased] -> [{version}]")
    return True


def _prompt_version(suggested: str, min_version: str) -> str | None:
    """Prompt user to accept suggested version or enter custom.

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

    if not answer:
        return suggested

    if answer.lower() in ("n", "no", "q", "quit", "exit"):
        return None

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

    max_cl = _get_changelog_max_version()
    min_version = max_cl if max_cl else "0.0.0"

    if max_cl and _parse_semver(pkg_version) <= _parse_semver(max_cl):
        suggested = _bump_patch(max_cl)
        info(f"package.json v{pkg_version}, CHANGELOG max v{max_cl}")
    else:
        suggested = pkg_version
        if max_cl:
            info(f"package.json v{pkg_version} > CHANGELOG max v{max_cl}")

    if os.environ.get("PUBLISH_YES"):
        version = suggested
    else:
        version = _prompt_version(suggested, min_version)
        if version is None:
            fail("Version not confirmed.")
            return pkg_version, False

    if version != pkg_version:
        if not _write_package_version(version):
            return pkg_version, False
        fix(f"package.json: {pkg_version} -> {C.WHITE}{version}{C.RESET}")

    is_republish = is_version_tagged(version)
    if is_republish:
        info(f"Tag 'v{version}' exists (re-publish / sync)")
    else:
        ok(f"Tag 'v{version}' is available")

    if not is_republish:
        if not has_unreleased_section():
            if not _ensure_unreleased_section():
                return version, False
        if not _stamp_changelog(version):
            return version, False

    ok(f"Version {C.WHITE}{version}{C.RESET} validated")
    return version, True

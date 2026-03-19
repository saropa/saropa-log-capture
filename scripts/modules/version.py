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
# Versioned heading with " - Unreleased" suffix (Keep a Changelog style).
_VERSIONED_UNRELEASED_RE = re.compile(
    r'^##\s*\[(\d+\.\d+\.\d+)\]\s*-\s*(?:Unreleased|Unpublished|Undefined)\s*$',
    re.IGNORECASE | re.MULTILINE,
)

# First release heading: ## [x.y.z]
_FIRST_RELEASE_HEADING_RE = re.compile(r'^##\s*\[\d+\.\d+\.\d+\]', re.MULTILINE)

_CHANGELOG_FILENAME = "CHANGELOG.md"
_CHANGELOG_PATH_ROOT = os.path.join(PROJECT_ROOT, _CHANGELOG_FILENAME)
_CHANGELOG_PATH_DOCS = os.path.join(PROJECT_ROOT, "docs", _CHANGELOG_FILENAME)


def _resolve_changelog_path() -> str:
    # Prefer the project front-door changelog at repo root.
    # Fall back to `docs/` for compatibility with older workspace layouts.
    if os.path.exists(_CHANGELOG_PATH_ROOT):
        return _CHANGELOG_PATH_ROOT
    return _CHANGELOG_PATH_DOCS


def _parse_semver(version: str) -> tuple[int, ...]:
    """Parse a semver string into a tuple of ints for comparison."""
    return tuple(int(x) for x in version.split("."))


def _get_changelog_versions() -> list[str]:
    """Return released version headings in CHANGELOG.md (excludes ## [x.y.z] - Unreleased)."""
    changelog_path = _resolve_changelog_path()
    versions: list[str] = []
    try:
        with open(changelog_path, encoding="utf-8") as f:
            for line in f:
                m = re.match(r'^## \[(\d+\.\d+\.\d+)\]', line)
                if m and not _VERSIONED_UNRELEASED_RE.match(line):
                    versions.append(m.group(1))
    except OSError:
        pass
    return versions


def _get_changelog_max_version() -> str | None:
    """Return the highest versioned heading in CHANGELOG.md, or None."""
    versions = _get_changelog_versions()
    if not versions:
        return None
    return max(versions, key=_parse_semver)


def _changelog_has_unpublished_heading() -> bool:
    """True if CHANGELOG has ## [Unreleased], [Unpublished], [Undefined], or ## [x.y.z] - Unreleased."""
    changelog_path = _resolve_changelog_path()
    try:
        with open(changelog_path, encoding="utf-8") as f:
            for line in f:
                if _UNPUBLISHED_HEADING_RE.match(line):
                    return True
                if _VERSIONED_UNRELEASED_RE.match(line):
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
    changelog_path = _resolve_changelog_path()
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
    """Replace '## [Unreleased]' or '## [version] - Unreleased' with '## [version]', then add new Unreleased.

    Version-only heading (no date). Called during validation so the
    CHANGELOG is finalized before packaging. After stamping, inserts a
    fresh '## [Unreleased]' section at the top for future development.
    """
    changelog_path = _resolve_changelog_path()
    try:
        with open(changelog_path, encoding="utf-8") as f:
            content = f.read()
    except OSError:
        fail("Could not read CHANGELOG.md")
        return False

    replacement = f'## [{version}]'

    # First try stripping " - Unreleased" from ## [version] - Unreleased
    versioned_unreleased = re.compile(
        rf'^##\s*\[{re.escape(version)}\]\s*-\s*(?:Unreleased|Unpublished|Undefined)\s*$',
        re.IGNORECASE | re.MULTILINE,
    )
    updated, count = versioned_unreleased.subn(replacement, content)
    if count == 0:
        updated, count = _UNPUBLISHED_HEADING_RE.subn(replacement, content)
    if count == 0:
        fail("Could not find '## [Unreleased]' or '## [version] - Unreleased' in CHANGELOG.md")
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

    Prompt shows default; empty Enter accepts it. Readline pre-fills when available.
    The chosen version must be >= min_version.
    """
    if not sys.stdin.isatty():
        return suggested

    prompt = f"  {C.YELLOW}Version{C.RESET} (Enter = {C.WHITE}{suggested}{C.RESET}): "
    rl = None
    try:
        import readline as rl
    except ImportError:
        if sys.platform == "win32":
            try:
                import pyreadline3 as rl  # type: ignore[no-redef]
            except ImportError:
                pass
    if rl is not None:
        def prefill():
            rl.insert_text(suggested)
            rl.redisplay()
        rl.set_startup_hook(prefill)

    try:
        answer = input(prompt).strip()
    except (EOFError, KeyboardInterrupt):
        print()
        return None
    finally:
        if rl is not None:
            try:
                rl.set_startup_hook()
            except Exception:
                pass

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

    info(f"package.json v{pkg_version}, CHANGELOG max v{max_cl}")
    if max_cl and _parse_semver(pkg_version) < _parse_semver(max_cl):
        # CHANGELOG ahead of package: assume dev wants the changelog version, don't bump again
        suggested = max_cl
    else:
        suggested = pkg_version

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

    # Only stamp changelog if this version doesn't already have an entry
    version_in_changelog = version in _get_changelog_versions()
    if not is_republish and not version_in_changelog:
        if not has_unreleased_section():
            if not _ensure_unreleased_section():
                return version, False
        if not _stamp_changelog(version):
            return version, False

    ok(f"Version {C.WHITE}{version}{C.RESET} validated")
    return version, True

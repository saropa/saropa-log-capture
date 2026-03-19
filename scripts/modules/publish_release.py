# -*- coding: utf-8 -*-
"""Release operations: package, marketplace, Open VSX, and GitHub.

All functions in this module perform publishing operations that
upload artifacts to external services.
"""

import glob
import json
import os
import re
import tempfile
import time

from modules.constants import C, MARKETPLACE_EXTENSION_ID, PROJECT_ROOT
from modules.display import fail, info, ok, warn
from modules.utils import get_ovsx_pat, run

# Error from yazl when a file's size changes between stat and read (e.g. watch overwriting dist).
_YAZL_STREAM_BYTES_ERROR = "file data stream has unexpected number of bytes"

_MAX_PACKAGE_ATTEMPTS = 2

# vsce CLI package name used in `npx` (deduplicated to satisfy lints).
_VSCE_CLI = "@vscode/vsce"


def step_package() -> str | None:
    """Package the extension into a .vsix file. Returns the file path.

    Uses vsce (Visual Studio Code Extensions CLI) to create a .vsix archive.
    The production build was already done in the Compile step; we skip vsce's
    prepublish (npm_config_ignore_scripts=1) so no second build runs and no
    file is written during zip, avoiding "file data stream has unexpected
    number of bytes" from yazl. --no-dependencies skips bundling node_modules.
    """
    # Skip prepublish so vsce only zips; build was done in Compile step.
    env = os.environ.copy()
    env["npm_config_ignore_scripts"] = "1"
    for attempt in range(1, _MAX_PACKAGE_ATTEMPTS + 1):
        if attempt > 1:
            warn("Retrying packaging after stream error.")
            time.sleep(1.5)
        info("Packaging .vsix file...")
        result = run(
            ["npx", _VSCE_CLI, "package", "--no-dependencies"],
            cwd=PROJECT_ROOT,
            env=env,
        )
        if result.returncode == 0:
            break
        combined = (result.stdout + "\n" + result.stderr).strip()
        is_stream_error = _YAZL_STREAM_BYTES_ERROR in combined
        if is_stream_error and attempt < _MAX_PACKAGE_ATTEMPTS:
            continue
        fail("Packaging failed:")
        if result.stdout.strip():
            print(result.stdout)
        if result.stderr.strip():
            print(result.stderr)
        if is_stream_error:
            info("Hint: Stop any running 'npm run watch' or VS Code watch tasks, then run publish again.")
        return None

    pattern = os.path.join(PROJECT_ROOT, "*.vsix")
    vsix_files = sorted(glob.glob(pattern), key=os.path.getmtime)
    if not vsix_files:
        fail("No .vsix file found after packaging.")
        return None

    vsix_path = vsix_files[-1]
    size_kb = os.path.getsize(vsix_path) / 1024
    ok(f"Created: {os.path.basename(vsix_path)} ({size_kb:.0f} KB)")
    return vsix_path


def get_marketplace_published_version() -> str | None:
    """Return the latest version published on VS Code Marketplace, or None.

    Uses vsce show --json. When unauthenticated or offline, returns None.
    This can take 30-60 seconds due to marketplace API latency.
    """
    info("Checking marketplace version (this may take up to 60s)...")
    result = run(
        ["npx", _VSCE_CLI, "show", MARKETPLACE_EXTENSION_ID, "--json"],
        cwd=PROJECT_ROOT,
    )
    if result.returncode != 0 or not result.stdout.strip():
        return None
    try:
        data = json.loads(result.stdout)
        versions = data.get("versions")
        if versions and isinstance(versions, list) and len(versions) > 0:
            first = versions[0]
            if isinstance(first, dict) and "version" in first:
                return str(first["version"]).strip()
    except (json.JSONDecodeError, TypeError):
        pass
    return None


def publish_marketplace(vsix_path: str) -> bool:
    """Publish the pre-built .vsix to VS Code Marketplace.

    Requires a valid PAT (Personal Access Token) for the 'saropa' publisher.
    The PAT is stored in the system keychain via `npx @vscode/vsce login`.
    """
    vsix_name = os.path.basename(vsix_path)
    info(f"Publishing {vsix_name} to marketplace...")
    result = run(
        ["npx", _VSCE_CLI, "publish", "--packagePath", vsix_path],
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


def publish_openvsx(vsix_path: str) -> bool:
    """Publish the pre-built .vsix to Open VSX (open-vsx.org).

    Used by Cursor, VSCodium, and others. Token from OVSX_PAT env or .env.
    """
    pat = get_ovsx_pat()
    if not pat:
        fail("OVSX_PAT is not set. Create a token at open-vsx.org/user-settings/tokens")
        return False
    vsix_name = os.path.basename(vsix_path)
    info(f"Publishing {vsix_name} to Open VSX...")
    result = run(
        ["npx", "ovsx", "publish", vsix_path, "-p", pat],
        cwd=PROJECT_ROOT,
    )
    if result.returncode != 0:
        fail("Open VSX publish failed:")
        if result.stdout.strip():
            print(result.stdout)
        if result.stderr.strip():
            print(result.stderr)
        return False
    ok("Published to Open VSX")
    return True


def extract_changelog_section(version: str) -> str:
    """Extract the CHANGELOG content for a specific version.

    Reads everything between `## [X.Y.Z]` and the next `## [` header.
    Returns a generic "Release X.Y.Z" message if the section is empty.
    """
    changelog_path = os.path.join(PROJECT_ROOT, "CHANGELOG.md")
    try:
        with open(changelog_path, encoding="utf-8") as f:
            lines = f.readlines()
    except OSError:
        # Compatibility fallback for older workspace layouts.
        fallback = os.path.join(PROJECT_ROOT, "docs", "CHANGELOG.md")
        try:
            with open(fallback, encoding="utf-8") as f:
                lines = f.readlines()
        except OSError:
            return f"Release {version}"

    collecting = False
    section: list[str] = []
    for line in lines:
        if re.match(rf'^## \[{re.escape(version)}\]', line):
            collecting = True
            continue
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

    Notes are written to a temp file (--notes-file) rather than passed
    via --notes to avoid Windows command line length limits (~8191 chars).
    """
    tag = f"v{version}"
    view = run(["gh", "release", "view", tag], cwd=PROJECT_ROOT)
    if view.returncode == 0:
        info(f"GitHub release {tag} already exists; skipping.")
        return True

    notes = extract_changelog_section(version)
    info(f"Creating GitHub release {tag}...")

    with tempfile.NamedTemporaryFile(
        mode="w",
        suffix=".md",
        delete=False,
        encoding="utf-8",
    ) as f:
        f.write(notes)
        notes_file = f.name

    try:
        result = run(
            [
                "gh", "release", "create", tag,
                os.path.abspath(vsix_path),
                "--title", tag,
                "--notes-file", notes_file,
            ],
            cwd=PROJECT_ROOT,
        )
    finally:
        os.unlink(notes_file)

    if result.returncode != 0:
        fail("GitHub release failed:")
        if result.stderr.strip():
            print(f"         {result.stderr.strip()}")
        _print_gh_troubleshooting()
        return False

    ok(f"GitHub release {tag} created")
    return True


def _print_gh_troubleshooting() -> None:
    """Print troubleshooting hints for GitHub release failures."""
    info("Troubleshooting:")
    info(f"  1. Check auth: {C.YELLOW}gh auth status{C.RESET}")
    info("  2. If GITHUB_TOKEN is set, clear it:")
    info(f"     PowerShell: {C.YELLOW}$env:GITHUB_TOKEN = \"\"{C.RESET}")
    info(f"     Bash: {C.YELLOW}unset GITHUB_TOKEN{C.RESET}")

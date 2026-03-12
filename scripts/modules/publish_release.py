# -*- coding: utf-8 -*-
"""Release operations: package, marketplace, Open VSX, and GitHub.

All functions in this module perform publishing operations that
upload artifacts to external services.
"""

import glob
import json
import os
import re
import subprocess
import tempfile
import time

from modules.constants import C, MARKETPLACE_EXTENSION_ID, PROJECT_ROOT
from modules.display import fail, info, ok
from modules.utils import get_ovsx_pat, run


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

    pattern = os.path.join(PROJECT_ROOT, "*.vsix")
    vsix_files = sorted(glob.glob(pattern), key=os.path.getmtime)
    if not vsix_files:
        fail("No .vsix file found after packaging.")
        return None

    vsix_path = vsix_files[-1]
    size_kb = os.path.getsize(vsix_path) / 1024
    ok(f"Created: {os.path.basename(vsix_path)} ({size_kb:.0f} KB)")
    return vsix_path


def _run_with_progress(
    cmd: list[str],
    label: str,
    timeout_secs: int = 300,
) -> subprocess.CompletedProcess[str]:
    """Run a command with polling progress dots. Returns CompletedProcess."""
    print(f"  [INFO] {label}", end="", flush=True)
    proc = subprocess.Popen(
        cmd,
        cwd=PROJECT_ROOT,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        stdin=subprocess.DEVNULL,
        text=True,
        encoding="utf-8",
        errors="replace",
        shell=True,
    )
    start = time.time()
    while proc.poll() is None:
        if time.time() - start > timeout_secs:
            proc.kill()
            print(" TIMEOUT")
            return subprocess.CompletedProcess(cmd, -1, "", "Timed out")
        print(".", end="", flush=True)
        time.sleep(2)
    print()  # newline after dots
    stdout, stderr = proc.communicate()
    return subprocess.CompletedProcess(cmd, proc.returncode, stdout, stderr)


def get_marketplace_published_version() -> str | None:
    """Return the latest version published on VS Code Marketplace, or None.

    Uses vsce show --json. When unauthenticated or offline, returns None.
    """
    result = _run_with_progress(
        ["npx", "@vscode/vsce", "show", MARKETPLACE_EXTENSION_ID, "--json"],
        "Checking marketplace version",
        timeout_secs=60,
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
    result = _run_with_progress(
        ["npx", "@vscode/vsce", "publish", "--packagePath", vsix_path],
        f"Publishing {vsix_name} to marketplace",
        timeout_secs=300,
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
    result = _run_with_progress(
        ["npx", "ovsx", "publish", vsix_path, "-p", pat],
        f"Publishing {vsix_name} to Open VSX",
        timeout_secs=300,
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
    info(f"  2. If GITHUB_TOKEN is set, clear it:")
    info(f"     PowerShell: {C.YELLOW}$env:GITHUB_TOKEN = \"\"{C.RESET}")
    info(f"     Bash: {C.YELLOW}unset GITHUB_TOKEN{C.RESET}")

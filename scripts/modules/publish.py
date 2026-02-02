# -*- coding: utf-8 -*-
"""Publish operations: confirmation, CHANGELOG, package, git, marketplace, GitHub.

All functions in this module perform irreversible mutations (write files,
create git tags, publish to marketplace, create GitHub releases).
"""

import datetime
import glob
import os
import re

from modules.constants import C, MARKETPLACE_URL, PROJECT_ROOT, REPO_URL
from modules.display import ask_yn, fail, info, ok
from modules.utils import run


# ── Publish: Confirmation ────────────────────────────────────


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

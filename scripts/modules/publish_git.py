# -*- coding: utf-8 -*-
"""Git operations for publishing: commit, push, and tag.

All functions in this module perform irreversible git mutations.
"""

from modules.constants import PROJECT_ROOT
from modules.display import fail, fix, info, ok
from modules.utils import run


def is_version_tagged(version: str) -> bool:
    """True if git tag v{version} already exists (e.g. publish as-is)."""
    tag = f"v{version}"
    result = run(["git", "tag", "-l", tag], cwd=PROJECT_ROOT)
    return bool(result.stdout.strip())


def git_commit_and_push(version: str) -> bool:
    """Commit all staged changes and push to origin.

    Stages everything with `git add -A` so the finalized CHANGELOG.md
    and any other pending changes are included in the release commit.
    If there's nothing to commit (e.g., CHANGELOG was already finalized),
    this succeeds silently.
    """
    info("Staging changes...")
    run(["git", "add", "-A"], cwd=PROJECT_ROOT)

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
    If push is rejected (non-fast-forward), pulls with merge and retries once.
    """
    branch = run(
        ["git", "rev-parse", "--abbrev-ref", "HEAD"],
        cwd=PROJECT_ROOT,
    )
    branch_name = branch.stdout.strip() or "main"

    info("Pushing to origin...")
    push = run(
        ["git", "push", "origin", branch_name],
        cwd=PROJECT_ROOT,
    )
    if push.returncode == 0:
        ok(f"Pushed to origin/{branch_name}")
        return True

    if "non-fast-forward" in (push.stderr or "") or "rejected" in (push.stderr or "").lower():
        fix("Remote has new commits; pulling with merge then re-pushing...")
        pull = run(["git", "pull", "origin", branch_name, "--no-edit"], cwd=PROJECT_ROOT)
        if pull.returncode != 0:
            fail(f"git pull failed: {pull.stderr.strip()}")
            return False
        ok("Merged remote changes")
        push2 = run(["git", "push", "origin", branch_name], cwd=PROJECT_ROOT)
        if push2.returncode != 0:
            fail(f"git push failed after merge: {push2.stderr.strip()}")
            return False
        ok(f"Pushed to origin/{branch_name}")
        return True

    fail(f"git push failed: {push.stderr.strip()}")
    return False


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

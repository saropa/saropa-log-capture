# -*- coding: utf-8 -*-
"""Git operations for publishing: commit, push, and tag.

All functions in this module perform irreversible git mutations.
"""

from modules.publish.constants import PROJECT_ROOT
from modules.publish.display import fail, fix, info, ok
from modules.publish.utils import run


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

    If push is rejected (non-fast-forward), rebases the local release
    commit on top of remote and retries. Rebase is used instead of merge
    because a merge can conflict on files both sides touched (e.g.
    package.json version field), while rebase replays our commit on top
    of the latest remote state — keeping the release commit at HEAD.
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
        # Rebase instead of merge: our release commit (version bump +
        # CHANGELOG) should sit on top of whatever landed on remote.
        # A merge would conflict if remote also touched package.json.
        fix("Remote has new commits; rebasing release commit then re-pushing...")
        rebase = run(
            ["git", "pull", "--rebase", "origin", branch_name],
            cwd=PROJECT_ROOT,
        )
        if rebase.returncode != 0:
            # Rebase conflict — abort to restore clean state, then
            # tell the user to resolve manually.
            run(["git", "rebase", "--abort"], cwd=PROJECT_ROOT)
            fail("Rebase failed (conflict). Resolve manually and re-run.")
            return False
        ok("Rebased on latest remote")
        push2 = run(["git", "push", "origin", branch_name], cwd=PROJECT_ROOT)
        if push2.returncode != 0:
            fail(f"git push failed after rebase: {push2.stderr.strip()}")
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

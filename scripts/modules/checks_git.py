# -*- coding: utf-8 -*-
"""Git state checks: working tree and remote sync.

These checks verify the git repository is in a clean state before
we attempt any package or publish operations.
"""

from modules.constants import C, PROJECT_ROOT
from modules.display import ask_yn, fail, fix, ok, warn
from modules.utils import run


def check_working_tree() -> bool:
    """Verify git working tree is clean. Prompt if dirty.

    A dirty working tree is allowed during analysis (user confirms),
    but the publish phase will commit all staged changes, so the user
    needs to be aware of what will be included in the release commit.
    """
    result = run(["git", "status", "--porcelain"], cwd=PROJECT_ROOT)
    if result.returncode != 0:
        fail("Could not check git status.")
        return False
    if not result.stdout.strip():
        ok("Working tree is clean")
        return True

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
    remote = run(["git", "rev-parse", "@{u}"], cwd=PROJECT_ROOT)
    if remote.returncode != 0:
        warn("No upstream tracking branch. Skipping sync check.")
        return True
    if local.stdout.strip() == remote.stdout.strip():
        ok("Local branch is up to date with origin")
        return True

    base = run(["git", "merge-base", "HEAD", "@{u}"], cwd=PROJECT_ROOT)
    if base.stdout.strip() == local.stdout.strip():
        fix("Local is behind origin. Pulling...")
        pull = run(["git", "pull", "--ff-only"], cwd=PROJECT_ROOT)
        if pull.returncode != 0:
            fail("git pull --ff-only failed (branches diverged?)")
            return False
        ok("Pulled latest from origin")
        return True
    ok("Local is ahead of origin (will push during publish)")
    return True


def check_remote_sync() -> bool:
    """Fetch origin and ensure local branch is up to date.

    Fetches first so that @{u} comparison in _check_if_behind()
    uses the latest remote state.
    """
    from modules.display import info
    info("Fetching origin...")
    fetch = run(["git", "fetch", "origin"], cwd=PROJECT_ROOT)
    if fetch.returncode != 0:
        fail(f"git fetch failed: {fetch.stderr.strip()}")
        return False
    return _check_if_behind()

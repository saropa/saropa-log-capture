# -*- coding: utf-8 -*-
"""Prerequisite tool checks (Node, npm, git, gh CLI, vsce auth, OVSX PAT).

Each check returns True on success, False on blocking failure.
All prerequisites are blocking — the pipeline halts on the first failure
so the user gets a clear message about what to install.
"""

import json
import os
import re
import shutil
import subprocess
import sys

from modules.publish.constants import C, PROJECT_ROOT
from modules.publish.display import fail, fix, info, ok, prompt_fix_action, warn
from modules.publish.utils import get_ovsx_pat, run


def check_node() -> bool:
    """Verify Node.js is installed (>= 18).

    VS Code extensions require Node 18+ for the vsce packaging tool
    and for esbuild bundling.
    """
    result = run(["node", "--version"], check=False)
    if result.returncode != 0:
        fail("Node.js is not installed. Install from https://nodejs.org/")
        return False
    # node --version returns "vXX.YY.ZZ", strip the leading "v"
    version = result.stdout.strip().lstrip("v")
    major = int(version.split(".")[0])
    if major < 18:
        fail(f"Node.js {version} found — version 18+ required.")
        return False
    ok(f"Node.js {C.WHITE}{version}{C.RESET}")
    return True


def check_npm() -> bool:
    """Verify npm is installed.

    npm ships with Node.js, so a missing npm usually means a broken
    Node installation rather than a separate install step.
    """
    result = run(["npm", "--version"], check=False)
    if result.returncode != 0:
        fail("npm is not installed. It ships with Node.js — reinstall Node.")
        return False
    ok(f"npm {C.WHITE}{result.stdout.strip()}{C.RESET}")
    return True


def check_git() -> bool:
    """Verify git is installed.

    Required for working tree checks, commit, tag, and push operations
    during the publish phase.
    """
    result = run(["git", "--version"], check=False)
    if result.returncode != 0:
        fail("git is not installed. Install from https://git-scm.com/")
        return False
    ok(f"git — {C.WHITE}{result.stdout.strip()}{C.RESET}")
    return True


def check_gh_cli() -> bool:
    """Verify GitHub CLI is installed and authenticated.

    Only called when publishing (not --analyze-only). Blocking because
    Step 15 requires `gh release create` to attach the .vsix to a
    GitHub release. Failing early here prevents discovering the issue
    only after the marketplace publish has already succeeded.
    """
    if not shutil.which("gh"):
        fail("GitHub CLI (gh) is not installed.")
        info(f"  Install from {C.WHITE}https://cli.github.com/{C.RESET}")
        return False

    # Use a timeout because gh auth status can hang if the keyring is locked
    try:
        result = run(["gh", "auth", "status"], check=False, timeout=10)
    except subprocess.TimeoutExpired:
        fail("GitHub CLI auth check timed out.")
        return False
    if result.returncode != 0:
        fail(f"GitHub CLI not authenticated. "
             f"Run: {C.YELLOW}gh auth login{C.RESET}")
        return False
    ok("GitHub CLI — authenticated")
    return True


def check_vsce_auth() -> bool:
    """Verify vsce has valid marketplace credentials for publisher 'saropa'.

    Only called when --analyze-only is NOT set, since credentials are
    only needed for the actual marketplace publish in Step 13.
    Uses `vsce verify-pat` to validate without publishing. If verification
    fails, runs `vsce login saropa` interactively so the user can enter or
    overwrite the PAT (handles both first-time and overwrite prompts).
    """
    info("Checking marketplace credentials...")
    result = run(
        ["npx", "@vscode/vsce", "verify-pat", "saropa"],
        cwd=PROJECT_ROOT,
        check=False,
    )
    if result.returncode == 0:
        ok("Marketplace PAT verified for 'saropa'")
        return True

    # verify-pat may not exist in older vsce versions — treat as a
    # non-blocking warning rather than failing the entire pipeline
    stderr = (result.stderr or "").lower()
    if "unknown command" in stderr or "not a vsce command" in stderr:
        warn("Could not verify PAT (vsce verify-pat not available).")
        info("Publish may fail if credentials are missing.")
        return True

    # Run vsce login interactively: works for both first-time (PAT only) and
    # overwrite (y/N then PAT) without guessing prompt order via piped input.
    info("Marketplace needs a login token (PAT). Same token whether you use VS Code or Cursor — it can expire.")
    info(f"  Get one: {C.WHITE}https://marketplace.visualstudio.com/manage{C.RESET} -> your publisher -> Create token. Copy it, then paste here when vsce asks.")
    info("Running vsce login for publisher 'saropa'...")
    info("  If it asks to 'overwrite' — type y, then paste the token when asked.")
    login_result = subprocess.run(
        ["npx", "@vscode/vsce", "login", "saropa"],
        cwd=PROJECT_ROOT,
        shell=(sys.platform == "win32"),
    )
    if login_result.returncode != 0:
        fail("vsce login failed or was cancelled.")
        return False
    # Re-verify after login
    result = run(
        ["npx", "@vscode/vsce", "verify-pat", "saropa"],
        cwd=PROJECT_ROOT,
        check=False,
    )
    if result.returncode == 0:
        ok("Marketplace PAT verified for 'saropa'")
        return True
    fail("No valid marketplace PAT found for publisher 'saropa'.")
    info(f"  Run manually if needed: {C.YELLOW}npx @vscode/vsce login saropa{C.RESET}")
    return False


def check_ovsx_token() -> bool:
    """Check OVSX_PAT for Open VSX (Cursor / VSCodium). Never blocks: missing = skip step.

    Token is read from env or from project .env file (so Run from IDE works).
    When set, Step 14 will publish to Open VSX. When not set, we warn and
    skip Step 14 so the pipeline still succeeds (VS Code + GitHub release).
    """
    pat = get_ovsx_pat()
    if pat:
        ok("OVSX_PAT set (Open VSX publish)")
        return True
    warn("OVSX_PAT not set; Open VSX step will be skipped.")
    info(f"  Set in shell, or add to {C.WHITE}.env{C.RESET}: {C.YELLOW}OVSX_PAT=your-token{C.RESET}")
    info(f"  Token: {C.WHITE}https://open-vsx.org/user-settings/tokens{C.RESET}")
    return True


# Leading range operators in an npm version spec ("^1.120.0", ">=1.105.0").
# Stripped so the bare numeric version can be parsed for comparison.
_RANGE_PREFIX_RE = re.compile(r"^[\^~>=<\s]*")

_PKG_PATH = os.path.join(PROJECT_ROOT, "package.json")


def _range_version(spec: str) -> tuple[int, ...] | None:
    """Parse the numeric version out of an npm range spec like '^1.120.0'.

    Missing minor/patch components default to 0 so two- and three-part specs
    (e.g. '^1.120' and '^1.120.0') compare correctly.
    """
    cleaned = _RANGE_PREFIX_RE.sub("", spec.strip())
    m = re.match(r"(\d+)(?:\.(\d+))?(?:\.(\d+))?", cleaned)
    if not m:
        return None
    return tuple(int(g) for g in m.groups(default="0"))


def _types_vscode_spec(data: dict) -> str | None:
    """Return the declared @types/vscode range from package.json, or None."""
    # vsce reads the DECLARED range (devDependencies, then dependencies),
    # not what is installed in node_modules, so we read it the same way.
    for section in ("devDependencies", "dependencies"):
        deps = data.get(section) or {}
        if "@types/vscode" in deps:
            return str(deps["@types/vscode"])
    return None


def _align_types_to_engine(engine_spec: str) -> bool:
    """Rewrite devDependencies['@types/vscode'] to the engines.vscode range.

    Targeted regex (like _write_package_version in version.py) so key order and
    formatting in package.json are untouched. Setting the @types range equal to
    engines.vscode preserves the committed compatibility floor — the safe
    direction, since raising the engine would silently drop users on older
    VS Code builds.
    """
    try:
        with open(_PKG_PATH, encoding="utf-8") as f:
            content = f.read()
    except OSError:
        fail("Could not read package.json to align @types/vscode.")
        return False

    updated, count = re.subn(
        r'("@types/vscode"\s*:\s*")([^"]+)(")',
        rf"\g<1>{engine_spec}\3",
        content,
        count=1,
    )
    if count == 0:
        fail("Could not find @types/vscode in package.json to align it.")
        return False

    try:
        with open(_PKG_PATH, "w", encoding="utf-8") as f:
            f.write(updated)
    except OSError:
        fail("Could not write package.json to align @types/vscode.")
        return False
    fix(f"package.json: @types/vscode -> {engine_spec} (matches engines.vscode)")
    return True


def _handle_manifest_mismatch(engine_spec: str, types_spec: str) -> str:
    """Report the @types/vscode > engines.vscode mismatch; resolve via prompt.

    Returns 'accept' (fix applied — caller re-checks), 'retry', 'ignore', or
    'exit'. Non-interactive runs (CI / --yes / piped stdin) cannot answer a
    prompt, so they fail fast with the diagnosis rather than loop forever.
    """
    problem = (
        f"@types/vscode {types_spec} is newer than engines.vscode {engine_spec}. "
        "vsce refuses to package this and only checks it at the Package step — "
        "after the version bump and CHANGELOG stamp are already written, which is "
        "how the last run abandoned a half-finished release."
    )
    suggestions = [
        f"Lower @types/vscode to the engine floor ({engine_spec.strip()}) — keeps "
        "support for every VS Code at or above the committed floor (recommended).",
        "Or raise engines.vscode to the @types/vscode version — only if you intend "
        "to drop users on older VS Code builds.",
    ]
    accept_label = f"set @types/vscode to {engine_spec.strip()} to match engines.vscode"

    non_interactive = bool(os.environ.get("PUBLISH_YES")) or not sys.stdin.isatty()
    if non_interactive:
        fail("Manifest mismatch: " + problem)
        for line in suggestions:
            info(line)
        return "exit"

    action = prompt_fix_action(problem, suggestions, accept_label)
    if action != "accept":
        return action
    return "accept" if _align_types_to_engine(engine_spec) else "exit"


def check_manifest_compat() -> bool:
    """Gate the @types/vscode <-> engines.vscode contract before any mutation.

    vsce will not package when the declared @types/vscode version is newer than
    engines.vscode (e.g. types ^1.120.0 vs engine ^1.105.0), but it only enforces
    this at the Package step — after Step 10 has bumped package.json and stamped
    CHANGELOG. A failure there leaves a half-mutated, abandoned release (the 8.0.2
    incident, 2026-06-10). Running the same static comparison here, in
    prerequisites, means the pipeline self-heals or stops before anything is
    written. Aligning @types/vscode down also makes ensure_dependencies (Step 6)
    re-install, so the real compatibility question surfaces at Compile, not at
    Package.
    """
    while True:
        try:
            with open(_PKG_PATH, encoding="utf-8") as f:
                data = json.load(f)
        except (OSError, json.JSONDecodeError):
            fail("Could not read package.json for the manifest compatibility check.")
            return False

        engine_spec = (data.get("engines") or {}).get("vscode")
        types_spec = _types_vscode_spec(data)
        # Nothing for vsce to reject when either side of the contract is absent.
        if not engine_spec or not types_spec:
            ok("Manifest compatibility — no @types/vscode / engines.vscode constraint")
            return True

        engine_v = _range_version(engine_spec)
        types_v = _range_version(types_spec)
        # Unparseable range — defer to vsce rather than block on a bad guess.
        if engine_v is None or types_v is None:
            ok("Manifest compatibility — version ranges not comparable")
            return True

        if types_v <= engine_v:
            ok(f"Manifest compatibility — @types/vscode {types_spec} <= engines.vscode {engine_spec}")
            return True

        decision = _handle_manifest_mismatch(engine_spec, types_spec)
        if decision == "ignore":
            warn("Continuing despite @types/vscode > engines.vscode; vsce packaging may fail.")
            return True
        if decision == "exit":
            fail("Manifest version mismatch; stopping before any release mutation.")
            return False
        # 'accept' (fix written) and 'retry' (manual edit) both re-read and re-check.
        info("Re-reading package.json…")

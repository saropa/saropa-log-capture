# -*- coding: utf-8 -*-
"""Dev environment checks (VS Code CLI, global npm packages, extensions).

VS Code CLI, global npm packages, and VS Code extensions are
developer conveniences — non-blocking warnings if unavailable,
but will auto-install if missing and the tools are reachable.
"""

import json
import os
import shutil
import sys

from modules.publish.constants import (
    C,
    REQUIRED_GLOBAL_NPM_PACKAGES,
    REQUIRED_VSCODE_EXTENSIONS,
)
from modules.publish.display import fail, fix, info, ok, warn
from modules.publish.utils import list_editor_extensions, run


def check_vscode_cli() -> bool:
    """Verify the 'code' CLI is available (non-blocking).

    The code CLI is needed for auto-installing .vsix files and
    VS Code extensions. If missing, the user can still install manually.
    """
    if not shutil.which("code"):
        warn("VS Code CLI (code) not found on PATH.")
        info(f"  Open VS Code > {C.YELLOW}Ctrl+Shift+P{C.RESET} > "
             f"'{C.WHITE}Shell Command: Install code command in PATH{C.RESET}'")
        return True  # non-blocking
    ok("VS Code CLI (code) available on PATH")
    return True


def _is_permission_error(stderr: str) -> bool:
    """True when npm failed because the global prefix isn't writable."""
    text = stderr or ""
    return "EACCES" in text or "EPERM" in text


def _short_error(stderr: str, max_lines: int = 4) -> str:
    """Trim npm's long stack traces to the first few meaningful lines."""
    lines = [ln for ln in (stderr or "").splitlines() if ln.strip()]
    return "\n".join(lines[:max_lines])


def _install_to_user_prefix(pkg: str):
    """Install `pkg` globally into ~/.npm-global and put its bin dir on PATH."""
    prefix = os.path.join(os.path.expanduser("~"), ".npm-global")
    warn(f"No write access to the global npm prefix; installing to {C.WHITE}{prefix}{C.RESET} instead.")
    result = run(["npm", "install", "-g", "--prefix", prefix, pkg], check=False)
    if result.returncode == 0:
        bin_dir = os.path.join(prefix, "bin")
        if bin_dir not in os.environ.get("PATH", "").split(os.pathsep):
            os.environ["PATH"] = os.environ.get("PATH", "") + os.pathsep + bin_dir
    return result


def check_global_npm_packages() -> bool:
    """Check and install required global npm packages.

    Parses `npm list -g --json` to find what's already installed,
    then auto-installs any missing packages from REQUIRED_GLOBAL_NPM_PACKAGES.
    """
    all_ok = True
    result = run(["npm", "list", "-g", "--depth=0", "--json"], check=False)

    # Parse the JSON output to see which packages are already installed.
    installed: set[str] = set()
    if result.returncode == 0:
        try:
            data = json.loads(result.stdout)
            installed = set(data.get("dependencies", {}).keys())
        except json.JSONDecodeError:
            pass

    # Packages from a previous permission-fallback live in ~/.npm-global,
    # which plain `npm list -g` doesn't see.
    user_prefix = os.path.join(os.path.expanduser("~"), ".npm-global")
    if os.path.isdir(user_prefix):
        extra = run(["npm", "list", "-g", "--depth=0", "--json", "--prefix", user_prefix], check=False)
        try:
            installed |= set(json.loads(extra.stdout).get("dependencies", {}).keys())
        except (json.JSONDecodeError, AttributeError):
            pass

    for pkg in REQUIRED_GLOBAL_NPM_PACKAGES:
        if pkg in installed:
            ok(f"npm global: {C.WHITE}{pkg}{C.RESET}")
        else:
            fix(f"Installing global npm package: {C.WHITE}{pkg}{C.RESET}")
            install_result = run(
                ["npm", "install", "-g", pkg], check=False,
            )
            if install_result.returncode != 0 and _is_permission_error(install_result.stderr):
                # System prefix (e.g. /usr/local) isn't writable. Rather than
                # requiring sudo, install into a user-owned prefix.
                install_result = _install_to_user_prefix(pkg)
            if install_result.returncode != 0:
                fail(f"Failed to install {pkg}: "
                     f"{_short_error(install_result.stderr)}")
                info(f"  Install manually: {C.YELLOW}npm install -g {pkg}{C.RESET}")
                all_ok = False
            else:
                ok(f"Installed: {C.WHITE}{pkg}{C.RESET}")
    return all_ok


def check_vscode_extensions() -> bool:
    """Check and install required VS Code extensions.

    Skips silently if the 'code' CLI isn't available. Uses the cached
    extension list to avoid spawning extra VS Code windows on Windows.
    """
    if not shutil.which("code"):
        warn("Skipping VS Code extension check — 'code' CLI not available.")
        return True

    # Cached — reuses the same CLI call as get_installed_extension_versions()
    ext_lines = list_editor_extensions("code")
    # Lines are 'publisher.name@version'; extract IDs
    installed = {line.split("@")[0] for line in ext_lines}

    all_ok = True
    for ext in REQUIRED_VSCODE_EXTENSIONS:
        if ext.lower() in installed:
            ok(f"VS Code extension: {C.WHITE}{ext}{C.RESET}")
        else:
            fix(f"Installing VS Code extension: {C.WHITE}{ext}{C.RESET}")
            if sys.platform == "win32":
                info("A VS Code window may briefly appear...")
            install_result = run(
                ["code", "--install-extension", ext], check=False,
            )
            if install_result.returncode != 0:
                fail(f"Failed to install {ext}: "
                     f"{install_result.stderr.strip()}")
                all_ok = False
            else:
                ok(f"Installed: {C.WHITE}{ext}{C.RESET}")
    return all_ok

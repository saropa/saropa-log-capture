# -*- coding: utf-8 -*-
"""Shell execution, version reading, and timing helpers."""

import json
import os
import re
import subprocess
import sys
import time

from modules.constants import MARKETPLACE_EXTENSION_ID, PROJECT_ROOT


def run(cmd: list[str], **kwargs) -> subprocess.CompletedProcess[str]:
    """Run a shell command and return the result.

    shell=True is needed on Windows so that npm/npx/.cmd scripts resolve
    via PATH through cmd.exe. On macOS/Linux, shell=False is safer and
    avoids quoting issues. stdin=DEVNULL prevents commands from waiting
    for user input (which would hang the script).
    """
    # On Windows, CREATE_NO_WINDOW prevents cmd.exe console windows from
    # flashing when shell=True invokes .cmd batch files.
    if sys.platform == "win32" and "creationflags" not in kwargs:
        kwargs["creationflags"] = subprocess.CREATE_NO_WINDOW
    return subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        # Explicit UTF-8 avoids Windows defaulting to cp1252,
        # which garbles Mocha's ✓/✗ and other Unicode output.
        encoding="utf-8",
        errors="replace",
        # Windows needs shell=True because npm/npx are .cmd batch files
        # that only resolve through cmd.exe's PATH lookup.
        shell=(sys.platform == "win32"),
        # Prevent commands from waiting for stdin input.
        stdin=subprocess.DEVNULL,
        **kwargs,
    )


def get_ovsx_pat() -> str:
    """Return OVSX_PAT from environment or from project .env file.

    So the token works when the script is run from the IDE (no shell env).
    .env is in .gitignore; use one line: OVSX_PAT=your-token
    """
    pat = os.environ.get("OVSX_PAT", "").strip()
    if pat:
        return pat
    env_path = os.path.join(PROJECT_ROOT, ".env")
    try:
        with open(env_path, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line.startswith("OVSX_PAT="):
                    value = line.split("=", 1)[1].strip().strip('"').strip("'")
                    return value
    except OSError:
        pass
    return ""


# Cached extension sets keyed by editor name ("code", "cursor").
_extensions_cache: dict[str, set[str]] = {}

# Map editor CLI name to its extensions directory (relative to $HOME).
_EDITOR_EXT_DIRS = {
    "code": os.path.join(".vscode", "extensions"),
    "cursor": os.path.join(".cursor", "extensions"),
}

# Matches the semver version suffix in extension folder names,
# e.g. "connor4312.esbuild-problem-matchers-0.0.4" → version "0.0.4".
_VERSION_RE = re.compile(r"-(\d+\.\d+\.\d+.*)$")


def list_editor_extensions(editor: str = "code") -> set[str]:
    """Return cached set of lowercase extension lines for the editor.

    Each line looks like 'publisher.name@version'. Reads from the
    editor's extensions directory on disk instead of calling the CLI,
    which avoids spawning editor windows on Windows.
    """
    if editor in _extensions_cache:
        return _extensions_cache[editor]

    rel_dir = _EDITOR_EXT_DIRS.get(editor)
    if not rel_dir:
        _extensions_cache[editor] = set()
        return set()

    ext_dir = os.path.join(os.path.expanduser("~"), rel_dir)
    if not os.path.isdir(ext_dir):
        _extensions_cache[editor] = set()
        return set()

    extensions: set[str] = set()
    try:
        for entry in os.scandir(ext_dir):
            if not entry.is_dir():
                continue
            m = _VERSION_RE.search(entry.name)
            if m:
                name = entry.name[:m.start()]
                version = m.group(1)
                extensions.add(f"{name.lower()}@{version.lower()}")
    except OSError:
        pass

    _extensions_cache[editor] = extensions
    return extensions


def get_installed_extension_versions(
    extension_id: str = MARKETPLACE_EXTENSION_ID,
) -> dict[str, str]:
    """Return installed version per editor: {"vscode": "2.0.15", "cursor": "2.0.14"}.

    Uses cached filesystem scan so each editor is checked at most once.
    Only includes editors where the extension is installed. Empty dict = not installed.
    """
    out: dict[str, str] = {}
    prefix = f"{extension_id.lower()}@"
    for editor in ("code", "cursor"):
        for line in list_editor_extensions(editor):
            if line.startswith(prefix):
                version = line[len(prefix):].strip()
                if version:
                    out[editor] = version
                break
    return out


def read_package_version() -> str:
    """Read the extension version from package.json.

    Returns "unknown" if the file can't be read or parsed, so callers
    can still display a banner before failing more specifically.
    """
    pkg_path = os.path.join(PROJECT_ROOT, "package.json")
    try:
        with open(pkg_path, encoding="utf-8") as f:
            data = json.load(f)
        return data.get("version", "unknown")
    except (OSError, json.JSONDecodeError):
        return "unknown"


def elapsed_str(seconds: float) -> str:
    """Format elapsed seconds as a human-readable string.

    Sub-second durations are shown in milliseconds for readability.
    """
    if seconds < 1:
        return f"{seconds * 1000:.0f}ms"
    return f"{seconds:.1f}s"


def run_step(
    name: str,
    fn: object,
    results: list[tuple[str, bool, float]],
) -> bool:
    """Time and record a single pipeline step.

    Wraps any step function with timing. The (name, passed, elapsed) tuple
    is appended to the results list for the timing chart and report.
    """
    t0 = time.time()
    passed = fn()  # type: ignore[operator]
    elapsed = time.time() - t0
    results.append((name, passed, elapsed))
    return passed

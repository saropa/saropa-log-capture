# -*- coding: utf-8 -*-
"""Shell execution, version reading, and timing helpers."""

import json
import os
import subprocess
import sys
import time

from modules.constants import PROJECT_ROOT


def run(cmd: list[str], **kwargs) -> subprocess.CompletedProcess[str]:
    """Run a shell command and return the result.

    shell=True is needed on Windows so that npm/npx/.cmd scripts resolve
    via PATH through cmd.exe. On macOS/Linux, shell=False is safer and
    avoids quoting issues.
    """
    return subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        # Windows needs shell=True because npm/npx are .cmd batch files
        # that only resolve through cmd.exe's PATH lookup.
        shell=(sys.platform == "win32"),
        **kwargs,
    )


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

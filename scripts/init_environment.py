"""
Saropa Log Capture — Development Environment Setup

Checks that all required tools and dependencies are installed,
installs anything missing, then verifies the setup compiles cleanly.

Usage:
    python scripts/init_environment.py
"""

import subprocess
import sys
import os
import shutil

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)

# cspell:ignore connor4312 dbaeumer

# VS Code extensions required for development.
REQUIRED_VSCODE_EXTENSIONS = [
    "connor4312.esbuild-problem-matchers",
    "dbaeumer.vscode-eslint",
    "ms-vscode.extension-test-runner",
]

# Global npm packages required for scaffolding/publishing.
REQUIRED_GLOBAL_NPM_PACKAGES = [
    "yo",
    "generator-code",
]


def run(cmd: list[str], **kwargs) -> subprocess.CompletedProcess[str]:
    """Run a command and return the result."""
    return subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        shell=(sys.platform == "win32"),
        **kwargs,
    )


def heading(text: str) -> None:
    print(f"\n{'='*60}")
    print(f"  {text}")
    print(f"{'='*60}")


def ok(text: str) -> None:
    print(f"  [OK]   {text}")


def fix(text: str) -> None:
    print(f"  [FIX]  {text}")


def fail(text: str) -> None:
    print(f"  [FAIL] {text}")


def warn(text: str) -> None:
    print(f"  [WARN] {text}")


# ── Checks ───────────────────────────────────────────────────


def check_node() -> bool:
    """Verify Node.js is installed (>= 18)."""
    result = run(["node", "--version"], check=False)
    if result.returncode != 0:
        fail("Node.js is not installed. Install from https://nodejs.org/")
        return False
    version = result.stdout.strip().lstrip("v")
    major = int(version.split(".")[0])
    if major < 18:
        fail(f"Node.js {version} found — version 18+ required.")
        return False
    ok(f"Node.js {version}")
    return True


def check_npm() -> bool:
    """Verify npm is installed."""
    result = run(["npm", "--version"], check=False)
    if result.returncode != 0:
        fail("npm is not installed. It ships with Node.js — reinstall Node.")
        return False
    ok(f"npm {result.stdout.strip()}")
    return True


def check_git() -> bool:
    """Verify git is installed."""
    result = run(["git", "--version"], check=False)
    if result.returncode != 0:
        fail("git is not installed. Install from https://git-scm.com/")
        return False
    ok(f"git — {result.stdout.strip()}")
    return True


def check_gh_cli() -> bool:
    """Verify GitHub CLI is installed and authenticated."""
    if not shutil.which("gh"):
        warn("GitHub CLI (gh) is not installed. Optional but recommended.")
        warn("  Install from https://cli.github.com/")
        return True  # non-blocking

    result = run(["gh", "auth", "status"], check=False)
    if result.returncode != 0:
        warn("GitHub CLI installed but not authenticated. Run: gh auth login")
    else:
        ok("GitHub CLI — authenticated")
    return True


def check_vscode_cli() -> bool:
    """Verify the 'code' CLI is available."""
    if not shutil.which("code"):
        warn("VS Code CLI (code) not found on PATH.")
        warn("  Open VS Code -> Ctrl+Shift+P -> 'Install code command in PATH'")
        return True  # non-blocking
    ok("VS Code CLI (code) available on PATH")
    return True


def check_global_npm_packages() -> bool:
    """Check and install required global npm packages."""
    all_ok = True
    result = run(["npm", "list", "-g", "--depth=0", "--json"], check=False)

    installed: set[str] = set()
    if result.returncode == 0:
        import json
        try:
            data = json.loads(result.stdout)
            installed = set(data.get("dependencies", {}).keys())
        except json.JSONDecodeError:
            pass

    for pkg in REQUIRED_GLOBAL_NPM_PACKAGES:
        if pkg in installed:
            ok(f"npm global: {pkg}")
        else:
            fix(f"Installing global npm package: {pkg}")
            install_result = run(["npm", "install", "-g", pkg], check=False)
            if install_result.returncode != 0:
                fail(f"Failed to install {pkg}: {install_result.stderr.strip()}")
                all_ok = False
            else:
                ok(f"Installed: {pkg}")
    return all_ok


def check_vscode_extensions() -> bool:
    """Check and install required VS Code extensions."""
    if not shutil.which("code"):
        warn("Skipping VS Code extension check — 'code' CLI not available.")
        return True

    result = run(["code", "--list-extensions"], check=False)
    if result.returncode != 0:
        warn("Could not list VS Code extensions.")
        return True

    installed = set(result.stdout.strip().lower().splitlines())

    all_ok = True
    for ext in REQUIRED_VSCODE_EXTENSIONS:
        if ext.lower() in installed:
            ok(f"VS Code extension: {ext}")
        else:
            fix(f"Installing VS Code extension: {ext}")
            install_result = run(
                ["code", "--install-extension", ext], check=False
            )
            if install_result.returncode != 0:
                fail(f"Failed to install {ext}: {install_result.stderr.strip()}")
                all_ok = False
            else:
                ok(f"Installed: {ext}")
    return all_ok


def check_node_modules() -> bool:
    """Check and install project npm dependencies."""
    node_modules = os.path.join(PROJECT_ROOT, "node_modules")
    package_json = os.path.join(PROJECT_ROOT, "package.json")

    if not os.path.isfile(package_json):
        fail("package.json not found at project root.")
        return False

    if os.path.isdir(node_modules):
        ok("node_modules/ exists")
    else:
        fix("Running npm install...")
        result = run(["npm", "install"], cwd=PROJECT_ROOT, check=False)
        if result.returncode != 0:
            fail(f"npm install failed:\n{result.stderr.strip()}")
            return False
        ok("npm install completed")
    return True


def verify_compile() -> bool:
    """Run the full compile (type-check + lint + esbuild) and verify success."""
    result = run(["npm", "run", "compile"], cwd=PROJECT_ROOT, check=False)
    if result.returncode != 0:
        fail("Compile failed:")
        if result.stdout.strip():
            print(result.stdout)
        if result.stderr.strip():
            print(result.stderr)
        return False
    ok("npm run compile — passed (type-check + lint + esbuild)")
    return True


# Maximum lines allowed per TypeScript source file (from CLAUDE.md).
MAX_FILE_LINES = 300


def check_file_line_limits() -> bool:
    """Enforce the 300-line hard limit on all TypeScript files in src/.

    The project's quality standards require every file to be at most 300
    lines.  This check catches violations early so they can be fixed
    before committing.
    """
    src_dir = os.path.join(PROJECT_ROOT, "src")
    violations: list[str] = []

    for dirpath, _dirs, filenames in os.walk(src_dir):
        for fname in filenames:
            if not fname.endswith(".ts"):
                continue
            filepath = os.path.join(dirpath, fname)
            with open(filepath, encoding="utf-8") as f:
                count = sum(1 for _ in f)
            if count > MAX_FILE_LINES:
                rel = os.path.relpath(filepath, PROJECT_ROOT)
                violations.append(f"{rel} ({count} lines)")

    if violations:
        fail(f"{len(violations)} file(s) exceed {MAX_FILE_LINES}-line limit:")
        for v in violations:
            print(f"         {v}")
        return False
    ok(f"All .ts files are within the {MAX_FILE_LINES}-line limit")
    return True


# ── Main ─────────────────────────────────────────────────────


def main() -> int:
    print("Saropa Log Capture — Development Environment Setup")
    print(f"Project root: {PROJECT_ROOT}")

    errors = 0

    heading("Prerequisites")
    if not check_node():
        errors += 1
    if not check_npm():
        errors += 1
    if not check_git():
        errors += 1
    check_gh_cli()
    check_vscode_cli()

    if errors > 0:
        fail(f"\n{errors} prerequisite(s) missing. Fix the above and re-run.")
        return 1

    heading("Global npm Packages")
    if not check_global_npm_packages():
        errors += 1

    heading("VS Code Extensions")
    if not check_vscode_extensions():
        errors += 1

    heading("Project Dependencies")
    if not check_node_modules():
        errors += 1

    if errors > 0:
        fail(f"\n{errors} step(s) failed. Fix the above and re-run.")
        return 1

    heading("Verify Compile")
    if not verify_compile():
        return 1

    heading("Quality Checks")
    if not check_file_line_limits():
        errors += 1

    if errors > 0:
        fail(f"\n{errors} quality check(s) failed. Fix the above and re-run.")
        return 1

    heading("Done")
    ok("Environment is ready. Press F5 to launch the Extension Development Host.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

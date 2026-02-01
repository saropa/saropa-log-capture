#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# ##############################################################################
# Saropa Log Capture — Developer Toolkit
# ##############################################################################
#
# .SYNOPSIS
#   One-click setup, build, and install for the Saropa Log Capture extension.
#
# .DESCRIPTION
#   Runs the full pipeline automatically:
#     prerequisites → global npm → VS Code extensions → project deps →
#     compile → quality checks → package .vsix → report → offer install.
#   Each step is timed. A summary report is always saved to reports/.
#   Interactive prompts only appear at the end (install, open report).
#
# .NOTES
#   Version:      2.1.0
#   Requires:     Python 3.10+
#                 Optional: colorama (`pip install colorama`) for colored output.
#
# .USAGE
#   python scripts/dev.py
#
# ##############################################################################

import argparse
import datetime
import glob
import json
import os
import shutil
import subprocess
import sys
import time

# Resolve paths relative to this script so it works from any working directory.
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

# Maximum lines allowed per TypeScript source file (from CLAUDE.md).
MAX_FILE_LINES = 300


# ── Color Setup ──────────────────────────────────────────────
# Uses ANSI escape codes directly. colorama is optional on Windows
# to ensure the terminal interprets escape sequences correctly.


class _AnsiColors:
    """ANSI 256-color escape codes for terminal output."""
    RESET: str = "\033[0m"
    BOLD: str = "\033[1m"
    DIM: str = "\033[2m"
    GREEN: str = "\033[92m"
    YELLOW: str = "\033[93m"
    RED: str = "\033[91m"
    BLUE: str = "\033[94m"
    CYAN: str = "\033[96m"
    MAGENTA: str = "\033[95m"
    WHITE: str = "\033[97m"
    # Extended 256-color palette for the Saropa logo gradient.
    ORANGE_208: str = "\033[38;5;208m"
    ORANGE_209: str = "\033[38;5;209m"
    YELLOW_215: str = "\033[38;5;215m"
    YELLOW_220: str = "\033[38;5;220m"
    YELLOW_226: str = "\033[38;5;226m"
    GREEN_190: str = "\033[38;5;190m"
    GREEN_154: str = "\033[38;5;154m"
    GREEN_118: str = "\033[38;5;118m"
    CYAN_123: str = "\033[38;5;123m"
    CYAN_87: str = "\033[38;5;87m"
    BLUE_51: str = "\033[38;5;51m"
    BLUE_45: str = "\033[38;5;45m"
    BLUE_39: str = "\033[38;5;39m"
    BLUE_33: str = "\033[38;5;33m"
    BLUE_57: str = "\033[38;5;57m"
    PINK_195: str = "\033[38;5;195m"
    LIGHT_BLUE_117: str = "\033[38;5;117m"


class _FallbackColors:
    """No-op color strings for terminals that don't support ANSI codes."""
    RESET = BOLD = DIM = ""
    GREEN = YELLOW = RED = BLUE = CYAN = MAGENTA = WHITE = ""
    ORANGE_208 = ORANGE_209 = ""
    YELLOW_215 = YELLOW_220 = YELLOW_226 = ""
    GREEN_190 = GREEN_154 = GREEN_118 = ""
    CYAN_123 = CYAN_87 = ""
    BLUE_51 = BLUE_45 = BLUE_39 = BLUE_33 = BLUE_57 = ""
    PINK_195 = LIGHT_BLUE_117 = ""


# Try to initialise colorama for Windows compatibility; fall back gracefully.
try:
    import colorama
    colorama.init(autoreset=True)
    C = _AnsiColors
except ImportError:
    # colorama is optional — ANSI codes still work on most modern terminals.
    C = _FallbackColors


# ── Display Helpers ──────────────────────────────────────────

def heading(text: str) -> None:
    """Print a bold section heading."""
    bar = "=" * 60
    print(f"\n{C.CYAN}{bar}{C.RESET}")
    print(f"  {C.BOLD}{C.WHITE}{text}{C.RESET}")
    print(f"{C.CYAN}{bar}{C.RESET}")


def ok(text: str) -> None:
    print(f"  {C.GREEN}[OK]{C.RESET}   {text}")


def fix(text: str) -> None:
    """An issue was found and automatically repaired."""
    print(f"  {C.MAGENTA}[FIX]{C.RESET}  {text}")


def fail(text: str) -> None:
    print(f"  {C.RED}[FAIL]{C.RESET} {text}")


def warn(text: str) -> None:
    print(f"  {C.YELLOW}[WARN]{C.RESET} {text}")


def info(text: str) -> None:
    print(f"  {C.BLUE}[INFO]{C.RESET} {text}")


def dim(text: str) -> str:
    """Wrap text in dim ANSI codes for secondary information."""
    return f"{C.DIM}{text}{C.RESET}"


def ask_yn(question: str, default: bool = True) -> bool:
    """Prompt the user with a yes/no question. Returns the boolean answer.

    Handles EOF and Ctrl+C gracefully by returning the default.
    """
    hint = "Y/n" if default else "y/N"
    try:
        answer = input(
            f"  {C.YELLOW}{question} [{hint}]: {C.RESET}",
        ).strip().lower()
    except (EOFError, KeyboardInterrupt):
        print()
        return default
    if not answer:
        return default
    return answer in ("y", "yes")


# cSpell:disable
def show_logo(version: str) -> None:
    """Print the Saropa rainbow-gradient logo and script version."""
    logo = f"""
{C.ORANGE_208}                               ....{C.RESET}
{C.ORANGE_208}                       `-+shdmNMMMMNmdhs+-{C.RESET}
{C.ORANGE_209}                    -odMMMNyo/-..````.++:+o+/-{C.RESET}
{C.YELLOW_215}                 `/dMMMMMM/`            ````````{C.RESET}
{C.YELLOW_220}                `dMMMMMMMMNdhhhdddmmmNmmddhs+-{C.RESET}
{C.YELLOW_226}                QMMMMMMMMMMMMMMMMMMMMMMMMMMMMMNhs{C.RESET}
{C.GREEN_190}              . :sdmNNNNMMMMMNNNMMMMMMMMMMMMMMMMm+{C.RESET}
{C.GREEN_154}              o     `..~~~::~+==+~:/+sdNMMMMMMMMMMMo{C.RESET}
{C.GREEN_118}              m                        .+NMMMMMMMMMN{C.RESET}
{C.CYAN_123}              m+                         :MMMMMMMMMm{C.RESET}
{C.CYAN_87}              qN:                        :MMMMMMMMMF{C.RESET}
{C.BLUE_51}               oNs.                    `+NMMMMMMMMo{C.RESET}
{C.BLUE_45}                :dNy\\.              ./smMMMMMMMMm:{C.RESET}
{C.BLUE_39}                 `TdMNmhyso+++oosydNNMMMMMMMMMdP+{C.RESET}
{C.BLUE_33}                    .odMMMMMMMMMMMMMMMMMMMMdo-{C.RESET}
{C.BLUE_57}                       `-+shdNNMMMMNNdhs+-{C.RESET}
{C.BLUE_57}                               ````{C.RESET}

  {C.PINK_195}Saropa Log Capture — Developer Toolkit{C.RESET}
  {C.LIGHT_BLUE_117}Extension v{version}{C.RESET}
"""
    print(logo)
    print(f"{C.CYAN}{'-' * 60}{C.RESET}")
# cSpell:enable


# ── Utilities ────────────────────────────────────────────────

def run(cmd: list[str], **kwargs) -> subprocess.CompletedProcess[str]:
    """Run a shell command and return the result.

    shell=True is needed on Windows so that npm/npx resolve via PATH.
    """
    return subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        shell=(sys.platform == "win32"),
        **kwargs,
    )


def read_package_version() -> str:
    """Read the extension version from package.json."""
    pkg_path = os.path.join(PROJECT_ROOT, "package.json")
    try:
        with open(pkg_path, encoding="utf-8") as f:
            data = json.load(f)
        return data.get("version", "unknown")
    except (OSError, json.JSONDecodeError):
        return "unknown"


def elapsed_str(seconds: float) -> str:
    """Format elapsed seconds as a human-readable string."""
    if seconds < 1:
        return f"{seconds * 1000:.0f}ms"
    return f"{seconds:.1f}s"


def run_step(
    name: str,
    fn: object,
    results: list[tuple[str, bool, float]],
) -> bool:
    """Time and record a single step. Returns its pass/fail status."""
    t0 = time.time()
    passed = fn()  # type: ignore[operator]
    elapsed = time.time() - t0
    results.append((name, passed, elapsed))
    return passed


# ── Setup Checks ─────────────────────────────────────────────
# Each check returns True on success, False on blocking failure.
# Some checks are non-blocking (return True with a warning).


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
    ok(f"Node.js {C.WHITE}{version}{C.RESET}")
    return True


def check_npm() -> bool:
    """Verify npm is installed."""
    result = run(["npm", "--version"], check=False)
    if result.returncode != 0:
        fail("npm is not installed. It ships with Node.js — reinstall Node.")
        return False
    ok(f"npm {C.WHITE}{result.stdout.strip()}{C.RESET}")
    return True


def check_git() -> bool:
    """Verify git is installed."""
    result = run(["git", "--version"], check=False)
    if result.returncode != 0:
        fail("git is not installed. Install from https://git-scm.com/")
        return False
    ok(f"git — {C.WHITE}{result.stdout.strip()}{C.RESET}")
    return True


def check_gh_cli() -> bool:
    """Verify GitHub CLI is installed and authenticated (non-blocking)."""
    if not shutil.which("gh"):
        warn("GitHub CLI (gh) is not installed. Optional but recommended.")
        info(f"  Install from {C.WHITE}https://cli.github.com/{C.RESET}")
        return True  # non-blocking

    try:
        result = run(["gh", "auth", "status"], check=False, timeout=10)
    except subprocess.TimeoutExpired:
        warn("GitHub CLI auth check timed out — skipping.")
        return True
    if result.returncode != 0:
        warn(f"GitHub CLI installed but not authenticated. "
             f"Run: {C.YELLOW}gh auth login{C.RESET}")
    else:
        ok("GitHub CLI — authenticated")
    return True


def check_vscode_cli() -> bool:
    """Verify the 'code' CLI is available (non-blocking)."""
    if not shutil.which("code"):
        warn("VS Code CLI (code) not found on PATH.")
        info(f"  Open VS Code → {C.YELLOW}Ctrl+Shift+P{C.RESET} → "
             f"'{C.WHITE}Shell Command: Install code command in PATH{C.RESET}'")
        return True  # non-blocking
    ok("VS Code CLI (code) available on PATH")
    return True


def check_global_npm_packages() -> bool:
    """Check and install required global npm packages."""
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

    for pkg in REQUIRED_GLOBAL_NPM_PACKAGES:
        if pkg in installed:
            ok(f"npm global: {C.WHITE}{pkg}{C.RESET}")
        else:
            fix(f"Installing global npm package: {C.WHITE}{pkg}{C.RESET}")
            install_result = run(
                ["npm", "install", "-g", pkg], check=False,
            )
            if install_result.returncode != 0:
                fail(f"Failed to install {pkg}: {install_result.stderr.strip()}")
                all_ok = False
            else:
                ok(f"Installed: {C.WHITE}{pkg}{C.RESET}")
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
            ok(f"VS Code extension: {C.WHITE}{ext}{C.RESET}")
        else:
            fix(f"Installing VS Code extension: {C.WHITE}{ext}{C.RESET}")
            install_result = run(
                ["code", "--install-extension", ext], check=False,
            )
            if install_result.returncode != 0:
                fail(f"Failed to install {ext}: {install_result.stderr.strip()}")
                all_ok = False
            else:
                ok(f"Installed: {C.WHITE}{ext}{C.RESET}")
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


def check_file_line_limits() -> bool:
    """Enforce the 300-line hard limit on all TypeScript files in src/."""
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
            print(f"         {C.RED}{v}{C.RESET}")
        return False
    ok(f"All .ts files are within the {MAX_FILE_LINES}-line limit")
    return True


# ── Build Steps ──────────────────────────────────────────────


def update_changelog(new_version: str) -> bool:
    """Update CHANGELOG.md: convert [Unreleased] to versioned release."""
    changelog_path = os.path.join(PROJECT_ROOT, "CHANGELOG.md")

    try:
        with open(changelog_path, encoding="utf-8") as f:
            lines = f.readlines()
    except OSError:
        warn("Could not read CHANGELOG.md")
        return False

    # Find the [Unreleased] line
    unreleased_idx = -1
    for i, line in enumerate(lines):
        if line.strip() == "## [Unreleased]":
            unreleased_idx = i
            break

    if unreleased_idx == -1:
        warn("No [Unreleased] section found in CHANGELOG.md")
        return False

    # Replace [Unreleased] with [version] - date
    today = datetime.datetime.now().strftime("%Y-%m-%d")
    lines[unreleased_idx] = f"## [{new_version}] - {today}\n"

    # Insert new [Unreleased] section at the top
    # Find where to insert (after the intro paragraph)
    insert_idx = unreleased_idx
    for i in range(len(lines)):
        if lines[i].startswith("## "):
            insert_idx = i
            break

    # Add new unreleased section
    new_section = [
        "## [Unreleased]\n",
        "\n",
    ]
    lines[insert_idx:insert_idx] = new_section

    try:
        with open(changelog_path, "w", encoding="utf-8") as f:
            f.writelines(lines)
    except OSError:
        warn("Could not write CHANGELOG.md")
        return False

    ok(f"CHANGELOG.md updated: [Unreleased] → [{new_version}]")
    return True


def bump_patch_version() -> str | None:
    """Increment the patch version in package.json. Returns new version."""
    pkg_path = os.path.join(PROJECT_ROOT, "package.json")
    try:
        with open(pkg_path, encoding="utf-8") as f:
            data = json.load(f)
    except (OSError, json.JSONDecodeError):
        fail("Could not read package.json")
        return None

    old_version = data.get("version", "0.0.0")
    parts = old_version.split(".")
    if len(parts) != 3:
        fail(f"Unexpected version format: {old_version}")
        return None

    try:
        major, minor, patch = int(parts[0]), int(parts[1]), int(parts[2])
    except ValueError:
        fail(f"Non-numeric version parts: {old_version}")
        return None

    new_version = f"{major}.{minor}.{patch + 1}"
    data["version"] = new_version

    try:
        with open(pkg_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
            f.write("\n")
    except OSError:
        fail("Could not write package.json")
        return None

    fix(f"package.json: {C.WHITE}{old_version}{C.RESET} → {C.WHITE}{new_version}{C.RESET}")

    # Update CHANGELOG.md
    update_changelog(new_version)

    return new_version


def step_compile() -> bool:
    """Run the full compile: type-check + lint + esbuild bundle."""
    info("Running npm run compile...")
    result = run(["npm", "run", "compile"], cwd=PROJECT_ROOT, check=False)
    if result.returncode != 0:
        fail("Compile failed:")
        if result.stdout.strip():
            print(result.stdout)
        if result.stderr.strip():
            print(result.stderr)
        return False
    ok("Compile passed (type-check + lint + esbuild)")
    return True


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


# ── Install ──────────────────────────────────────────────────

def print_install_instructions(vsix_path: str) -> None:
    """Print coloured instructions for installing the .vsix in VS Code."""
    vsix_name = os.path.basename(vsix_path)
    abs_path = os.path.abspath(vsix_path)

    heading("Install Instructions")

    opt = f"{C.BOLD}{C.CYAN}"
    key = f"{C.YELLOW}"
    rst = C.RESET

    print(f"""
  {opt}Option 1 — Command Palette (recommended):{rst}

    1. Open VS Code
    2. Press  {key}Ctrl+Shift+P{rst}  (macOS: {key}Cmd+Shift+P{rst})
    3. Type:  {key}Extensions: Install from VSIX...{rst}
    4. Browse to:
       {C.WHITE}{abs_path}{rst}
    5. Click {key}"Install"{rst}
    6. Reload VS Code when prompted

  {opt}Option 2 — Command line:{rst}

    {C.WHITE}code --install-extension {vsix_name}{rst}

  {opt}Option 3 — Drag and drop:{rst}

    1. Open VS Code
    2. Open the Extensions sidebar  ({key}Ctrl+Shift+X{rst})
    3. Drag the .vsix file into the Extensions sidebar

  {opt}After installing:{rst}

    - Start any debug session ({key}F5{rst}) — capture begins automatically
    - Open the Saropa Log Capture panel to view live output
    - Press {key}Ctrl+Shift+P{rst} and type {key}"Saropa"{rst} to see all commands
""")


def prompt_install(vsix_path: str) -> None:
    """Ask the user whether to install the .vsix via the code CLI."""
    if not shutil.which("code"):
        warn("VS Code CLI (code) not found on PATH — cannot auto-install.")
        info("Add it via: VS Code → Ctrl+Shift+P → "
             "'Shell Command: Install code command in PATH'")
        return

    if not ask_yn("Install via CLI now?", default=False):
        return

    vsix_name = os.path.basename(vsix_path)
    info(f"Running: code --install-extension {vsix_name}")
    result = run(
        ["code", "--install-extension", os.path.abspath(vsix_path)],
    )
    if result.returncode != 0:
        fail(f"Install failed: {result.stderr.strip()}")
        return
    ok("Extension installed successfully!")
    info("Reload VS Code to activate the updated extension.")


def prompt_open_report(report_path: str) -> None:
    """Ask the user whether to open the build report."""
    if not ask_yn("Open build report?", default=False):
        return

    # cspell:ignore startfile
    abs_path = os.path.abspath(report_path)
    if sys.platform == "win32":
        os.startfile(abs_path)  # type: ignore[attr-defined]
    elif sys.platform == "darwin":
        subprocess.Popen(["open", abs_path])
    else:
        subprocess.Popen(["xdg-open", abs_path])


# ── Report ───────────────────────────────────────────────────

def save_report(
    results: list[tuple[str, bool, float]],
    version: str,
    vsix_path: str | None = None,
) -> str | None:
    """Save a summary report to reports/. Returns the report path."""
    reports_dir = os.path.join(PROJECT_ROOT, "reports")
    os.makedirs(reports_dir, exist_ok=True)

    ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    
    report_path = os.path.join(reports_dir, f"{ts}_dev_report.log")

    total_time = sum(t for _, _, t in results)
    passed = sum(1 for _, p, _ in results if p)
    failed = len(results) - passed

    lines = [
        "Saropa Log Capture — Dev Report",
        f"Generated: {datetime.datetime.now().isoformat()}",
        f"Extension version: {version}",
        "",
        f"Results: {passed} passed, {failed} failed",
        f"Total time: {elapsed_str(total_time)}",
    ]

    if vsix_path and os.path.isfile(vsix_path):
        vsix_size = os.path.getsize(vsix_path) / 1024
        lines.append(f"VSIX file: {os.path.basename(vsix_path)}")
        lines.append(f"VSIX size: {vsix_size:.1f} KB")
        lines.append(f"VSIX path: {os.path.abspath(vsix_path)}")

    lines.append("")
    lines.append("Step Details:")
    for name, ok_flag, secs in results:
        status = "PASS" if ok_flag else "FAIL"
        lines.append(f"  [{status}] {name:<25s} {elapsed_str(secs):>8s}")

    with open(report_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")

    return report_path


def print_timing(results: list[tuple[str, bool, float]]) -> None:
    """Print a coloured timing bar chart for all recorded steps."""
    total = sum(t for _, _, t in results)
    heading("Timing")
    for name, passed, secs in results:
        icon = f"{C.GREEN}✓{C.RESET}" if passed else f"{C.RED}✗{C.RESET}"
        bar_len = int(min(secs / max(total, 0.001) * 30, 30))
        bar = f"{C.GREEN}{'█' * bar_len}{C.RESET}" if bar_len else ""
        print(f"  {icon} {name:<25s} {elapsed_str(secs):>8s}  {bar}")
    print(f"  {'─' * 45}")
    print(f"    {'Total':<23s} {C.BOLD}{elapsed_str(total)}{C.RESET}")


# ── CLI ──────────────────────────────────────────────────────

def parse_args() -> argparse.Namespace:
    """Parse command-line arguments (all optional — for CI automation)."""
    parser = argparse.ArgumentParser(
        description="Saropa Log Capture — one-click setup, build, and install.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Runs the full pipeline by default. Flags are for CI automation only:

  python scripts/dev.py                        # full pipeline
  python scripts/dev.py --skip-compile         # skip compile step
  python scripts/dev.py --auto-install         # install without prompting
        """,
    )
    parser.add_argument("--skip-compile", action="store_true",
                        help="Skip the compile step.")
    parser.add_argument("--skip-extensions", action="store_true",
                        help="Skip VS Code extension checks.")
    parser.add_argument("--skip-global-npm", action="store_true",
                        help="Skip global npm package checks.")
    parser.add_argument("--auto-install", action="store_true",
                        help="Auto-install .vsix without prompting.")
    parser.add_argument("--no-logo", action="store_true",
                        help="Suppress the Saropa ASCII art logo.")
    return parser.parse_args()


# ── Main ─────────────────────────────────────────────────────
# Full pipeline: setup → build → report → interactive prompts.
# Exits with code 0 on success, 1 on any failure.


def main() -> int:
    args = parse_args()
    version = read_package_version()
    results: list[tuple[str, bool, float]] = []
    errors = 0

    # -- Banner --
    if not args.no_logo:
        show_logo(version)
    else:
        print(f"\n  {C.BOLD}Saropa Log Capture — Developer Toolkit{C.RESET}"
              f"  {dim(f'v{version}')}")
    print(f"  Project root: {dim(PROJECT_ROOT)}")

    # ── SETUP ────────────────────────────────────────────────

    # -- Prerequisites (blocking) --
    heading("Prerequisites")
    if not run_step("Node.js", check_node, results):
        errors += 1
    if not run_step("npm", check_npm, results):
        errors += 1
    if not run_step("git", check_git, results):
        errors += 1
    run_step("GitHub CLI", check_gh_cli, results)
    run_step("VS Code CLI", check_vscode_cli, results)

    if errors > 0:
        fail(f"\n{errors} prerequisite(s) missing. Fix the above and re-run.")
        return 1

    # -- Global npm packages --
    if args.skip_global_npm:
        heading("Global npm Packages (skipped)")
    else:
        heading("Global npm Packages")
        if not run_step("Global npm pkgs", check_global_npm_packages, results):
            errors += 1

    # -- VS Code extensions --
    if args.skip_extensions:
        heading("VS Code Extensions (skipped)")
    else:
        heading("VS Code Extensions")
        if not run_step("VS Code extensions", check_vscode_extensions, results):
            errors += 1

    # -- Project dependencies --
    heading("Project Dependencies")
    if not run_step("node_modules", check_node_modules, results):
        errors += 1

    if errors > 0:
        fail(f"\n{errors} step(s) failed. Fix the above and re-run.")
        return 1

    # -- Bump version --
    heading("Version Bump")
    t0 = time.time()
    new_version = bump_patch_version()
    elapsed = time.time() - t0
    results.append(("Version bump", new_version is not None, elapsed))
    if new_version:
        version = new_version
    else:
        return 1

    # -- Compile --
    if args.skip_compile:
        heading("Compile (skipped)")
    else:
        heading("Compile")
        if not run_step("Compile", step_compile, results):
            return 1

    # -- Quality checks --
    heading("Quality Checks")
    if not run_step("File line limits", check_file_line_limits, results):
        fail("Quality check(s) failed. Fix the above and re-run.")
        return 1

    # ── BUILD ────────────────────────────────────────────────

    # -- Package .vsix --
    heading("Package")
    t0 = time.time()
    vsix_path = step_package()
    elapsed = time.time() - t0
    results.append(("Package", vsix_path is not None, elapsed))
    if not vsix_path:
        return 1

    # ── REPORT & TIMING ─────────────────────────────────────

    report_path = save_report(results, version, vsix_path)
    if report_path:
        rel = os.path.relpath(report_path, PROJECT_ROOT)
        ok(f"Report saved: {C.WHITE}{rel}{C.RESET}")

    print_timing(results)

    # ── DONE + INTERACTIVE PROMPTS ───────────────────────────

    passed = sum(1 for _, p, _ in results if p)
    heading("Done")
    ok(f"{C.BOLD}Build complete!{C.RESET} "
       f"{dim(f'{passed}/{len(results)} steps passed')}")
    ok(f"VSIX: {C.WHITE}{os.path.basename(vsix_path)}{C.RESET}")
    print()

    # -- Install instructions --
    print_install_instructions(vsix_path)
    if args.auto_install:
        # CI mode: install without asking.
        vsix_name = os.path.basename(vsix_path)
        info(f"Running: code --install-extension {vsix_name}")
        run(["code", "--install-extension", os.path.abspath(vsix_path)])
    else:
        prompt_install(vsix_path)

    # -- Offer to open report --
    if report_path:
        prompt_open_report(report_path)

    print()
    return 0


if __name__ == "__main__":
    sys.exit(main())

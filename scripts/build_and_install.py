#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# ##############################################################################
# Saropa Log Capture — Build & Install
# ##############################################################################
#
# .SYNOPSIS
#   Compiles the VS Code extension, packages it as a .vsix, and provides
#   instructions (or automatic install) for loading it into VS Code.
#
# .DESCRIPTION
#   Pipeline: dependencies → compile → package → report → install.
#   Each step is timed and logged. A summary report is saved to reports/.
#
# .NOTES
#   Version:      1.0.0
#   Requires:     Python 3.10+, Node.js 18+, npm
#                 Optional: colorama (`pip install colorama`) for colored output.
#
# .USAGE
#   python scripts/build_and_install.py
#   python scripts/build_and_install.py --skip-compile
#   python scripts/build_and_install.py --auto-install
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


def fail(text: str) -> None:
    print(f"  {C.RED}[FAIL]{C.RESET} {text}")


def info(text: str) -> None:
    print(f"  {C.BLUE}[INFO]{C.RESET} {text}")


def warn(text: str) -> None:
    print(f"  {C.YELLOW}[WARN]{C.RESET} {text}")


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

  {C.PINK_195}Saropa Log Capture — Build & Install{C.RESET}
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


# ── Pipeline Steps ───────────────────────────────────────────
# Each step returns True on success, False on failure. The main()
# function runs them in order and bails out on the first failure.


def step_dependencies() -> bool:
    """Verify node_modules exist, install if missing."""
    node_modules = os.path.join(PROJECT_ROOT, "node_modules")
    if os.path.isdir(node_modules):
        ok("node_modules/ exists")
        return True

    info("Running npm install...")
    result = run(["npm", "install"], cwd=PROJECT_ROOT)
    if result.returncode != 0:
        fail(f"npm install failed:\n{result.stderr.strip()}")
        return False
    ok("npm install completed")
    return True


def step_compile() -> bool:
    """Run the full compile: type-check + lint + esbuild bundle."""
    info("Running npm run compile...")
    result = run(["npm", "run", "compile"], cwd=PROJECT_ROOT)
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


# ── Report ───────────────────────────────────────────────────

def save_report(
    vsix_path: str,
    version: str,
    step_times: list[tuple[str, float]],
) -> str | None:
    """Save a build summary report to reports/. Returns the report path."""
    reports_dir = os.path.join(PROJECT_ROOT, "reports")
    os.makedirs(reports_dir, exist_ok=True)

    ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    report_path = os.path.join(reports_dir, f"build_report_{ts}.txt")

    total_time = sum(t for _, t in step_times)
    vsix_name = os.path.basename(vsix_path)
    vsix_size = os.path.getsize(vsix_path)

    lines = [
        "Saropa Log Capture — Build Report",
        f"Generated: {datetime.datetime.now().isoformat()}",
        "",
        f"Extension version:  {version}",
        f"VSIX file:          {vsix_name}",
        f"VSIX size:          {vsix_size / 1024:.1f} KB",
        f"Total build time:   {elapsed_str(total_time)}",
        "",
        "Step Timings:",
    ]
    for name, secs in step_times:
        lines.append(f"  {name:<20s} {elapsed_str(secs):>8s}")
    lines.append("")
    lines.append(f"VSIX path: {os.path.abspath(vsix_path)}")

    with open(report_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")

    return report_path


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


def prompt_auto_install(vsix_path: str) -> bool:
    """Ask the user whether to install the .vsix via the code CLI.

    Returns True if installation was attempted, False if skipped.
    """
    if not shutil.which("code"):
        warn("VS Code CLI (code) not found on PATH — skipping auto-install.")
        info("Add it via: VS Code → Ctrl+Shift+P → "
             "'Shell Command: Install code command in PATH'")
        return False

    vsix_name = os.path.basename(vsix_path)
    print()
    info(f"Install {C.WHITE}{vsix_name}{C.RESET} now?")
    print(f"         {dim('This runs: code --install-extension <file>')}")
    print()

    try:
        answer = input(f"  {C.YELLOW}Install via CLI? [y/N]: {C.RESET}").strip()
    except (EOFError, KeyboardInterrupt):
        print()
        return False

    if answer.lower() not in ("y", "yes"):
        info("Skipped auto-install.")
        return False

    info(f"Running: code --install-extension {vsix_name}")
    result = run(
        ["code", "--install-extension", os.path.abspath(vsix_path)],
    )
    if result.returncode != 0:
        fail(f"Install failed: {result.stderr.strip()}")
        return False
    ok("Extension installed successfully!")
    info("Reload VS Code to activate the updated extension.")
    return True


# ── CLI ──────────────────────────────────────────────────────

def parse_args() -> argparse.Namespace:
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(
        description="Build and install the Saropa Log Capture VS Code extension.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python scripts/build_and_install.py
  python scripts/build_and_install.py --skip-compile
  python scripts/build_and_install.py --auto-install --no-logo
        """,
    )
    parser.add_argument(
        "--skip-compile",
        action="store_true",
        help="Skip the compile step without prompting.",
    )
    parser.add_argument(
        "--auto-install",
        action="store_true",
        help="Install via 'code' CLI without prompting.",
    )
    parser.add_argument(
        "--no-logo",
        action="store_true",
        help="Suppress the Saropa ASCII art logo.",
    )
    return parser.parse_args()


# ── Main ─────────────────────────────────────────────────────
# Pipeline: dependencies → compile → package → report → install.
# Exits with code 0 on success, 1 on any failure.


def main() -> int:
    args = parse_args()
    version = read_package_version()
    step_times: list[tuple[str, float]] = []

    # -- Banner --
    if not args.no_logo:
        show_logo(version)
    else:
        print(f"\n  {C.BOLD}Saropa Log Capture — Build & Install{C.RESET}"
              f"  {dim(f'v{version}')}")
    print(f"  Project root: {dim(PROJECT_ROOT)}")

    # -- Dependencies --
    heading("Dependencies")
    t0 = time.time()
    if not step_dependencies():
        return 1
    step_times.append(("Dependencies", time.time() - t0))

    # -- Compile --
    # CLI flag skips without asking; otherwise prompt the user.
    skip_compile = args.skip_compile or not ask_yn("Run compile step?")
    if skip_compile:
        heading("Compile (skipped)")
        info("Using existing dist/ output.")
        step_times.append(("Compile", 0.0))
    else:
        heading("Compile")
        t0 = time.time()
        if not step_compile():
            return 1
        step_times.append(("Compile", time.time() - t0))

    # -- Package --
    heading("Package")
    t0 = time.time()
    vsix_path = step_package()
    if not vsix_path:
        return 1
    step_times.append(("Package", time.time() - t0))

    # -- Report (always saved) --
    report_path = save_report(vsix_path, version, step_times)
    if report_path:
        rel = os.path.relpath(report_path, PROJECT_ROOT)
        ok(f"Report saved: {C.WHITE}{rel}{C.RESET}")

    # -- Timing summary --
    total = sum(t for _, t in step_times)
    heading("Timing")
    for name, secs in step_times:
        bar_len = int(min(secs / max(total, 0.001) * 30, 30))
        bar = f"{C.GREEN}{'█' * bar_len}{C.RESET}"
        print(f"  {name:<20s} {elapsed_str(secs):>8s}  {bar}")
    print(f"  {'─' * 40}")
    print(f"  {'Total':<20s} {C.BOLD}{elapsed_str(total)}{C.RESET}")

    # -- Install --
    print_install_instructions(vsix_path)
    # CLI flag auto-installs; otherwise the prompt inside asks the user.
    if args.auto_install:
        heading("Auto-Install")
    prompt_auto_install(vsix_path)

    # -- Done --
    heading("Done")
    ok(f"{C.BOLD}Build complete:{C.RESET} {os.path.basename(vsix_path)}")
    print()
    return 0


if __name__ == "__main__":
    sys.exit(main())

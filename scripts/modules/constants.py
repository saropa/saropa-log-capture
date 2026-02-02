# -*- coding: utf-8 -*-
"""Constants, exit codes, and color setup for the dev toolkit."""

import os

# Resolve paths relative to this file (scripts/modules/constants.py).
_MODULE_DIR = os.path.dirname(os.path.abspath(__file__))
SCRIPT_DIR = os.path.dirname(_MODULE_DIR)
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)

# Maximum lines allowed per TypeScript source file (from CLAUDE.md).
MAX_FILE_LINES = 300

MARKETPLACE_URL = (
    "https://marketplace.visualstudio.com"
    "/items?itemName=saropa.saropa-log-capture"
)
REPO_URL = "https://github.com/saropa/saropa-log-capture"

# cspell:ignore urrent startfile unpushed pubdev connor4312 dbaeumer

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


# ── Exit Codes ──────────────────────────────────────────────


class ExitCode:
    """Exit codes for each failure category."""
    SUCCESS = 0
    PREREQUISITE_FAILED = 1
    WORKING_TREE_DIRTY = 2
    REMOTE_SYNC_FAILED = 3
    DEPENDENCY_FAILED = 4
    COMPILE_FAILED = 5
    TEST_FAILED = 6
    QUALITY_FAILED = 7
    VERSION_INVALID = 8
    CHANGELOG_FAILED = 9
    PACKAGE_FAILED = 10
    GIT_FAILED = 11
    PUBLISH_FAILED = 12
    RELEASE_FAILED = 13
    USER_CANCELLED = 14


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

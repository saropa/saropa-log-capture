# -*- coding: utf-8 -*-
"""Color helpers for the l10n translation CLI.

Thin wrappers over the project's single ANSI source of truth — the ``C`` color
object in ``modules.publish.constants`` (which also runs ``colorama.init`` so
colors render on Windows consoles). Reusing ``C`` keeps every script on one
palette instead of each defining its own escape codes.

Each ``green``/``red``/… returns a colored *string* (compose into a larger
line); ``header`` prints a full boxed section title in place. Semantic intent,
not decoration: green = success/complete, yellow = warning/gap, red =
missing/error, cyan = structure/headers, dim = secondary detail.
"""

from modules.publish.constants import C


def green(text: str) -> str:
    """Success / completed state."""
    return f"{C.GREEN}{text}{C.RESET}"


def red(text: str) -> str:
    """Missing / error state."""
    return f"{C.RED}{text}{C.RESET}"


def yellow(text: str) -> str:
    """Warning / partial-gap state."""
    return f"{C.YELLOW}{text}{C.RESET}"


def cyan(text: str) -> str:
    """Structural emphasis (labels, counts, headers)."""
    return f"{C.CYAN}{text}{C.RESET}"


def bold(text: str) -> str:
    """Strong emphasis without a hue."""
    return f"{C.BOLD}{text}{C.RESET}"


def dim(text: str) -> str:
    """Secondary / de-emphasized detail."""
    return f"{C.DIM}{text}{C.RESET}"


def header(title: str) -> None:
    """Print a boxed section header: cyan rules around a bold title."""
    bar = "=" * 60
    print(f"\n{cyan(bar)}")
    print(f"  {bold(title)}")
    print(cyan(bar))

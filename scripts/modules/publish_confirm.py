# -*- coding: utf-8 -*-
"""Publish confirmation dialog.

Shows the user what will happen during publish and requires
explicit confirmation before proceeding with irreversible actions.
"""

from modules.constants import C, REPO_URL
from modules.display import ask_yn


def confirm_publish(version: str) -> bool:
    """Show publish summary and require explicit confirmation.

    Lists every irreversible action that will happen, so the user
    can make an informed decision. Defaults to "no" since marketplace
    publishes cannot be undone.
    """
    print(f"\n  {C.BOLD}{C.YELLOW}Publish Summary{C.RESET}")
    print(f"  {'-' * 40}")
    print(f"  Version:     {C.WHITE}v{version}{C.RESET}")
    print(f"  Marketplace: {C.WHITE}saropa.saropa-log-capture{C.RESET}")
    print(f"  Repository:  {C.WHITE}{REPO_URL}{C.RESET}")
    print(f"\n  {C.YELLOW}This will:{C.RESET}")
    print(f"    1. Commit and push to origin")
    print(f"    2. Create git tag v{version}")
    print(f"    3. Publish to VS Code Marketplace")
    print(f"    4. Publish to Open VSX (Cursor / VSCodium, if OVSX_PAT set)")
    print(f"    5. Create GitHub release with .vsix")
    print(f"\n  {C.RED}These actions are irreversible.{C.RESET}")
    return ask_yn("Proceed with publish?", default=False)

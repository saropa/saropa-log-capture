# -*- coding: utf-8 -*-
"""Project state checks — facade re-exporting from split modules.

This module exists for backward compatibility. New code should import
directly from the specific modules:
  - checks_git: check_working_tree, check_remote_sync
  - checks_build: ensure_dependencies, step_compile, step_test, check_file_line_limits
  - version: validate_version_changelog, has_unreleased_section
"""

# Re-export git checks
from modules.checks_git import (
    check_remote_sync,
    check_working_tree,
)

# Re-export build checks
from modules.checks_build import (
    check_file_line_limits,
    ensure_dependencies,
    step_compile,
    step_test,
)

# Re-export version operations
from modules.version import (
    has_unreleased_section,
    validate_version_changelog,
)

__all__ = [
    "check_file_line_limits",
    "check_remote_sync",
    "check_working_tree",
    "ensure_dependencies",
    "has_unreleased_section",
    "step_compile",
    "step_test",
    "validate_version_changelog",
]

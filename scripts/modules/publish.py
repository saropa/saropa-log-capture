# -*- coding: utf-8 -*-
"""Publish operations — facade re-exporting from split modules.

This module exists for backward compatibility. New code should import
directly from the specific modules:
  - publish_confirm: confirm_publish
  - publish_git: git_commit_and_push, create_git_tag, is_version_tagged
  - publish_release: step_package, publish_marketplace, publish_openvsx,
                     create_github_release, get_marketplace_published_version
"""

# Re-export confirmation
from modules.publish_confirm import confirm_publish

# Re-export git operations
from modules.publish_git import (
    create_git_tag,
    git_commit_and_push,
    is_version_tagged,
)

# Re-export release operations
from modules.publish_release import (
    create_github_release,
    extract_changelog_section,
    get_marketplace_published_version,
    publish_marketplace,
    publish_openvsx,
    step_package,
)

__all__ = [
    "confirm_publish",
    "create_git_tag",
    "create_github_release",
    "extract_changelog_section",
    "get_marketplace_published_version",
    "git_commit_and_push",
    "is_version_tagged",
    "publish_marketplace",
    "publish_openvsx",
    "step_package",
]

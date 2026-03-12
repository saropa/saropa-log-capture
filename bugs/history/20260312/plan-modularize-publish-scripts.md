# Plan: Modularize Publish Scripts

**Status: COMPLETED**

## Summary

Modularized the publish pipeline from 606 lines to 186 lines by splitting into focused modules. Fixed the "command line too long" Windows bug by using `--notes-file` instead of `--notes` for GitHub releases.

**Before:** 606-line monolithic script with 478-line checks_project.py
**After:** 17 focused modules, largest is 314 lines (orchestrator.py)

**Key changes:**
- `publish.py`: 606 → 186 lines (CLI entry point only)
- `checks_project.py`: Split into `checks_git.py`, `checks_build.py`, `version.py`
- `modules/publish.py`: Split into `publish_confirm.py`, `publish_git.py`, `publish_release.py`
- New `orchestrator.py` module for step flow control
- Fixed Unicode characters (→, ✓, ✗, ─) for Windows cp1252 compatibility
- Fixed duplicate `is_version_tagged` function

---

## Problem Statement

The `scripts/publish.py` pipeline has grown to 606 lines, and several modules exceed recommended limits. Additionally, the GitHub release step fails on Windows with "The command line is too long" when the CHANGELOG section is large—this is because `--notes` is passed directly on the command line rather than via stdin or a temp file.

## Current Structure

| File | Lines | Purpose |
|------|-------|---------|
| `publish.py` | 606 | Main orchestrator |
| `modules/checks_project.py` | 478 | Git, deps, build, quality, version validation |
| `modules/publish.py` | 356 | Confirm, package, git ops, marketplace, GitHub |
| `modules/checks_prereqs.py` | 163 | Node, npm, git, gh CLI, vsce auth |
| `modules/utils.py` | 151 | Shell exec, version reading, timing |
| `modules/report.py` | 122 | Reports, timing chart, success banner |
| `modules/constants.py` | 119 | Constants, exit codes, colors |
| `modules/install.py` | 107 | Local .vsix install workflow |
| `modules/checks_environment.py` | 105 | VS Code CLI, global npm, extensions |
| `modules/display.py` | 90 | Terminal display helpers |

**Total: ~2,300 lines across 10 files**

---

## Phase 1: Fix the Immediate Bug

### Bug: "The command line is too long" on Windows

**Root cause:** `create_github_release()` in `modules/publish.py` passes the changelog notes via `--notes` argument:

```python
result = run(
    [
        "gh", "release", "create", tag,
        os.path.abspath(vsix_path),
        "--title", tag,
        "--notes", notes,  # <-- Can exceed ~8191 char Windows limit
    ],
    ...
)
```

**Solution:** Use `--notes-file` with a temporary file instead of `--notes`:

```python
import tempfile

def create_github_release(version: str, vsix_path: str) -> bool:
    tag = f"v{version}"
    # ... existing release check ...
    
    notes = extract_changelog_section(version)
    
    # Write notes to temp file to avoid Windows command line limit
    with tempfile.NamedTemporaryFile(
        mode="w",
        suffix=".md",
        delete=False,
        encoding="utf-8",
    ) as f:
        f.write(notes)
        notes_file = f.name
    
    try:
        result = run(
            [
                "gh", "release", "create", tag,
                os.path.abspath(vsix_path),
                "--title", tag,
                "--notes-file", notes_file,
            ],
            cwd=PROJECT_ROOT,
        )
    finally:
        os.unlink(notes_file)  # Clean up temp file
    
    # ... rest of function ...
```

---

## Phase 2: Split Large Modules

### 2.1 Split `checks_project.py` (478 lines) into 3 modules

| New Module | Lines | Contents |
|------------|-------|----------|
| `checks_git.py` | ~90 | `check_working_tree`, `check_remote_sync`, `_check_if_behind` |
| `checks_build.py` | ~80 | `ensure_dependencies`, `_run_npm_install`, `step_compile`, `step_test`, `check_file_line_limits` |
| `version.py` | ~200 | `validate_version_changelog`, `_stamp_changelog`, `_write_package_version`, `_prompt_version`, `has_unreleased_section`, etc. |

### 2.2 Split `modules/publish.py` (356 lines) into 3 modules

| New Module | Lines | Contents |
|------------|-------|----------|
| `publish_confirm.py` | ~30 | `confirm_publish` |
| `publish_git.py` | ~100 | `git_commit_and_push`, `_push_to_origin`, `create_git_tag`, `is_version_tagged` |
| `publish_release.py` | ~180 | `step_package`, `publish_marketplace`, `publish_openvsx`, `create_github_release`, `extract_changelog_section`, `get_marketplace_published_version` |

### 2.3 Slim down `publish.py` (606 lines) → ~200 lines

Move orchestration helpers to a new `orchestrator.py` module:

| Keep in `publish.py` | Move to `orchestrator.py` |
|---------------------|---------------------------|
| `parse_args()` | `_run_prerequisites()` |
| `main()` | `_run_dev_checks()` |
| `_CLI_FLAGS` | `_run_analysis()` |
| Exit code mapping | `_run_build_and_validate()` |
| | `_run_publish_steps()` |
| | `_check_publish_credentials()` |
| | `_package_and_install()` |

---

## Phase 3: Proposed New Structure

```
scripts/
├── publish.py              # ~200 lines - CLI entry point, arg parsing, main()
└── modules/
    ├── __init__.py
    ├── constants.py        # 119 lines - unchanged
    ├── display.py          # 90 lines - unchanged
    ├── utils.py            # 151 lines - unchanged
    ├── orchestrator.py     # ~250 lines - NEW: step runners & flow control
    ├── checks_prereqs.py   # 163 lines - unchanged (Node, npm, git, gh, vsce)
    ├── checks_environment.py # 105 lines - unchanged (VS Code CLI, npm global)
    ├── checks_git.py       # ~90 lines - NEW: working tree, remote sync
    ├── checks_build.py     # ~80 lines - NEW: deps, compile, test, quality
    ├── version.py          # ~200 lines - NEW: version validation, changelog
    ├── publish_confirm.py  # ~30 lines - NEW: publish confirmation
    ├── publish_git.py      # ~100 lines - NEW: commit, push, tag
    ├── publish_release.py  # ~180 lines - NEW: package, marketplace, GitHub
    ├── report.py           # 122 lines - unchanged
    └── install.py          # 107 lines - unchanged
```

**Result: 14 modules, no file exceeds 250 lines**

---

## Implementation Order

1. **Phase 1** - Fix the `--notes-file` bug (immediate, ~30 min)
2. **Phase 2.1** - Split `checks_project.py` (~1 hr)
3. **Phase 2.2** - Split `modules/publish.py` (~1 hr)
4. **Phase 2.3** - Extract `orchestrator.py` from `publish.py` (~1 hr)
5. **Phase 3** - Update all imports, run tests, verify pipeline

---

## Testing Checklist

- [ ] `python scripts/publish.py --analyze-only` passes
- [ ] `python scripts/publish.py --analyze-only --skip-tests` passes
- [ ] Local .vsix install works
- [ ] Full publish to marketplace + Open VSX + GitHub release works
- [ ] GitHub release with long CHANGELOG (>8000 chars) succeeds on Windows
- [ ] All exit codes map correctly on failure scenarios

---

## Alternative Considered: Keep Current Structure

We could just fix the `--notes-file` bug without restructuring. However:

- `checks_project.py` at 478 lines violates the project's 300-line guideline
- The main `publish.py` at 606 lines is hard to navigate
- Related functionality is scattered (version logic in `checks_project.py`, git in both `checks_project.py` and `publish.py`)

The modularization makes the codebase more maintainable and aligns with the project's own quality standards.

---

## Notes

- Keep backward compatibility: no CLI flag changes
- No new dependencies required
- Phase 1 can be deployed independently as a hotfix

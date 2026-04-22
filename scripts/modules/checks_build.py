# -*- coding: utf-8 -*-
"""Build checks: dependencies, compile, test, and quality.

These checks ensure the project builds correctly and meets quality
standards before we attempt any package or publish operations.
"""

import os

from modules.constants import C, MAX_FILE_LINES, PROJECT_ROOT
from modules.display import fail, fix, ok, warn
from modules.utils import run


def ensure_dependencies() -> bool:
    """Run npm install if node_modules is stale or missing.

    Compares package.json mtime against node_modules/.package-lock.json
    to detect when dependencies need updating. This avoids running
    npm install on every invocation (which is slow).
    """
    node_modules = os.path.join(PROJECT_ROOT, "node_modules")
    pkg_json = os.path.join(PROJECT_ROOT, "package.json")

    if not os.path.isfile(pkg_json):
        fail("package.json not found.")
        return False

    if not os.path.isdir(node_modules):
        fix("node_modules/ missing — running npm install...")
        return _run_npm_install()

    lock = os.path.join(node_modules, ".package-lock.json")
    if os.path.isfile(lock):
        if os.path.getmtime(pkg_json) > os.path.getmtime(lock):
            fix("package.json newer than lockfile — running npm install...")
            return _run_npm_install()

    ok("node_modules/ up to date")
    return True


def _run_npm_install() -> bool:
    """Run npm install and report result."""
    result = run(["npm", "install"], cwd=PROJECT_ROOT, check=False)
    if result.returncode != 0:
        fail(f"npm install failed: {result.stderr.strip()}")
        return False
    ok("npm install completed")
    return True


def step_compile() -> bool:
    """Run the full compile: type-check + lint + production esbuild bundle.

    This runs `npm run package` (same as vscode:prepublish) so the pipeline
    builds once. Packaging then runs vsce with prepublish skipped to avoid
    a second build and the resulting zip stream errors.
    """
    from modules.display import info
    info("Running npm run package (type-check + lint + production build)...")
    result = run(["npm", "run", "package"], cwd=PROJECT_ROOT, check=False)
    if result.returncode != 0:
        fail("Compile failed:")
        if result.stdout.strip():
            print(result.stdout)
        if result.stderr.strip():
            print(result.stderr)
        return False
    ok("Compile passed (type-check + lint + production esbuild)")
    return True


def step_test() -> bool:
    """Run the test suite via npm run test.

    Uses @vscode/test-cli to launch tests inside VS Code's Extension
    Development Host. Tests run in a headless VS Code instance.
    """
    from modules.display import info
    info("Running npm run test...")
    result = run(["npm", "run", "test"], cwd=PROJECT_ROOT, check=False)
    if result.returncode != 0:
        fail("Tests failed:")
        if result.stdout.strip():
            print(result.stdout)
        if result.stderr.strip():
            print(result.stderr)
        return False
    ok("Tests passed")
    return True


def _count_code_lines(filepath: str) -> int:
    """Count lines excluding blank lines and comment-only lines.

    Mirrors eslint's `max-lines` rule with `skipBlankLines: true` and
    `skipComments: true` (see eslint.config.mjs). Before this, the build
    script tallied raw line counts while eslint tallied stripped counts,
    so the two tools disagreed — a file could warn here while passing lint.

    A line is COUNTED if, after removing blank/whitespace-only content and
    any leading/trailing comment spans, something non-whitespace remains.
    Trailing comments on real code (e.g. `foo(); // note`) still count the
    line — same as eslint. Lines entirely inside a `/* ... */` block, or
    lines that are only `//` comments, are skipped.

    This is a heuristic (not a full TS tokenizer) — it doesn't understand
    strings containing `//` or `/*`, which is rare enough that the count
    stays within one or two of eslint's number in practice. Close enough
    for the two tools to agree on whether a file is over the 300 threshold.
    """
    count = 0
    in_block = False  # are we currently inside a /* ... */ that opened earlier
    try:
        with open(filepath, encoding="utf-8") as f:
            lines = f.readlines()
    except OSError:
        return 0

    for raw in lines:
        s = raw.strip()
        if not s:
            continue

        # Strip comment spans from this line; what's left decides if it counts.
        kept = ""
        i = 0
        while i < len(s):
            if in_block:
                # Looking for the closing `*/` of a block comment that spans lines.
                end = s.find("*/", i)
                if end == -1:
                    i = len(s)  # whole remainder is comment
                else:
                    i = end + 2
                    in_block = False
                continue
            # Line comment — rest of line is comment, done.
            if s[i:i + 2] == "//":
                break
            # Block comment start on this line.
            if s[i:i + 2] == "/*":
                close = s.find("*/", i + 2)
                if close == -1:
                    in_block = True
                    break
                i = close + 2
                continue
            kept += s[i]
            i += 1

        if kept.strip():
            count += 1
    return count


def check_file_line_limits() -> bool:
    """Check the 300-line limit on TypeScript files in src/.

    This is a project quality guideline. Keeping files
    short encourages modular design and makes code review easier.

    Line counting matches eslint's `max-lines` with `skipBlankLines` and
    `skipComments` — see `_count_code_lines`. The displayed count is the
    stripped count, not the raw file length.

    NOTE: This check triggers a WARNING only. It does not halt the build/publish
    process, allowing for legacy files or temporary exceptions.
    """
    src_dir = os.path.join(PROJECT_ROOT, "src")
    violations: list[str] = []

    # Script-heavy viewer templates and certain test fixtures are allowed
    # to exceed the soft limit; we still enforce it for the rest of src/.
    ignore_paths = {
        os.path.normpath(p)
        for p in (
            "src/modules/capture/log-session.ts",
            "src/modules/config/config-types.ts",
            "src/modules/config/config.ts",
            "src/modules/db/db-session-fingerprint-diff.ts",
            "src/test/modules/db/db-detector-framework.test.ts",
            "src/test/ui/viewer-sql-repeat-compression.test.ts",
            "src/ui/provider/log-viewer-provider.ts",
            "src/ui/provider/viewer-message-handler-actions.ts",
            "src/ui/shared/handlers/context-handlers.ts",
            "src/ui/viewer/viewer-data-add.ts",
            "src/ui/viewer/viewer-script-messages.ts",
            "src/ui/viewer/viewer-script.ts",
            "src/ui/viewer/viewer-scrollbar-minimap.ts",
            "src/ui/viewer-context-menu/viewer-context-menu-actions.ts",
            "src/ui/viewer-context-menu/viewer-context-popover-script.ts",
            "src/ui/viewer-panels/pop-out-panel.ts",
            "src/ui/viewer-stack-tags/viewer-sql-pattern-tags.ts",
        )
    }

    for dirpath, _dirs, filenames in os.walk(src_dir):
        for fname in filenames:
            if not fname.endswith(".ts"):
                continue
            filepath = os.path.join(dirpath, fname)
            rel = os.path.normpath(os.path.relpath(filepath, PROJECT_ROOT))
            if rel in ignore_paths:
                continue
            # Match eslint's accounting (blanks + comment-only lines skipped)
            # so script warnings and lint warnings can't disagree.
            count = _count_code_lines(filepath)
            if count > MAX_FILE_LINES:
                violations.append(f"{rel} ({count} lines)")

    if violations:
        warn(f"{len(violations)} file(s) exceed {MAX_FILE_LINES}-line limit:")
        for v in violations:
            print(f"         {C.RED}{v}{C.RESET}")
        return True

    ok(f"All .ts files are within the {MAX_FILE_LINES}-line limit")
    return True

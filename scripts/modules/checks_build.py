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
    """Run the full compile: type-check + lint + esbuild bundle.

    This runs `npm run compile` which chains:
      1. tsc --noEmit (type checking)
      2. eslint src (linting)
      3. node esbuild.js (bundle into dist/extension.js)
    """
    from modules.display import info
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


def check_file_line_limits() -> bool:
    """Check the 300-line limit on all TypeScript files in src/.

    This is a project quality guideline. Keeping files
    short encourages modular design and makes code review easier.

    NOTE: This check triggers a WARNING only. It does not halt the build/publish
    process, allowing for legacy files or temporary exceptions.
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
        warn(f"{len(violations)} file(s) exceed {MAX_FILE_LINES}-line limit:")
        for v in violations:
            print(f"         {C.RED}{v}{C.RESET}")
        return True

    ok(f"All .ts files are within the {MAX_FILE_LINES}-line limit")
    return True

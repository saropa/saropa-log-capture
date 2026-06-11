/**
 * Shared classifier that splits the compiled test files in `out/test/` into the
 * two runners they were written for:
 *
 *  - **node:test** files (`import test from 'node:test'`) — pure, no VS Code API.
 *    These are run by `run-node-tests.mjs` with the quiet `dot` reporter.
 *  - **Mocha** files (`suite()` / `test()` globals) — run by `@vscode/test-cli`
 *    inside the Extension Development Host.
 *
 * WHY this split exists: a node:test file loaded by Mocha (vscode-test) still
 * auto-runs under node's own test runner at process exit, using node's default
 * `spec` reporter — which prints every passing test (the ✔ flood). node's
 * reporter cannot be configured on that auto-run path, so the only way to keep
 * `npm test` quiet is to keep node:test files out of the vscode-test glob and
 * run them separately with `--test-reporter=dot`. `.vscode-test.mjs` consumes
 * `listMochaTestFiles()`; `run-node-tests.mjs` consumes `listNodeTestFiles()`.
 */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/** Compiled test root. Relative to the repo root (the npm-script cwd). */
const OUT_TEST_DIR = 'out/test';

/** Matches the import/require specifier in either module format
 *  (`require("node:test")` or `from 'node:test'`). The back-reference pins the
 *  closing quote so `node:assert` / `node:test-helper` can never false-match. */
const NODE_TEST_IMPORT = /(['"])node:test\1/;

/** Recursively collect every `*.test.js` under `dir`, normalised to forward
 *  slashes so the paths feed straight into glob-based consumers on Windows. */
function walk(dir, acc) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, acc);
    } else if (entry.endsWith('.test.js')) {
      acc.push(full.split('\\').join('/'));
    }
  }
  return acc;
}

/** Every compiled test file, or `[]` when `out/test` has not been built yet. */
function allTestFiles() {
  if (!existsSync(OUT_TEST_DIR)) {
    return [];
  }
  return walk(OUT_TEST_DIR, []);
}

/** True when the file's source pulls in the `node:test` runner. */
function importsNodeTest(file) {
  return NODE_TEST_IMPORT.test(readFileSync(file, 'utf8'));
}

/** Files written against node's built-in test runner. */
export function listNodeTestFiles() {
  return allTestFiles().filter(importsNodeTest);
}

/** Files written against Mocha's `suite()`/`test()` globals (vscode-test). */
export function listMochaTestFiles() {
  return allTestFiles().filter((file) => !importsNodeTest(file));
}

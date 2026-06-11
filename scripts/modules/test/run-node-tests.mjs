/**
 * Runs the project's `node:test` files (the pure, non-VS-Code suites) with the
 * quiet `dot` reporter, so a green run prints dots instead of one ✔ line per
 * passing test. Failures and their diagnostics are still shown in full.
 *
 * These files are deliberately excluded from the vscode-test glob (see
 * `.vscode-test.mjs` + `node-test-files.mjs`) — running them here keeps
 * `npm test` from flooding the terminal with node's default `spec` output and
 * runs them far faster (no Extension Development Host boot).
 *
 * Requires `out/test` to be built first (the `pretest` lifecycle script, or
 * `npm run compile-tests`).
 */
import { spawnSync } from 'node:child_process';
import { listNodeTestFiles } from './node-test-files.mjs';

const files = listNodeTestFiles();

if (files.length === 0) {
  // No compiled node:test files — almost always a missing build, not "nothing to
  // run". Fail loudly so a skipped compile can't masquerade as a green suite.
  console.error('run-node-tests: no node:test files found under out/test — run "npm run compile-tests" first.');
  process.exit(1);
}

const result = spawnSync(
  process.execPath,
  ['--test', '--test-reporter=dot', ...files],
  { stdio: 'inherit' },
);

// Propagate the child's exit code so CI / `npm test` fails on a red node:test run.
process.exit(result.status ?? 1);

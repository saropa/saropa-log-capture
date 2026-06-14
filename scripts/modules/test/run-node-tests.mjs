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
import { fileURLToPath } from 'node:url';
import { listNodeTestFiles } from './node-test-files.mjs';

const files = listNodeTestFiles();

// Preloaded into the test process so a transitive `require('vscode')` — e.g. a
// localized module reaching `src/l10n.ts`, which imports `vscode` for
// `l10n.t()` — resolves to a stub instead of crashing. `vscode` only exists
// inside the Extension Development Host, not under plain `node --test`.
const vscodeStub = fileURLToPath(new URL('./vscode-stub.cjs', import.meta.url));

if (files.length === 0) {
  // No compiled node:test files — almost always a missing build, not "nothing to
  // run". Fail loudly so a skipped compile can't masquerade as a green suite.
  console.error('run-node-tests: no node:test files found under out/test — run "npm run compile-tests" first.');
  process.exit(1);
}

const result = spawnSync(
  process.execPath,
  ['--require', vscodeStub, '--test', '--test-reporter=dot', ...files],
  { stdio: 'inherit' },
);

// Propagate the child's exit code so CI / `npm test` fails on a red node:test run.
process.exit(result.status ?? 1);

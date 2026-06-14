# Coverage gate now counts the node:test suites

The CI `build` job failed on every push to `main`, and on every Dependabot PR,
at the `test:coverage` step — never on a code, type, or lint error. The coverage
run instrumented and measured only the Mocha suites that run inside the VS Code
Extension Development Host. The project's large body of pure `node:test` suites
runs in a separate `node --test` process that the coverage hook never observed,
so heavily-tested pure modules (db detectors, fingerprint summaries, session
deltas, root-cause hypotheses, and others) reported 8–15% coverage. That pulled
the global thresholds under the gate (`statements` 45.57 / `branches` 33.99 /
`functions` 40.32 against a 48 / 37 / 43 floor), failing the build on green code.

## Finish Report (2026-06-14)

### Scope

(C) docs/scripts only — CI/test orchestration under `scripts/modules/test/`. No
Flutter/Dart code (this is a TypeScript VS Code extension) and no change to the
extension's runtime `src/` TypeScript or to any test assertion.

### Change set

- `scripts/modules/test/node-coverage-hook.cjs` (new) — a `--require` preload for
  the `node --test` process. On `process.exit` it writes `global.__coverage__`
  (populated by nyc's in-place instrumentation of `out/`) to a `.nyc_output`
  file. The filename embeds `process.pid` because `node --test` forks one child
  process per test file; a fixed filename made each child overwrite the previous,
  so only the last file's coverage survived the merge.
- `scripts/modules/test/run-node-tests.mjs` — preloads the dump hook (in addition
  to the existing `vscode-stub.cjs`) only when `SLC_TEST_COVERAGE=1`. The plain
  `npm test` path leaves the flag unset and spawns exactly as before, with no
  coverage overhead.
- `scripts/modules/test/run-coverage.js` — after the Mocha run, executes the
  `node:test` pass over the still-instrumented `out/` (before the `finally`
  block recompiles and de-instruments), so `nyc report` merges both the
  Extension-Host coverage and the node:test coverage. The `run` helper now
  forwards an env overlay so the pass can set `SLC_TEST_COVERAGE=1`.
- `CHANGELOG.md` — `[Unreleased] → Fixed` entry describing the gate fix.

### Why this approach over the alternative

The low coverage was a measurement gap, not a test gap: the modules under the
gate were already covered by passing `node:test` suites that simply ran outside
the instrumented process. Writing fresh Mocha tests would have duplicated logic
that is already tested, purely to make the duplicate get measured. Capturing the
existing node:test coverage reflects the codebase's true coverage and adds no
redundant tests.

### Verification

`npm run test:coverage` was run end to end on Windows against the cached VS Code
test instance. The Mocha suite reports 3396 passing; the node:test suite passes
under the `dot` reporter. After merging both coverage sources the global figures
rose to `statements` 51.47 / `branches` 41.55 / `functions` 46.76 / `lines`
53.89 — all above the 48 / 37 / 43 / 43 gate — and `nyc check-coverage` exits 0.
Representative modules that were previously invisible now report real coverage:
`db-detector-framework` 96%, `db-fingerprint-summary` 100%, `session-delta` 96%,
`debugging-velocity` 100%.

A first run proved the merge mechanism worked but lifted coverage only ~1.2
points because the per-file child processes were clobbering a single fixed
coverage filename; keying the filename by pid captured every child and produced
the full lift. No source code or test assertion was modified, so the suite's
pass/fail behavior is unchanged; only the measured coverage differs.

### Review notes

- Logic & safety: the node:test pass sits inside the existing `try` so a node:test
  failure flips `testsFailed` and exits non-zero, matching the Mocha path. The
  `finally` block still restores an un-instrumented `out/`.
- Architecture: reuses the existing `node-test-files.mjs` classifier and
  `vscode-stub.cjs` via `run-node-tests.mjs` rather than re-listing test files.
  The new hook mirrors the existing `coverage-hook.ts` shape (exit-time dump to
  `.nyc_output`).
- Performance: the coverage path runs the node:test suite once more under
  instrumentation; the default `npm test` path is untouched.
- Compatibility: `.nyc_output`, `out/`, and `coverage/` are gitignored, so the
  per-pid coverage files are never committed.

### Knock-on effect

The same gate was the sole failure on the two open major-version Dependabot PRs
(ESLint 9→10 and TypeScript 5.9→6.0); both compiled and linted clean. Rebasing
them onto the fixed `main` cleared their builds and both merged.

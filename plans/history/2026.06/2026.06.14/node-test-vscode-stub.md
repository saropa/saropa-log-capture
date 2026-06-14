# Node test suite — vscode stub for localized modules

Four signal-report renderer test files run under the project's pure `node:test`
suite (plain `node --test`, no Extension Development Host). After the
signal-report renderers were localized, they began importing `src/l10n.ts`,
which does `import * as vscode from 'vscode'` at module top for
`vscode.l10n.t()`. The `vscode` module does not exist outside the Extension
Development Host, so loading those four test files threw
`Cannot find module 'vscode'` and the suite failed at the publish test gate.

## Finish Report (2026-06-14)

### Scope

(C) docs/scripts only — node-test harness plus a CHANGELOG entry. No product
TypeScript, webview, or Flutter code changed.

### Problem

The node-test/Mocha split is deliberate: `node:test` files are the "pure, no VS
Code API" suite, run by `run-node-tests.mjs` under plain `node --test` for speed
(no Extension Host boot). Pure code can still reach `vscode` transitively — the
signal-report renderers (`signal-report-overview`, `-details`, `-related`,
`-render`) call `t()` from `src/l10n.ts`, and `l10n.ts` imports `vscode` at
module top. The moment those renderers were localized, the four node:test files
that import them could no longer load, failing with
`Cannot find module 'vscode'`.

### Fix

A CommonJS preload, `scripts/modules/test/vscode-stub.cjs`, intercepts
`require('vscode')` at any depth by patching `Module._load` and returns a stub.
`vscode.l10n.t` reproduces the real argument substitution — positional `{0}`,
`{1}`, … and the single-object named `{name}` form — so localized output under
test matches what the Extension Host produces. Every other `vscode` surface is a
no-op `Proxy`: property access returns another no-op-callable proxy and calls
return `undefined`, so an unexpected `vscode.window.foo()` in a pure unit test
degrades to nothing instead of a hard crash.

`run-node-tests.mjs` resolves the stub path via `import.meta.url` and passes
`--require <stub>` ahead of `--test` in the spawned test process, so the
interception is installed before any test file loads.

### Why this approach

The alternative — moving the four files into the Mocha (Extension Host) suite —
would forfeit the speed of the pure runner and split a cohesive test family
across two runners. Stubbing `vscode` keeps the renderers testable as pure
units and makes the runner robust to any future pure module that reaches
`vscode` transitively, not just these four files.

### Verification

- `node scripts/modules/test/run-node-tests.mjs` → exit 0; the four formerly
  failing files (`signal-report-details`, `-overview`, `-related`, `-render`)
  pass, and the rest of the node suite is unaffected.
- No existing test references the harness files or depends on `vscode` being
  absent (grep of `src/test/` for the harness names and for throw-on-`vscode`
  assertions returned nothing), so the global `Module._load` patch changes no
  existing expectation.

### Files

- `scripts/modules/test/vscode-stub.cjs` — new CommonJS preload stub.
- `scripts/modules/test/run-node-tests.mjs` — preloads the stub via `--require`.
- `CHANGELOG.md` — Fixed entry under `[9.0.0]`.

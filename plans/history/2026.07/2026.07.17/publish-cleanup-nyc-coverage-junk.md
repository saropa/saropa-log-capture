# Publish pipeline leaves stale `.nyc_output/` and `coverage/` behind between runs

`scripts/modules/build/clean.mjs` only removed `out/` unconditionally, gating `dist/`
and `.vscode-test/` behind flags. It never touched `.nyc_output/` or `coverage/` — the
intermediate and merged output of `npm run test:coverage` — so those directories
(both already gitignored) accumulated in the working tree indefinitely, with nothing
in the publish pipeline ever sweeping them.

## Finish Report (2026-07-17)

**Change:** `scripts/modules/build/clean.mjs` now always removes `.nyc_output/` and
`coverage/` alongside `out/` — ungated by any flag, since both are cheap to regenerate
(unlike `dist/`, expensive to rebuild, or `.vscode-test/`, slow to re-download).

`scripts/modules/publish/checks_build.py` adds `cleanup_stray_output()`, a best-effort
housekeeping call (`node scripts/modules/build/clean.mjs`) that never gates or fails the
pipeline — it only reports success via an info line.

`scripts/publish.py` calls `cleanup_stray_output()` once, immediately after the startup
banner and before Step 1 (Prerequisites), so any coverage artifact left by a prior manual
`npm run test:coverage` run is swept before compile/test/package touch `out/`.

**Verification:** ran `node scripts/modules/build/clean.mjs` directly (removed `out`,
`.nyc_output`, `coverage`; idempotent on a second run with nothing to remove). Ran
`cleanup_stray_output()` standalone via a Python one-liner — printed the expected info
line and returned cleanly. No test suite covers `scripts/` tooling in this repo, so
direct execution is the only verification path available.

**Scope:** docs/scripts only. No user-facing behavior, no CHANGELOG entry (dev/publish
tooling never ships to end users). No bug or plan closed by this change.

## Finish Report (2026-07-17, hardening follow-up)

The initial change shipped with no regression test protecting `clean.mjs`'s target
list, so a future edit could silently drop `.nyc_output/` or `coverage/` from the
always-cleaned set with nothing to catch it.

**Change:** `clean.mjs` extracts `buildTargets(rootDir, args)` as a pure, exported
function; the destructive `fs.rmSync` sweep now runs only when the file is invoked
directly (`process.argv[1] === fileURLToPath(import.meta.url)`), not on import. A new
`clean.test.mjs` (`node --test`) asserts `.nyc_output/` and `coverage/` are always
present in the target list, and `dist/` / `.vscode-test/` appear only when their
respective flags are passed.

The circular-import concern raised against `cleanup_stray_output()`'s local
`from modules.publish.display import info` was checked against the file's existing
convention — `step_compile`, `step_test`, and `_report_l10n_manual_gaps` already use
the identical local-import pattern — so no change was needed; the pattern is
established, not a deviation. The concern is also empirically resolved: this session
already executed both `cleanup_stray_output()` standalone and `publish.py`'s local
import of `checks_build` inside `main()`, both without error.

The `node_modules`-availability concern was resolved by inspection: `clean.mjs`
imports only `node:fs`, `node:path`, and `node:url` — no third-party dependency, so it
runs before `npm install` on a fresh clone.

**Verification:** `node --test scripts/modules/build/clean.test.mjs` — 3/3 pass. Direct
CLI invocation (`node scripts/modules/build/clean.mjs`) re-verified unchanged after the
refactor: still removes `out/`, `.nyc_output/`, `coverage/`.

**Not addressed:** a `--dry-run` flag was raised as a brainstormed feature suggestion,
not a defect — left unbuilt per standing instruction to treat such suggestions as
ideas for consideration, not committed work.

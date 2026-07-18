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

# Issue #30 — Extension causes high CPU load / unresponsive host

**Triggered by:** GitHub issue [#30](https://github.com/saropa/saropa-log-capture/issues/30) ("Extension causes high cpu load", v7.17.2, Windows 11, VS Code 1.123.0), filed with an `unresponsive` CPU profile (`saropa.saropa-log-capture-unresponsive.cpuprofile.txt`). The profile showed the extension host pinned at 100% for ~5.5 s.

## Finish Report (2026-06-06)

### Scope

**(B) VS Code extension (TypeScript).** No Flutter/Dart, no NLS/user-string changes.

### Diagnosis

Demangled the attached CPU profile against the shipped v7.17.2 bundle (HEAD = the `v7.17.2` tag; `dist/extension.js` matched). All samples sat under a single host-side call:

- `g6e` = `scanOne` in [session-severity-scan.ts](../../../../src/ui/session/session-severity-scan.ts) — the deferred background scan that fills the session-list error/warning/perf badges.
- It called `ld` = `countSeverities`, looping every line through the regex bank in [level-classifier.ts](../../../../src/modules/analysis/level-classifier.ts).
- Hottest leaves: `dE` = `matchesError` (3242 samples) and `Jre` = `classifyNonError` (3275), with `Cw` = `matchesPerf` (744).

Two compounding defects, both confirmed empirically (benchmarks in scratch, since deleted):

1. **Catastrophic O(n²) regex.** `strictStructuralErrorPattern` began `/\w*(?:Error|Exception)…/`. The leading `\w*` is redundant for an unanchored `.test()` (the engine already retries at every offset, so `TypeError:` still matches via `Error:` at index 4) but it backtracked quadratically on a long unbroken word-run (base64 blob / hash / minified JSON). Measured: **2.3 s for one 50 KB line**, ~9 s at 100 KB. It was the *only* slow regex — every other pattern stayed sub-millisecond even on a 50 KB word-run.
2. **Synchronous whole-file scan on the host thread.** Even when linear, scanning a large log line-by-line never yields, so the host freezes until done. The profile's near-equal `matchesError`/`classifyNonError` split proves the *many-lines* case was also in play here (a single O(n²) line would make `matchesError` dominate alone).

### Fix

1. Dropped the redundant leading `\w*` → `/(?:Error|Exception)…/`. Boolean-equivalent (verified 16 representative cases), 2162 ms → 0.03 ms. The second alternative `_[A-Z]\w*(?:Error|Exception)\b` keeps its `\w*` — anchored by `_[A-Z]`, it starts in at most one place per line, so it stays single-pass O(n). Mirrored in the webview copy ([viewer-level-classify.ts](../../../../src/ui/viewer-search-filter/viewer-level-classify.ts)) per the keep-in-sync contract.
2. Added `countSeveritiesChunked` ([session-severity-counts.ts](../../../../src/ui/session/session-severity-counts.ts)) — identical logic to `countSeverities`, but yields to the event loop (`setImmediate`) every 2000 lines so a large file can't block the host. Extracted the shared per-line `tallyLine`/`newTally` so the sync and chunked counters stay in lockstep. Wired the chunked counter into both whole-file scans (deferred scan + ANR-risk finalize). The sync `countSeverities` remains for small run-summary slices.

### Verification

- `check-types`: clean. `lint`: clean on changed files (7 pre-existing warnings elsewhere, untouched). `compile` + full verify suite (NLS, webview catalogs, command list, dist-size): pass.
- Classifier + severity + **extension/webview parity drift-guard** tests: 150 passing. The parity test's "every corpus line classifies identically in both copies" confirms classifications are unchanged and host/viewer stay in sync.
- New regression test [level-classifier-backtracking.test.ts](../../../../src/test/modules/analysis/level-classifier-backtracking.test.ts): 3 passing — 100 K-char pathological lines classify in <1 s (would take ~9 s under the old pattern). This is the failing-test-before-fix guard.
- Confirmed `countSeveritiesChunked` yields across the 2000-line boundary (6000-line input) yet produces counts byte-identical to the sync version.

### Test audit (Section 4A)

Grepped `src/test` for every changed symbol (`countSeverities`, `countSeveritiesChunked`, `strictStructuralErrorPattern`, `classifyLevel`, `tallyLine`, `extractBody`) and changed file basenames. Only `session-severity-counts.test.ts` pins the changed sync API; behavior is unchanged and it passed (16 cases). All `level-classifier*`/parity tests ran green. No assertion needed rewriting — the regex change is behavior-preserving by construction.

### Release

Bumped `package.json` 7.17.2 → **7.17.3** and moved the unreleased CHANGELOG entries (this fix + two pre-existing Maintenance entries) into a new `## [7.17.3]` section. `verify:release-version` passes.

### Files

- `src/modules/analysis/level-classifier.ts` — regex fix + doc.
- `src/ui/viewer-search-filter/viewer-level-classify.ts` — mirrored regex fix.
- `src/ui/session/session-severity-counts.ts` — `tallyLine`/`newTally` extraction + `countSeveritiesChunked`.
- `src/ui/session/session-severity-scan.ts` — use chunked counter.
- `src/modules/session/session-lifecycle-finalize.ts` — use chunked counter.
- `src/test/modules/analysis/level-classifier-backtracking.test.ts` — new regression test.
- `CHANGELOG.md`, `package.json` — 7.17.3 release.

### Outstanding

None for this task. Note: 3 l10n-audit `.py` files (`scripts/modules/verify/l10n_*.py`) sit uncommitted in the tree from a separate workstream; their CHANGELOG entry now lives under 7.17.3. They are build/CI translation-audit tooling, not part of the shipped extension bundle.

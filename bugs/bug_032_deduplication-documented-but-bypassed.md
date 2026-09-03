# Bug 032 — Deduplication documented but bypassed

## Status: Fixed

## Severity: Medium

README advertises repeated-line grouping that does not run, misleading users about actual capture behavior.

## Problem

README:113 advertises `(x54)` line grouping (deduplication of repeated log lines), but `Deduplicator.process()` is never called in the capture pipeline. The feature appears to exist in code but is not wired into the data flow. Users see every repeated line individually.
(`src/modules/capture/log-session.ts:252-254,445-450`)

## Reproduction

1. Trigger a log line that repeats identically many times in quick succession (e.g. a spammy framework warning).
2. Open the log viewer or exported log file.
3. Observe each repeated line listed individually with no `(x54)`-style grouping, contradicting README:113.

**Frequency:** Always

## Root Cause

The deduplicator class exists but its `process()` method is never invoked from the capture path. It was likely disabled during a refactor and the README was not updated to match.

## Proposed Fix

Either wire `Deduplicator.process()` back into the capture pipeline (gated by a setting), or remove the claim from README. If re-enabling, add a `deduplication.enabled` setting (default true) and a `deduplication.threshold` for minimum repeat count.

## Changes Made

- README no longer makes the `(x54)` grouping claim — verified via repo-wide grep for
  `dedup`/`x54` in `README.md`, no match; the misleading documentation was already
  corrected in an earlier pass.
- `.github/copilot-instructions.md` still has a stale dedup claim at line 20, but that
  file is gitignored (`git status` confirms it is untracked/ignored) and is never
  shipped or read by users — left as-is per scope; it is local-machine-only guidance,
  not a repo artifact.
- Re-verified the `Deduplicator` class (`src/modules/capture/deduplication.ts`) against
  the "dead code" premise in this pass's task list: it is **not** dead code. It is
  imported and instantiated in `LogSession` (`log-session.ts:11,74,105`), and
  `flush()`/`reset()` are still called from `stop()` and `clear()`. Only `process()` —
  the method that actually performs the line-folding — is never called, which is the
  documented, intentional bypass: `log-session.ts:445-450` carries a comment explaining
  capture-side deduplication is bypassed by design (every raw line is written; see the
  `drainPendingLines` rationale) and that `flush()`/`reset()` are kept as defensive
  no-ops "in case a future code path resurfaces capture-side folding." Deleting the
  class would contradict that documented intent and break `deduplication.test.ts` /
  `log-session.test.ts`, which still exercise `Deduplicator` directly. Not deleted.
- Net effect: the misleading claim is gone from shipped docs; the underlying feature
  remains intentionally disabled (not a defect to "clean up" as dead code) — re-enabling
  it, if wanted, is the original proposed fix (a `deduplication.enabled` setting), which
  is out of scope for this dead-code pass.

## Tests Added

None — no code behavior changed; `Deduplicator` was confirmed live (not dead) and left
untouched, and README was already corrected before this pass.

## Commits
<!-- Add commit hashes as fixes land. -->

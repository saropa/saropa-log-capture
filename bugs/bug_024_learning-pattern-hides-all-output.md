# Bug 024 — Learning pattern can hide all output

## Status: Fixed

## Severity: High

A short common-prefix heuristic lets dismissing a handful of lines create a persisted pattern that hides all app output.

## Problem

The learning pattern extractor uses a 12-character Longest Common Prefix (LCP) heuristic. Dismissing just 4 identical lines can create a framework-category pattern that matches all app output, effectively hiding everything the user cares about. The pattern is persisted and applies to future sessions.

## Reproduction

1. Dismiss 4 lines that happen to share a short (12-char) common prefix
2. Observe a new learned pattern is created and persisted
3. Restart or continue the session
4. Observe the pattern now hides unrelated app-category lines sharing that prefix

**Frequency:** Intermittent (depends on line content, but easily triggered)

## Root Cause

The LCP threshold is too short (12 chars), and there's no validation that the resulting pattern doesn't match an unreasonable percentage of app-category lines.
(`src/modules/learning/pattern-extractor.ts:86-133`)

## Proposed Fix

Increase the minimum LCP length. Add a guard: if a candidate pattern matches >50% of recent app-category lines, reject it with a warning. Add an "undo last learning" action.

## Changes Made

Verified both pieces of the proposed fix are in place in `src/modules/learning/pattern-extractor.ts`:
- `MIN_PREFIX_LEN` raised from 12 to 24 chars — a shared prefix that short is common by coincidence (timestamps, tags, English preambles); 24 chars demands a far more specific match before a candidate is even considered.
- `MAX_RECENT_LINE_MATCH_RATIO` (0.5) guard in `extractPatterns()`: any prefix-derived ("framework"/"noise") candidate that matches more than 50% of the user's actual recent lines (not just the dismissed subset that produced it) is rejected outright and logged via `logExtensionWarn`, independent of its computed confidence score.

"Undo last learning action" from the original proposed fix is **not implemented** — it is a new user-facing feature (a persisted-pattern rollback action, its own UI entry point, and interaction-log bookkeeping), not a bug fix, so it is out of scope for this pass. Tracked as future work; the current guard rails (longer prefix threshold + broad-match rejection) already prevent the reported failure mode without it.

No test added in this pass per task scope.

## Tests Added
<!-- List new or updated test files. -->

## Commits
<!-- Add commit hashes as fixes land. -->

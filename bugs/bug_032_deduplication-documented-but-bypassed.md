# Bug 032 — Deduplication documented but bypassed

## Status: Open

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
<!-- Fill in when a fix is written. -->

## Tests Added
<!-- List new or updated test files. -->

## Commits
<!-- Add commit hashes as fixes land. -->

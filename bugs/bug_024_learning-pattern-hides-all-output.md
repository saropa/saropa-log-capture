# Bug 024 — Learning pattern can hide all output

## Status: Open

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
<!-- Fill in when a fix is written. -->

## Tests Added
<!-- List new or updated test files. -->

## Commits
<!-- Add commit hashes as fixes land. -->

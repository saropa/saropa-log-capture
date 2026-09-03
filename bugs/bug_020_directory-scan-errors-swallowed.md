# Bug 020 — Directory scan errors swallowed

## Status: Open

## Severity: High

Silent failures on session history scan errors leave users unable to tell "no logs" from "scan broke."

## Problem

When the session history directory scan fails (permissions error, EMFILE, corrupt `.session-metadata.json`), the error is caught with `catch { return []; }` and no logging. The user sees a blank "No sessions found" message with no way to distinguish "no logs exist" from "scan failed." No error appears in the output channel.

## Reproduction

1. Corrupt or lock the session history directory / `.session-metadata.json`
2. Open the session history view
3. Observe "No sessions found" with no indication a scan error occurred

**Frequency:** Intermittent (depends on filesystem/permission state)

## Root Cause

Catch block returns empty array without logging to the output channel.
(`src/ui/session/session-history-fetching.ts:96-98,:231-234`)

## Proposed Fix

Log the error to the `Saropa Log Capture` output channel. Show a different message when the scan fails vs. when no sessions exist ("Failed to scan sessions — check Output panel" vs. "No sessions found").

## Changes Made
<!-- Fill in when a fix is written. -->

## Tests Added
<!-- List new or updated test files. -->

## Commits
<!-- Add commit hashes as fixes land. -->

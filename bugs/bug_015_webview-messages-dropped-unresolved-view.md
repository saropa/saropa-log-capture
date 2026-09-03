# Bug 015 — Webview messages dropped on unresolved view

## Status: Open

## Severity: High

Commands post to a webview before it is resolved, and messages are silently dropped.

## Problem

8+ commands `postMessage` to a webview that may not be resolved yet. Messages are silently dropped. The code itself has a comment acknowledging this: "posting immediately would hit empty view set and be silently dropped." No wait-loop or ready check was implemented.

Affected: `explainRootCauseHypotheses`, `openSqlQueryHistory`, `copyAllFilteredLines`, `toggleSearchOverlay`, `gotoLineInViewer`, plus 3 more.

(`src/commands-signals.ts:13-21`, `src/commands-tools.ts:23-31,141-188`)

## Reproduction

1. Immediately after activation (before opening the log viewer), run one of the affected commands
2. Observe no effect — the webview never receives the message

**Frequency:** Intermittent (depends on webview resolution timing)

## Root Cause

Commands post immediately without waiting for the webview to resolve. The webview may not exist or may not have finished initializing.

## Proposed Fix

Add a `waitForWebview()` helper that resolves when the target webview is ready (or times out with a user-facing message). Use it before every `postMessage` call from command handlers.

## Changes Made
<!-- Fill in when a fix is written. -->

## Tests Added
<!-- List new or updated test files. -->

## Commits
<!-- Add commit hashes as fixes land. -->

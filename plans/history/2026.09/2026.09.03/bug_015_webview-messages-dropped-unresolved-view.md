# Bug 015 — Webview messages dropped on unresolved view

## Status: Fixed

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

Added a shared `ensureWebviewReady()` / `ensureWebviewReadyOrWarn()` helper
(`src/commands-webview-ready.ts`) that focuses the sidebar log viewer and polls
(50ms interval, 1s budget) for `LogViewerProvider.getView()` to resolve before a
command posts to it. `ensureWebviewReadyOrWarn()` additionally surfaces
`msg.openLogViewerFirst` on timeout.

Applied across command handlers (an earlier pass covered `commands-tools.ts`;
this pass closed the remaining gaps):

- `showSignals` (`src/commands-signals.ts`) — was already gated in a prior pass.
- `openSignal` (`src/commands-suite.ts`) — replaced its own duplicated inline
  20×50ms poll with the shared `ensureWebviewReadyOrWarn()` call.
- `openSqlHistoryForFingerprint` (`src/commands-suite.ts`) — had NO wait gate at
  all (posted through `deps.broadcaster.postToWebview()` immediately); now async
  and gated the same way.
- `refreshRecurringSignals` (`src/commands-signals.ts`) — had NO wait gate; this
  command fires automatically 3s after every capture finishes
  (`session-lifecycle-finalize.ts`), so it uses the silent `ensureWebviewReady()`
  variant (not "...OrWarn") to avoid popping a warning toast on every capture end
  when the viewer happens to be closed — consistent with the "signals stay
  passive" UX rule for this feature.

## Tests Added
<!-- No new automated test file added; verified via `npx tsc --noEmit` (0 errors) and `npx eslint` on the touched files. -->

## Commits
<!-- Add commit hashes as fixes land. -->

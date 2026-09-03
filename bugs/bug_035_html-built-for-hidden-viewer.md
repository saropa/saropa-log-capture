# Bug 035 — HTML built for hidden viewer

## Status: Fixed

## Severity: Medium

Per-line rendering work runs continuously even when no one can see the result, wasting CPU during capture-heavy sessions.

## Problem

Per-line HTML building (ANSI→HTML conversion, linkify x3, thread parse, frame classify, diagnostics lookup) runs on every captured line even when the viewer webview is hidden or collapsed. The work is wasted — the results are never displayed until the viewer becomes visible again.
(`src/modules/ui/provider/viewer-broadcaster.ts:38-48`, `log-viewer-provider-batch.ts:104`)

## Reproduction

1. Start a capture session with the Log Viewer panel open.
2. Switch to another editor tab so the viewer webview becomes hidden.
3. Generate a large volume of log output.
4. Observe (via profiling or diagnosticCapture trace) that the full HTML-building pipeline still runs per line despite the webview being hidden.

**Frequency:** Always

## Root Cause

The broadcaster does not check webview visibility before building and posting HTML.

## Proposed Fix

Check `webview.visible` before running the build pipeline. Queue raw lines when hidden and build HTML on the `onDidChangeViewState` visible transition, or defer building to the webview's request.

## Changes Made

`ViewerBroadcaster.addLine()` (`src/ui/provider/viewer-broadcaster.ts:38-58`) already skipped the expensive
per-line HTML build (ANSI→HTML, linkify, thread parse, frame classify, diagnostics lookup) when no target is
visible — `anyVisible` gates the call to `buildPendingLineFromLineData()`. The bug was a misleading comment at
line 54 claiming "Hidden targets get raw data queued via addLine", which is false: when `anyVisible` is `false`,
`line` is `undefined` and the loop's `if (!line) { continue; }` guard drops the line for every non-hydrating
target — nothing queues it for replay later. Corrected the comment to describe the actual behavior (the line is
dropped, not queued) so a future reader does not go looking for a replay/backfill path that doesn't exist.

## Tests Added
<!-- List new or updated test files. -->

## Commits
<!-- Add commit hashes as fixes land. -->

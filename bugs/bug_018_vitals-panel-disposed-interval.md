# Bug 018 — Vitals panel disposed interval

## Status: Open

## Severity: High

The Vitals panel's auto-refresh interval outlives the panel and throws on a disposed webview.

## Problem

The Vitals panel starts a `setInterval` for 5-minute auto-refresh but has no `onDidDispose` handler. When the panel is hidden or closed, the interval continues. Assigning to `this.view.webview.html` on a disposed webview throws an unhandled exception.

(`src/ui/panels/vitals-panel.ts:19-43`)

## Reproduction

1. Open the Vitals panel
2. Close the panel
3. Wait for the next 5-minute refresh interval to fire
4. Observe an unhandled exception when the interval tries to update the disposed webview

**Frequency:** Always (after panel close, on next interval tick)

## Root Cause

Missing lifecycle cleanup — no dispose handler registered to clear the interval.

## Proposed Fix

Register an `onDidDispose` handler that calls `clearInterval`. Also check `this.view.visible` before refreshing, since hidden panels don't need updates.

## Changes Made
<!-- Fill in when a fix is written. -->

## Tests Added
<!-- List new or updated test files. -->

## Commits
<!-- Add commit hashes as fixes land. -->

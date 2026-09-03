# Bug 018 — Vitals panel disposed interval

## Status: Fixed

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

`VitalsPanelProvider` (`src/ui/panels/vitals-panel.ts`):

- `resolveWebviewView` now registers `webviewView.onDidDispose(() => this.dispose())`, so closing the panel clears the auto-refresh interval instead of leaving it to fire against a disposed webview.
- Each tick also checks `this.view?.visible` before calling `refresh()`, so a hidden-but-not-yet-disposed panel (user switched to another sidebar view) skips the background network query and there is no race between a tick and a dispose landing between ticks.
- **This session's fix:** `refreshTimer` was moved from a module-level `let` to an instance field (`private refreshTimer: ReturnType<typeof setInterval> | undefined`). VS Code only ever registers one `VitalsPanelProvider` today, so this was not user-visible, but a module-level timer is a latent correctness trap for any future second instance (e.g. a pop-out variant) — it would silently clear the first instance's interval on dispose, or leak an interval nothing tracks. The instance field ties the timer's lifetime 1:1 to the panel that owns it.

## Tests Added
None — no existing test file covers `VitalsPanelProvider`; manual verification only (open panel, close it, confirm no exception on the next refresh interval).

## Commits
<!-- Add commit hashes as fixes land. -->

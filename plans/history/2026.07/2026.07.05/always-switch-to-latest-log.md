# Always Switch to Latest Log

A new user setting makes the log viewer follow the newest run automatically. Previously a newer log only surfaced a passive banner and required a click on "Open"; the viewer never switched on its own.

## Finish Report (2026-07-05)

### Objective

Add a user-facing option that switches the viewer to the latest log as soon as it appears, and ship it enabled by default so the viewer follows the most recent run out of the box.

### Change summary

- **New setting `saropaLogCapture.autoSwitchToLatest` (boolean, default `true`).** Declared in `package.json` alongside its `newerLogBanner` / `newerLogDot` siblings using inline manifest strings (no `%key%` NLS indirection), matching the exact style of those two settings in the same feature family. Read in `getConfig()` and typed as `autoSwitch` on `NewerLogAlertConfig`.
- **Behavior hook** lives in the `historyProvider.onDidChangeTreeData` callback in `src/extension-activation.ts`, immediately after `computeLogContextInfo` produces the log-context payload. That callback fires the instant a newer controller log can appear (file-watcher create, split-part rotation, another window, session end), which is why it is the correct single hook — a session-start-only hook (`applySessionStartedState`) would miss the non-DAP cases.
- The decision is an extracted pure predicate, `shouldAutoSwitchToLatest(info, autoSwitchEnabled)`, in `src/ui/provider/viewer-log-context.ts`, so it is unit-testable without the Extension Host (mirrors the existing `shouldAutoLoad` extraction).

### Correctness invariants

- **Anti-loop.** The predicate requires `stale`, which is mtime-based (`newerCount > 0`). Once the viewer loads `latestUri`, that log becomes the newest controller, `newerCount` drops to 0, `stale` clears, and the next tree refresh is a no-op. No reload loop.
- **First visit.** When nothing is open (`currentUri` empty) `newerCount` is 0 → `stale` false, so auto-switch never fires against an empty viewer and never fights the first-visit `autoLoadLatest` path.
- **Live tail.** A live-streaming session is always its own `currentUri` (marked by `broadcaster.setCurrentFile` in `applySessionStartedState`) and therefore the newest controller, so auto-switch only ever targets finished / other-window logs — never the active tail. The load is deliberately non-tail; adding `{ tail: true }` would start a second tail on a static file and could fight the live session. This reasoning is recorded at the call site.
- **Focus.** `loadFromFile` reveals the panel with `show(true)` (`preserveFocus = true`), so editor focus is not stolen; a collapsed Logs panel is expanded.

### Scope classification

VS Code extension (TypeScript). No Flutter/Dart, no runtime l10n catalog change, no webview message change — host-side behavior only.

### Tests

- `src/test/ui/viewer-log-context.test.ts` — added a `shouldAutoSwitchToLatest` suite (5 cases): switches when enabled + newer + different; no switch when setting off; no switch when open log is already latest (anti-loop); no switch when nothing open (first-visit); no switch on a newer peripheral. File: 11 passing.
- `src/test/modules/config/integration-settings-manifest.test.ts` — added an assertion pinning `autoSwitchToLatest` to `type: boolean`, `default: true`, guarding against a silent manifest/reader revert of the shipped ON behavior. File: 7 passing.
- `npm run check-types` clean; `npm run compile-tests` clean.

### Known limitations / follow-ups (not addressed)

- Pop-out panel keeps its own `currentFileUri`; auto-switch updates the sidebar viewer, not the pop-out. Consistent with existing `onOpenBookmark` / openLog paths, not a regression.
- While the Logs panel is closed (`views.size === 0`), each refresh with a newer log re-fires a bounded ~1s no-op load. Harmless (generation-guarded) but wasteful churn.
- The `latestUri !== currentUri` comparison round-trips a URI through `Uri.parse().toString()`. Stable for canonical Windows file URIs (the only kind these logs use); a non-canonical controller URI would leave `stale` true and reload each refresh. Low likelihood today; a shared Uri-equality helper would centralize this across the auto-load paths.

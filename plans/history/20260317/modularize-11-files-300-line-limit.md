# Modularize 11 Files Over 300-Line Limit

**Status:** Completed  
**Date:** 2026-03-17  
**Type:** Refactoring

## Summary

Eleven TypeScript files exceeded the ESLint `max-lines` limit (300, excluding blank lines and comments). Each was split into one or more focused modules following existing patterns (e.g. `viewer-message-handler-panels`, `session-manager-events`, `log-viewer-provider-load`). No behavior or public API changes; all tests and lint pass.

## Files modularized

| Original file | New modules |
|---------------|-------------|
| `src/commands-export.ts` | `commands-export-insights.ts`, `commands-export-helpers.ts` |
| `src/modules/capture/log-session.ts` | Extended `log-session-helpers.ts` (getLogDirUri, computeElapsed) |
| `src/modules/investigation/investigation-search.ts` | `investigation-search-file.ts` |
| `src/modules/investigation/investigation-store.ts` | `investigation-store-io.ts`, `investigation-store-workspace.ts` |
| `src/modules/session/session-manager.ts` | `session-manager-routing.ts`, `session-manager-start.ts`, `session-manager-stop.ts` |
| `src/ui/panels/viewer-performance-panel.ts` | `viewer-performance-trends.ts`, `viewer-performance-session-tab.ts` |
| `src/ui/provider/log-viewer-provider.ts` | `log-viewer-provider-state.ts` |
| `src/ui/provider/viewer-content.ts` | `viewer-content-body.ts`, `viewer-content-scripts.ts` |
| `src/ui/provider/viewer-message-handler.ts` | `viewer-message-handler-actions.ts`, `viewer-message-handler-investigation.ts` |
| `src/ui/viewer/viewer-replay.ts` | `viewer-replay-timing.ts`, `viewer-replay-controls.ts` |
| `src/ui/viewer-panels/viewer-session-panel.ts` | `viewer-session-panel-investigations.ts`, `viewer-session-panel-events.ts` |

## Verification

- TypeScript compiles (`npm run compile`)
- ESLint passes with `--max-warnings 0` on all 11 original files and new modules
- Full test suite passes (`npm run test`)

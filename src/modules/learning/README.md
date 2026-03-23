# Noise learning (`src/modules/learning`)

Workspace-local feature (Plan **025**): learn from log viewer interactions and suggest `saropaLogCapture.exclusions` patterns. Nothing is uploaded.

## Data flow

1. **Capture** — `InteractionTracker` buffers `UserInteraction` rows (truncate with `learning.maxStoredLineLength`). Sources:
   - Webview `trackInteraction` (`dismiss` on full stack collapse, optional `skip-scroll`).
   - Extension host: new exclusion via `viewer-handler-wiring` (`add-exclusion`), bookmark (`explicit-keep`).
2. **Persist** — `LearningStore` writes `InteractionBatch[]` + suggestion rows under workspace `Memento` key `saropaLogCapture.learning.v1` (90-day batch trim, cap 500 batches).
3. **Extract** — `extractPatterns()` (heuristic prefix + repetitive lines; `skip-scroll` down-weighted) produces candidates validated with `parseExclusionPattern` / `testExclusion` (respects **explicit-keep**).
4. **Suggest** — `SuggestionEngine.refreshAndListPending()` merges with persisted pending/accepted/rejected; skips patterns already in workspace exclusions or user-rejected.
5. **UI** — Commands + optional deferred notification (`learning-notifications.ts`); QuickPick accept updates settings then `ViewerBroadcaster.setExclusions`.

## Extension wiring

- `initLearningRuntime` / `flushLearningBuffer` — `extension-activation.ts` (flush on dispose).
- `trackInteraction` — `viewer-message-handler.ts` → `learning-viewer-message.ts`.
- Webview flags — `setLearningOptions` via `postToWebview` + `learning-webview-options.ts`.

## Tests

- `src/test/modules/learning/pattern-extractor.test.ts` — thresholds, repetitive signal, explicit-keep guard.
- `src/test/modules/learning/interaction-tracker.test.ts` — concurrent flush must not drop events.

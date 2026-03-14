# Modularize 300-Line Limit (Batch 2)

**Status:** Completed  
**Date:** 2026-03-13  
**Type:** Refactoring (quality check compliance)

## Summary

Modularized 6 of the 14 files that exceeded the 300-line limit in Step 9 of the publish pipeline. No behavior or API changes; all tests pass.

## Files split

| Original | Action |
|----------|--------|
| `src/commands-investigation.ts` | Extracted share/export into `investigation-commands-share.ts`, `investigation-commands-export.ts`; added `TreeItem` import. |
| `src/l10n.ts` | Moved string tables to `l10n/strings-a.ts`, `l10n/strings-b.ts`; main file merges and exports `t()`. |
| `src/modules/export/slc-bundle.ts` | Extracted types to `slc-types.ts`, session helpers to `slc-session-files.ts`, session export/import to `slc-session.ts`, investigation build/export/import to `slc-investigation.ts`; bundle dispatches and re-exports. |
| `src/modules/integrations/providers/build-ci.ts` | Extracted API fetchers (GitHub/Azure/GitLab) and helpers to `build-ci-api.ts`; provider and file-based logic remain. |
| `src/ui/viewer-styles/viewer-styles-crashlytics.ts` | Extracted setup and diagnostic CSS to `viewer-styles-crashlytics-setup.ts`. |
| `src/ui/viewer-styles/viewer-styles-options.ts` | Extracted integrations/shortcuts CSS to `viewer-styles-options-extra.ts`. |

## Fixes during review

- **commands-investigation.ts:** Restored `TreeItem` import from `session-history-grouping` for `InvestigationCommandDeps.historyProvider` type.
- **build-ci-api.ts:** Replaced dynamic `import('../../../source/link-helpers.js')` with static `import` from `../../source/link-helpers` to satisfy Node16 module resolution and avoid missing-module errors.

## Remaining over limit (unchanged this batch)

- `viewer-crashlytics-panel.ts`, `viewer-performance-panel.ts`, `viewer-message-handler.ts`, `viewer-replay.ts`, `log-viewer-provider.ts`, `session-manager.ts`, `investigation-store.ts` — to be addressed in a follow-up if needed.

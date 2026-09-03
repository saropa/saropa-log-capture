# Bug 005 — "Explain with AI" command is never registered

## Status: Fixed

## Severity: Critical

The "Explain with AI" button in the analysis panel is permanently non-functional.

## Problem

The "Explain with AI" button in the analysis panel calls `vscode.commands.executeCommand('saropaLogCapture.explainError')`, but no `registerCommand` for this command ID exists anywhere in the source. The resulting "command not found" error is swallowed, so the button silently always shows "AI unavailable" with no diagnostic information for the user or in the output channel.

## Reproduction

1. Open the analysis panel on any captured error.
2. Click "Explain with AI".
3. Observe "AI unavailable" is shown with no further detail.
4. Search the codebase for `registerCommand.*explainError` — zero matches.

**Frequency:** Always

## Root Cause

The command was wired into the UI (`src/ui/analysis/analysis-error-actions.ts:60`) but the corresponding `vscode.commands.registerCommand('saropaLogCapture.explainError', ...)` handler was never implemented, so every invocation fails with "command not found," which is caught and mapped to a generic "unavailable" message.

## Proposed Fix

Either register the command with a proper handler that invokes the AI context builder (`src/modules/ai/ai-context-builder.ts`) and surfaces the result, or remove the "Explain with AI" button from the analysis panel until the feature is complete. Add a smoke test asserting every command referenced via `executeCommand` in the UI has a matching `registerCommand`.

## Changes Made

- The "Explain with AI" button and its `handleAiExplain()` handler (which called the
  never-registered `saropaLogCapture.explainError` command) were already removed from
  `src/ui/analysis/analysis-error-actions.ts` / `analysis-error-render.ts` in an earlier
  pass — verified against current source, both are gone and the button no longer renders.
- Follow-up cleanup in this pass: the `viewer.analysis.aiUnavailable` l10n key
  (`src/l10n/strings-viewer-d.ts`) was left behind with zero remaining callers after that
  removal — verified via repo-wide grep, no `t('viewer.analysis.aiUnavailable')` call
  and no bundle (`l10n/bundle.l10n*.json`) entry existed. Removed the source key.
- Note: AI-explain functionality itself is not dead — `explainError()` in
  `src/modules/ai/ai-explain.ts` is live and wired through the webview message handler
  (`viewer-message-handler-actions.ts` / `viewer-message-handler-root-cause-ai.ts`), just
  not through the removed VS Code command path.

## Tests Added

None — this pass only removed unreferenced l10n scaffolding; no behavior changed.

## Commits
<!-- Add commit hashes as fixes land. -->

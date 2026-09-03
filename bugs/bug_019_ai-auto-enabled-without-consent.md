# Bug 019 — AI auto-enabled without consent

## Status: Open

## Severity: High

AI features are silently enabled in the user's global settings without any prompt or opt-in.

## Problem

On every activation, if `vscode.lm` API exists and the user has never explicitly set `ai.enabled`, the extension silently writes `ai.enabled=true` to the user's global VS Code settings. No notification, no prompt, no opt-in. This contrasts with `screenshot-dedup-default-notice.ts` which shows a notice.

(`src/modules/ai/ai-auto-enable.ts:8-28`, called at `src/extension-activation.ts:402`)

## Reproduction

1. Ensure `ai.enabled` has never been explicitly set
2. Use an environment where `vscode.lm` API is available
3. Activate the extension
4. Inspect global user settings — `ai.enabled` is now `true` with no notification shown

**Frequency:** Always

## Root Cause

Auto-enable logic intended to "discover" AI capability and enable it, but implemented as a silent global settings mutation.

## Proposed Fix

Either remove the auto-enable and let the user opt in via settings, or show a notification like `screenshot-dedup-default-notice.ts` does: "AI features are available. Enable?" with Accept/Dismiss buttons.

## Changes Made
<!-- Fill in when a fix is written. -->

## Tests Added
<!-- List new or updated test files. -->

## Commits
<!-- Add commit hashes as fixes land. -->

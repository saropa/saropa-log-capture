# Bug 049 — "Previous extension still installed" toast fires against itself

## Status: Closed

## Severity: Medium

Every user sees a false warning on every activation, telling them to uninstall the extension they are running. Reads as a conflict that does not exist.

## Problem

On every activation this warning toast appears:

```
The previous "Saropa Log Capture" extension is still installed. Uninstall it: Saropa Capture replaces it and running both causes conflicts.
```

The Extensions list shows exactly one "Saropa Log Capture" entry (the running one). No second extension exists.

## Reproduction

1. Install the published Saropa Log Capture
2. Open any workspace
3. Toast appears on activation

**Frequency:** Always

## Root Cause

State after the 9.8.0 rename and the `saropa.saropa-capture` duplicate being unpublished (see bug 127):

- Settings and command prefix: **renamed** to `saropaCapture.*` (133 commands in `package.json`, none under `saropaLogCapture.*`)
- Extension ID: **unchanged**, still `saropa.saropa-log-capture` (`package.json` `name`)
- Display name: still "Saropa Log Capture" pending Marketplace release of the name (bug 127)

`src/legacy-compat.ts:18` sets `oldExtensionId = 'saropa.saropa-log-capture'`. `warnIfOldExtensionInstalled()` (line 115) calls `vscode.extensions.getExtension(oldExtensionId)`, which returns the running extension itself, so the warning always fires.

The settings migration and command aliases in the same module are still correct and required: they cover the shipped prefix rename.

## Proposed Fix

Guard only the warning, not the module. Skip it when the running extension is the one being checked for. Use one module-level constant so the ID is declared once.

```typescript
// Extension ID of the build that shipped before the prefix rename.
const oldExtensionId = 'saropa.saropa-log-capture';

function warnIfOldExtensionInstalled(context: vscode.ExtensionContext): void {
    // The ID did not change in the rename, so the "old" extension is this one;
    // warning would be a false positive. Only warn when a different extension holds the old ID.
    if (context.extension.id.toLowerCase() === oldExtensionId) { return; }
    if (!vscode.extensions.getExtension(oldExtensionId)) { return; }
    void vscode.window.showWarningMessage(t('msg.legacyExtensionInstalled'));
}
```

Call site in `activateLegacyCompat` passes `context`. `registerLegacyCommandAliases` and `migrateLegacySettings` stay unchanged.

Open decision: with the ID unchanged, the warning can never fire. Either keep the guarded function for a future ID change, or delete `warnIfOldExtensionInstalled`, the `msg.legacyExtensionInstalled` string in `src/l10n/strings-a.ts`, `l10n/bundle.l10n.json`, and the CHANGELOG line "Warning when the previous ... is still installed". Deleting is simpler (no dead code).

## Relation to bug 127

Independent. Bug 127 changes only `displayName` in the NLS files. It does not change the extension ID, so it does not fix or depend on this bug. This fix does not need to wait for 127.

## Changes Made

Chose the delete option (not the guard): the extension ID is unchanged, so a second extension can never hold the old ID and guarded code would be dead.

- `src/legacy-compat.ts`: removed `warnIfOldExtensionInstalled`, the `oldExtensionId` constant, and the call site. Settings migration and command aliases untouched.
- `src/l10n/strings-a.ts` and `l10n/bundle.l10n.json`: removed `msg.legacyExtensionInstalled`.
- `CHANGELOG.md`: `[Unreleased]` Fixed entry; removed the 9.8.0 line announcing the warning.

## Tests Added

<!-- Regression test: with context.extension.id equal to the old ID, no warning is shown. -->

## Commits

<!-- Add commit hashes as fixes land. -->

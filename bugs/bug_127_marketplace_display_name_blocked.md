# Bug 127 — Marketplace blocks display name "Saropa Capture"

## Status: Open

<!-- Status values: Open → Investigating → Fix Ready → Fixed (pending review) → Closed -->

## Severity: Medium

The extension publishes under its old display name "Saropa Log Capture" instead of the intended "Saropa Capture". Users see the old branding. Not a crash, but blocks the rename that shipped in 9.8.0.

## Problem

Publishing to the VS Code Marketplace with `displayName: "Saropa Capture"` fails:

```
Upload Error
This extension display name is taken. Please try a different one.
```

The name is reserved by the unpublished duplicate listing `saropa.saropa-capture`, which was accidentally created during the 9.8.0 packaging (see plan 126). The duplicate has been unpublished from both the Marketplace and Open VSX, but the Marketplace still holds the display name reservation.

## Reproduction

1. Set `displayName` to `"Saropa Capture"` in `package.nls.json`
2. Run `python scripts/publish.py`
3. Marketplace rejects the upload with the "display name is taken" error

**Frequency:** Always (as of 2026-11-20)

## Root Cause

The VS Code Marketplace retains display name reservations from unpublished extensions. Email sent to VSMarketplace@microsoft.com on 2026-11-20 requesting release.

## Proposed Fix

Once Microsoft confirms the display name reservation is released:

1. Change `"displayName"` from `"Saropa Log Capture"` back to `"Saropa Capture"` in all 11 NLS files (`package.nls.json` and each `package.nls.<locale>.json`)
2. Remove the NLS file entries from the allowlist in `scripts/modules/verify/verify-no-old-name.mjs` (lines added in commit `2c4b44b5`)
3. Update CHANGELOG with the name change
4. Publish

## Changes Made

<!-- Fill in when Microsoft releases the name. -->

## Tests Added

<!-- No new tests needed — compile-time `verify:no-old-name` guard already covers this. -->

## Commits

- `2c4b44b5` revert displayName to Saropa Log Capture for publishing (workaround)

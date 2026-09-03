# Bug 042 — Dead setting: deemphasizeFrameworkLevels

## Status: Open

## Severity: Medium

Users who toggle `deemphasizeFrameworkLevels` see no effect; the setting is shipped but non-functional.

## Problem

The setting `deemphasizeFrameworkLevels` is still declared in `package.json` and shipped to users, but has zero references in non-test source code. Test code at `src/test/ui/viewer-data-helpers-render-fw-muted.test.ts:21-24` explicitly marks it as deprecated. Users who toggle this setting see no effect.

## Reproduction

1. Open Settings and toggle `saropaLogCapture.deemphasizeFrameworkLevels`.
2. Observe framework-level error/warning coloring in the viewer.
3. Note no visible change regardless of the toggle state.

**Frequency:** Always.

## Root Cause

The setting's implementation was removed during a refactor but the manifest declaration and test were not cleaned up.

## Proposed Fix

Remove the setting from `package.json`. Remove or update the test. If the feature is wanted, re-implement it; if not, add a deprecation migration that removes it from user settings on activation.

## Changes Made
<!-- Fill in when a fix is written. -->

## Tests Added
<!-- List new or updated test files. -->

## Commits
<!-- Add commit hashes as fixes land. -->

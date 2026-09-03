# Bug 027 — Annotation DOM height unmeasured

## Status: Open

## Severity: Medium

Annotated rows are taller in the DOM than the virtual-scroll height calculation assumes, causing cumulative scroll drift.

## Problem

Annotations render as a sibling `<div>` block after the `.line` element, but `calcItemHeight()` always returns the plain `ROW_HEIGHT` constant regardless of whether an annotation is present. The DOM is taller than the prefix-sum heights assume, causing cumulative scroll drift proportional to the number of annotated rows.

## Reproduction

1. Add annotations to several lines spread throughout a long session
2. Scroll through the viewer
3. Observe increasing misalignment between scrollbar position and visible content as more annotated rows are scrolled past

**Frequency:** Always (scales with annotation count)

## Root Cause

The virtual scroll height calculation doesn't account for the extra height added by annotation blocks.
(`viewer-data-helpers-render.ts:274,392,397`, `viewer-styles-content.ts:230-236`)

## Proposed Fix

Add annotation height to `calcItemHeight()` when an annotation is present on the item. Use a fixed annotation height constant or measure it once on first render.

## Changes Made
<!-- Fill in when a fix is written. -->

## Tests Added
<!-- List new or updated test files. -->

## Commits
<!-- Add commit hashes as fixes land. -->

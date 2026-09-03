# Bug 027 — Annotation DOM height unmeasured

## Status: Fixed

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

`calcItemHeight()` in `viewer-data-helpers-core.ts` already adds `ANNOTATION_HEIGHT` for a
line that has an annotation. The remaining bug was that `setAnnotation()` and
`handleLoadAnnotations()` in `viewer-annotations.ts` mutated the `annotations` map and then
called `renderViewport(true)` directly, without calling `recalcHeights()` first.
`recalcHeights()` is what walks `allLines` and rebuilds each row's `.height` (and the
prefix-sum `totalHeight`) — skipping it left the viewport rendering against stale heights
computed before the annotation existed, so every annotated row after the first caused
cumulative scroll drift. This affected both interactively-added annotations
(`setAnnotation`) and annotations restored on session reload (`handleLoadAnnotations`).

## Proposed Fix

Call `recalcHeights()` in both `setAnnotation()` and `handleLoadAnnotations()` immediately
after the `annotations` map is mutated and before `renderViewport(true)` is called.

## Changes Made

- `src/ui/viewer/viewer-annotations.ts`: added `recalcHeights()` calls in `setAnnotation()`
  and `handleLoadAnnotations()`, before `renderViewport(true)`, with comments explaining why
  the height rebuild must precede the render.

## Tests Added
<!-- List new or updated test files. -->

## Commits
<!-- Add commit hashes as fixes land. -->

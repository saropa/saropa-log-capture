# Bug 004 — DB-Signal Markers Survive the Level Filter

## Status: Fixed

## Problem

With the "Errors Only" preset (or any preset that disables the `database` level), DB-signal annotation markers like `DB timestamp burst (3 queries at same instant)` still render in the log viewer. The user sees a non-error annotation above the log while expecting only error rows.

```
> DB timestamp burst (3 queries at same instant)
```

Same pattern affects every detector in the db-signal pipeline (timestamp burst, slow-query burst, N+1).

## Environment

- VS Code version: any
- Extension version: 7.5.4 / Unreleased
- Source: Drift / SQL debug interceptors
- Detectors: `viewer-db-detector-timestamp-burst-embed.ts`, slow-burst, N+1

## Reproduction

1. Open a log that contains 3+ Drift `SELECT` calls with the same timestamp (e.g. a normal Flutter app boot fanning out queries).
2. Apply the "Errors Only" preset (toolbar → 3/8 dropdown → Errors Only).
3. Observe: the `DB timestamp burst (...)` marker still renders above the log even though no `database`-level lines are visible.

**Frequency:** Always (any narrowed level filter that excludes `database`).

## Root Cause

`viewer-level-filter.ts:33` skips markers entirely — by design, since structural markers (session breaks, run separators) must always be visible. DB-signal markers were therefore relying on a second pass — `applyDbSignalMarkerVisibility()` in [src/ui/viewer/viewer-data-marker-filter.ts](src/ui/viewer/viewer-data-marker-filter.ts) — to set `markerHidden` based on the visibility of the marker's anchor SQL line.

The pre-fix logic had two visibility branches:

```js
var anc = m.anchorSeq;
if (typeof anc !== 'number') { m.markerHidden = false; continue; }   // (a)
var idx = seqToIdx[anc];
if (idx == null) { m.markerHidden = false; continue; }               // (b)
m.markerHidden = isNonMarkerItemEffectivelyHidden(allLines[idx]);    // (c)
```

Both (a) and (b) defaulted to *visible* — i.e. when the marker had no anchor or the anchor line was no longer in `allLines` (compressed into a SQL repeat row, dropped by repeat-collapse, etc.), the marker stayed visible regardless of what the user's level filter said. SQL repeat-collapse moves the original DB line into a `repeat-notification` and clears the original from `allLines`, so the orphan branch (b) hit on every burst that survived past the first repeat threshold.

The same defaults shipped in the at-birth path in `viewer-data-add-db-detectors.ts:129-140` — that path scans backwards 32 entries for the anchor and falls through to `_mHidden = false` on miss, so streaming markers also defaulted to visible.

## Changes Made

### File 1: `src/ui/viewer/viewer-data-marker-filter.ts`

Added `isDbSignalLevelDisabled()` — true when the user has narrowed the level filter (`enabledLevels.size < allLevelNames.length`) and the `database` level is not in `enabledLevels`. The all-levels-on case returns `false` so the hot path is unchanged.

`applyDbSignalMarkerVisibility()` now consults this gate *before* the anchor probe. When `database` is off, every db-signal marker is hidden regardless of whether the anchor can be located. The orphan and anchor-visibility branches still apply when `database` is on, so existing behavior under the default filter is preserved.

### File 2: `src/ui/viewer/viewer-data-add-db-detectors.ts`

The at-birth marker-creation path now mirrors the recalc gate: if `isDbSignalLevelDisabled()` is true at birth, the marker is born with `_mHidden = true` so it never flashes visible during streaming. This avoids a one-frame flicker while waiting for the next `recalcHeights()` pass.

## Verification

- `npm run check-types`
- `npm run lint`
- Automated: `src/test/ui/viewer-data-marker-filter.test.ts` (tests named “bug 004”)
- Manual: load a log with Drift bursts under `Errors Only`; the `DB timestamp burst` marker should not render. Toggle `database` back on via the level filter drawer; the marker re-appears subject to the existing anchor-visibility rules.

## Notes

This fix does **not** change the project rule "never filter markers" in `.claude/rules/global.md` — that rule still applies to the level filter (`viewer-level-filter.ts`). DB-signal markers are filtered through their dedicated visibility pass, which is the intended pattern. The fix tightens that pass so it actually honors the level filter for the levels it represents.

# Replay: speeds, 0.5x display, bar visibility (resolved)

**Resolved:** 2026-03-13

## Summary

- **Speeds:** User requested additional replay speeds: 0.1x, 0.25x, 0.75x, 10x. Implemented in viewer speed dropdown and config default range (0.1–10).
- **0.5x not visible:** At half speed the dropdown did not reflect the selected value (float mismatch). Fixed by setting the speed select from closest option by numeric value (`setSpeedSelectValue`).
- **Replay options not visible in v3.3.0:** Replay bar and icon only appeared after starting replay. Bar is now shown whenever a loaded file has lines (and no active recording), so Play/Speed/Mode are visible without clicking the icon first; bar stays visible after stop.

## Changes

- `src/ui/viewer/viewer-replay.ts`: Speed options 0.1–10x; `setSpeedSelectValue()` for robust display; `setReplayEnabled` shows bar when file loaded; `exitReplayMode` keeps bar visible when still viewing file; `hasLines()` helper.
- `src/modules/config/config.ts`: `replay.defaultSpeed` clamp min 0.25 → 0.1.
- `src/ui/viewer-styles/viewer-styles-content.ts`: Replay bar fade-in animation (0.15s).

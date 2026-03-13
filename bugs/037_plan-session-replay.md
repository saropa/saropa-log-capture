# Plan: Session replay (replay log with simulated timing)

**Feature:** Replay a log session with simulated timing so lines appear at the same relative pace as during the original run (or at a configurable speed).

---

## What exists

- Replay mode or timing in viewer (elapsed prefixes, timestamps); possible "replay" or "play" already.
- Session metadata; log lines with optional timestamps.
- Viewer with virtual scroll and line rendering.

## What's missing

1. **Timing model** — Use per-line timestamps (or elapsed time) to compute delay between lines; optionally allow speed factor (0.5x, 1x, 2x).
2. **Playback control** — Play, Pause, Stop; optional scrubber to seek to a time offset; reset to start.
3. **Visual feedback** — Highlight or advance "current" line as time progresses; optional progress indicator (e.g. "Replaying 2:34 / 5:12").

## Implementation

### 1. Data

- For each line, derive "display at time T" (epoch or relative ms). If no timestamp, use previous line time + 0 or small default delay.
- Build a list of (lineIndex, displayTimeMs); sort by displayTimeMs.

### 2. Playback loop

- On Play: start from current position (or 0); schedule scrolling/highlighting at each displayTimeMs (adjusted by speed). Use setTimeout/requestAnimationFrame or a single timer that fires at next event time.
- On Pause: clear timers; keep position. On Stop: reset to start and clear.
- Scrubber: set "current time" and update visible line and highlight; pause if playing.

### 3. UI

- Replay bar or toolbar: Play, Pause, Stop; speed dropdown (0.5x, 1x, 2x); optional time scrubber and duration label.
- Viewer scrolls to keep "current" line in view (or centers it) as replay advances.

## Files to create/modify

| File | Change |
|------|--------|
| Replay timing (e.g. `src/modules/replay/replay-scheduler.ts`) | Compute line→time; drive playback with speed |
| Viewer or replay panel | Play/Pause/Stop; speed; scrubber; scroll-to-line |
| Viewer content | Accept "current replay line" and highlight or scroll |

## Considerations

- Long sessions: avoid scheduling thousands of timers; use one timer that fires at "next event" and then schedules the next.
- Timestamps: if many lines lack timestamps, document behavior (e.g. treat as same time as previous, or skip replay for those).

## Effort

**5–7 days** for play/pause/speed and scroll-to-line; **+2–3 days** for scrubber and polish.

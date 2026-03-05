# Wow Spec: Session replay with optional timing

**Status:** Implemented  
**Source:** ROADMAP §7 "Consider for Wow" #2, §4 "Wow" #7  
**Dependencies:** Existing log viewer, parsed lines with timestamps or line order  
**Related:** Viewer file loader, elapsed time display, session metadata

Implementation: Replay bar (play/pause/stop, Timed/Fast mode, speed, scrubber), command-palette Replay command, Space = play/pause, config (defaultMode, defaultSpeed, minLineDelayMs, maxDelayMs), and file-loader parsing of `[+Nms]` for per-line replay timing.

---

## 1. Overview

### 1.1 Goal

Allow the user to **replay** a saved log session in the viewer as if it were being written in real time: lines appear sequentially, with optional delay derived from the actual elapsed time between lines (e.g. from `[+125ms]` or timestamp prefixes). The user can start, pause, seek, and change playback speed to inspect when and how quickly events occurred during the original run.

### 1.2 Value Proposition

- **Post-hoc analysis:** Understand the temporal shape of a session (bursts of errors, long gaps, order of operations) without re-running the app.
- **Demos and debugging:** Share a "playback" of a session with others or step through it at reduced speed to spot subtle ordering issues.
- **Consistency with existing UX:** Replay uses the same viewer and line rendering as live capture; only the source of "incoming" lines and timing differ.
- **Differentiator:** Most log viewers are static or live-only; replay with timing is a memorable "wow" feature.

### 1.3 Out of Scope (for this spec)

- Recording or editing timestamps for lines that don’t have them (could be a future enhancement: infer or allow manual offsets).
- Multi-session sync replay (e.g. two logs side by side with shared timeline).
- Export of replay as video (could be a separate feature).

---

## 2. User Stories

| # | As a… | I want to… | So that… |
|---|--------|-------------|-----------|
| 1 | Developer | Press "Replay" (or similar) on a loaded log and see lines appear one by one | I can watch the session unfold as it did at capture time. |
| 2 | Developer | Use a speed control (e.g. 1x, 2x, 0.5x) during replay | I can slow down noisy sections or speed through quiet parts. |
| 3 | Developer | Pause and resume replay, and optionally seek to a time or line index | I can stop at a specific moment and inspect the state. |
| 4 | Developer | Choose "replay with timing" vs "replay as fast as possible" | I can either respect original gaps (e.g. [+500ms]) or just animate order without delay. |
| 5 | Developer | See a clear indicator that the viewer is in "replay mode" (e.g. play/pause icon, progress) | I don’t confuse replay with live capture. |

---

## 3. Technical Design

### 3.1 Data Requirements

- **Line order:** Already available from the parsed log (array of lines).
- **Per-line elapsed time:** If the log was captured with `includeElapsedTime` (or equivalent), each line may have a prefix like `[+125ms]`. The parser must expose this (e.g. as a field on the displayed line or a parallel array of deltas in ms). If not present, replay falls back to "as fast as possible" with a minimal inter-line delay (e.g. 50 ms) so the user still sees an animation.
- **Timestamps:** If lines have absolute timestamps instead of deltas, compute deltas between consecutive lines for replay timing.

### 3.2 Replay Modes

| Mode | Description | Use case |
|------|-------------|----------|
| **Timed** | Delay between line N and N+1 = elapsed delta from log (e.g. 125 ms). If no delta, use a default (e.g. 0 or 50 ms). | Faithful reproduction of original timing. |
| **Fast** | No delay (or minimal, e.g. 10 ms) so lines appear in order as quickly as the UI can render. | Quick scan of order without waiting. |
| **Speed factor** | User selects 0.5x, 1x, 2x, 5x. Applied to timed mode: actual delay = delta / factor. In fast mode, the minimal delay is divided by factor. | Slow down to inspect, or speed up long sessions. |

### 3.3 High-Level Flow

1. **Entry:** User loads a log (existing flow). When the log is fully loaded, a "Replay" action becomes available (toolbar, context menu, or command).
2. **Start replay:** Viewer enters "replay mode": optionally hide or dim lines that are "future" (not yet replayed), or show them all but highlight/scroll to the "current" line as it advances. Recommended: show a subset of lines up to "current" (like live capture) so the experience is similar to watching the session record.
3. **Tick loop:** Use a timer (e.g. `setTimeout` or `requestAnimationFrame` plus elapsed time). For each tick, if the next line’s "replay time" has been reached, append or reveal the next line and update the "current" position. If in timed mode, next tick = current time + (next line’s delta / speed factor). If in fast mode, next tick = current time + minimal delay.
4. **Pause:** Stop the timer; leave "current" where it is. Resume restarts the timer from the same position.
5. **Seek:** User selects a line or a time (e.g. "go to line 500" or "go to 00:01:30"). Set "current" to that line and, if playing, continue from there. Optionally allow "seek to start" and "seek to end."
6. **End:** When the last line is revealed, replay "completes": show a brief message ("Replay complete") and optionally stop or loop. Exit replay mode or leave the user in replay mode with the full log visible.

### 3.4 UI and Controls

- **Replay toolbar/buttons:** Play, Pause, Stop (reset to start), Speed (dropdown or cycle: 0.5x, 1x, 2x, 5x), and optionally "Timed" vs "Fast" toggle. Visible only when a log is loaded and replay is available.
- **Progress indicator:** A thin progress bar or scrubber showing "replay position" (e.g. line index / total lines, or time into session). Click/drag to seek.
- **Status text:** e.g. "Replaying (2x) — line 340/1200" or "Paused at 00:01:45."
- **Visual state:** Distinct from "live" and "paused capture" (e.g. icon or label "Replay" so the user knows they are not recording).

### 3.5 Implementation Options

- **Option A — In-memory in viewer:** The viewer already has the full set of lines. Replay = progressively revealing or "showing" lines up to index N, and advancing N in a timer. Scrolling and rendering stay in the viewer; no second document. Easiest to implement and keeps one source of truth.
- **Option B — Simulated stream:** Replay produces a stream of "new lines" that the same ingestion path as live capture uses (e.g. append to the same structure the viewer renders). More code reuse with live path but may require refactoring to support "virtual" time.
- **Option C — Separate replay view:** A dedicated webview or panel that only shows replay with its own controls. Clean separation but duplicate rendering logic.

**Recommendation:** **Option A.** Reuse the existing viewer; add a "replay state" (current index, play/pause, speed, mode). Each tick increments the "visible up to" index and triggers a scroll/update so the user sees the log growing. Replay controls can live in the same icon bar or a small floating bar.

### 3.6 Parsing and Timestamps

- **Elapsed format:** If the extension writes `[+125ms]` (or similar), the viewer parser should already parse it. Expose a `getElapsedMs(lineIndex)` or store `lineElapsedMs[]` when loading so replay can use it. If a line has no elapsed info, use 0 or a default (e.g. 50 ms) so replay doesn’t jump too fast.
- **Absolute timestamps:** If lines have timestamps (e.g. ISO or "HH:mm:ss"), compute delta from previous line and use that for timed replay. Handle first line (e.g. 0 ms or small default).

### 3.7 Configuration

- **Default mode:** `saropaLogCapture.replay.defaultMode`: `"timed"` | `"fast"`.
- **Default speed:** `saropaLogCapture.replay.defaultSpeed`: e.g. `1` (1x).
- **Min/max delay:** When no timestamp/delta is available, use `saropaLogCapture.replay.minLineDelayMs` (e.g. 50) so replay is still visible; cap maximum delay (e.g. 30 s) so one long gap doesn’t freeze replay: `saropaLogCapture.replay.maxDelayMs`.

---

## 4. Implementation Phases

### Phase 1 — MVP

- Add "Replay" command and toolbar button when a log is loaded.
- Replay = "fast" only: fixed small delay (e.g. 50 ms) between lines. No speed control yet.
- Start/pause/stop: start advances line index on a timer; pause stops timer; stop resets to line 0 and stops.
- Viewer shows "lines up to current index" (or all lines with "current" highlighted and auto-scrolled). Prefer "show up to current" for live-like feel.
- No elapsed-time parsing yet; all delays are the fixed 50 ms.

### Phase 2 — Timed replay and speed

- Parse and store per-line elapsed deltas when loading (if present in log).
- Timed mode: use actual deltas; apply speed factor (0.5x, 1x, 2x, 5x).
- Fast mode: minimal delay with optional speed factor.
- UI: speed dropdown, "Timed" vs "Fast" toggle, progress indicator (e.g. line X / Y).

### Phase 3 — Seek and polish

- Seek: scrubber or "Go to line" / "Go to time" so user can jump and resume from there.
- Replay-complete state: message and optional auto-exit or loop.
- Config: default mode, default speed, min/max delay.
- Accessibility: keyboard shortcuts (e.g. Space = play/pause), aria-labels for replay controls.

---

## 5. Edge Cases and Risks

- **Very long logs:** Replay could run for a long time. Consider a "max replay duration" or warn when estimated time > N minutes. Allow stop at any time.
- **Missing timestamps:** Entire log without deltas → treat as "fast" with minimal delay; no need to block replay.
- **Memory:** Replay does not duplicate line data; it only advances an index. Memory footprint is unchanged.
- **Concurrent actions:** Disable or clarify behavior if user opens another log or starts live capture during replay (e.g. "Replay stopped" and load new log).

---

## 6. Success Criteria

- User can start replay from a loaded log and see lines appear in order, with optional timing that reflects original elapsed time.
- User can pause, resume, stop, and (in a later phase) seek. Speed control allows 0.5x–5x (or similar).
- Replay mode is clearly indicated and does not conflict with live capture state.
- When the log has no timing info, replay still works in "fast" mode with a short fixed delay.

---

## 7. References

- ROADMAP §4 "Wow" #7, §7 "Consider for Wow" #2
- Existing: viewer file loader, elapsed time in log lines (`includeElapsedTime`), viewer scroll and rendering
- CONTRIBUTING: performance (batched UI, virtual scrolling) — replay should not bypass existing limits (e.g. max lines) unless explicitly designing for "replay-only" view

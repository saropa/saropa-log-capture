# Plan: Error rate over time

**Feature:** Chart showing errors per minute (or per time bucket) over the session so users see when errors spiked.

---

## What exists

- Log viewer with level classification (error, warning, info, etc.).
- Session metadata and timestamps; replay and timeline can use timestamps.
- Performance panel and other panels as reference for chart UI.

## What's missing

1. **Error time series** — For the current session (or selected log), compute counts of error-level lines per time bucket (e.g. 1 minute or configurable).
2. **Chart UI** — Display as a line or bar chart (time on X, count on Y); optional overlay of warning/info for comparison.
3. **Interaction** — Click a bucket or time range to jump viewer to that time; optional zoom on time range.

## Implementation

### 1. Data

- Scan log lines for level and timestamp (reuse timeline/log parsers); bucket by time (e.g. `Math.floor(timestamp / 60000)` for 1-minute buckets).
- Emit `{ time: number, errors: number, warnings?: number }[]` for the chart.
- Cache per session/log URI so reopening same log doesn’t recompute until log changes.

### 2. Chart

- Use a lightweight chart approach: SVG or canvas in webview, or a small chart library if already in use. No new heavy dependencies if possible.
- Axes: X = time (formatted), Y = count. Tooltip on hover with exact count and time range.

### 3. Placement

- New "Insights" or "Error rate" tab in an existing panel (e.g. Performance panel), or a small chart above/below the log viewer, or a separate "Error rate" panel.
- Show only when a session/log is loaded.

## Files to create/modify

| File | Change |
|------|--------|
| New: error-rate aggregator (e.g. `src/modules/insights/error-rate.ts`) | Bucket errors by time; return time series |
| New: chart component or panel (e.g. `src/ui/panels/error-rate-panel.ts`) | Render chart; handle click-to-navigate |
| Viewer or session provider | Expose log URI/lines for current session so aggregator can run |
| `package.json` | Optional: command to open Error rate view |

## Considerations

- Timestamps: not all lines have timestamps; document behavior (e.g. use line order and elapsed time, or only count lines with timestamps).
- Scale: very long sessions may need downsampling (e.g. max 200 buckets, merge adjacent).

## Effort

**3–5 days.**

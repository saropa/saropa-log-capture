# Plan: Error Rate Over Time

**Feature:** Show how error frequency changes across a debug session, so users can spot error spikes, correlate them with actions, and identify patterns — using deterministic logic (no AI/cloud services required).

---

## Goal

Answer the question: *"When did things go wrong?"*

A time-bucketed chart of error (and optionally warning) counts lets users:

- See at a glance whether errors cluster at startup, after a specific action, or throughout
- Click a spike to jump straight to those lines in the viewer
- Compare sessions to see if a fix reduced error frequency

---

## What exists

- Level classification on every log line (error, warning, info, debug, verbose)
- Timestamps: elapsed ms from session start, plus optional wall-clock timestamps
- Replay timeline already uses per-line timing
- Webview panels (performance, viewer) as reference for chart UI

## What's missing

1. **Time-series aggregation** — bucket error/warning counts by time interval
2. **Chart rendering** — lightweight visual (SVG or canvas) in a webview panel
3. **Click-to-navigate** — click a bucket to scroll the viewer to that time range
4. **Trend detection** — optional ML-style logic to flag anomalies (purely local, no AI)

---

## Implementation

### 1. Time-series aggregation

**Input:** array of log lines with `elapsedMs` (or timestamp) and `level`.

**Output:** `{ bucketStartMs: number; errors: number; warnings: number }[]`

**Logic:**

- Bucket size defaults to session duration / 100 (adaptive), clamped to 1 s–5 min range
- User can override with fixed bucket sizes: 10 s, 30 s, 1 min, 5 min
- Lines without timestamps inherit the previous line's timestamp
- Only count lines where `level` is `error` or `warning` (configurable)

**Caching:** keyed by session URI + line count — recompute only when new lines arrive.

### 2. Chart rendering

- Pure SVG in a webview panel (no external chart library)
- Bar chart: X = time, Y = count; errors in red, warnings in amber
- Hover tooltip: exact count, time range, top line text
- Axes: time labels on X (auto-scaled), count on Y (integer ticks)
- Responsive: resize with panel width

### 3. Click-to-navigate

- Click a bar → post message to viewer → scroll to first line in that time bucket
- Shift+click → select the range (highlight all lines in that bucket)
- Keyboard: arrow keys to move between buckets

### 4. Trend detection (ML logic, no AI)

Deterministic algorithms that run locally on the aggregated data:

#### Option A: Statistical threshold

- Compute mean and standard deviation of error counts per bucket
- Flag any bucket where `count > mean + 2σ` as an anomaly
- Simple, fast, easy to understand
- Limitation: poor for sessions with mostly-zero buckets (skewed distribution)

#### Option B: Moving average comparison

- Compute a rolling average over N buckets (e.g. N = 5)
- Flag a bucket as a spike if `count > 3× rolling average`
- Better for sessions with gradual trends
- Handles non-stationary data (error rate increasing over time)

#### Option C: Rate-of-change detection

- Compute the first derivative (change between consecutive buckets)
- Flag where the rate of change exceeds a threshold (e.g. > 5× the median change)
- Good for detecting sudden bursts vs gradual increase
- Can distinguish "sudden spike" from "steadily worsening"

#### Option D: Sliding window percentile

- Maintain a sliding window of the last N buckets
- Flag a bucket as anomalous if it exceeds the 95th percentile of its window
- Adapts to local context (a spike during a noisy period needs to be bigger)
- More robust than global mean/σ for variable-rate sessions

#### Recommendation

Start with **Option B (moving average)** — it handles the common case (mostly quiet, then a burst) and is easy to explain to users. Show flagged buckets with a marker icon on the chart. Add Option A as a fallback for very short sessions (< 10 buckets) where a rolling average has insufficient data.

---

## UI placement

- New **"Error Rate"** tab in the existing side panel (alongside Performance)
- Only visible when a session or log file is loaded
- Collapses to a mini sparkline when panel is narrow
- Optional: inline mini-chart above the viewer (toggled via command)

---

## Files to create/modify

| File | Change |
|------|--------|
| `src/modules/insights/error-rate-aggregator.ts` | Bucket errors/warnings by time; return time series |
| `src/modules/insights/error-rate-trends.ts` | Moving average + threshold anomaly detection |
| `src/ui/panels/error-rate-panel.ts` | SVG chart rendering; hover/click handlers |
| `src/ui/provider/log-viewer-provider.ts` | Expose line data for aggregator; handle navigate-to-bucket |
| `package.json` | Command: `saropaLogCapture.showErrorRate`; optional settings |

---

## Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `saropaLogCapture.errorRate.bucketSize` | `string` | `"auto"` | `"auto"`, `"10s"`, `"30s"`, `"1m"`, `"5m"` |
| `saropaLogCapture.errorRate.showWarnings` | `boolean` | `true` | Include warnings alongside errors |
| `saropaLogCapture.errorRate.detectSpikes` | `boolean` | `true` | Highlight anomalous buckets |

---

## Considerations

- **Missing timestamps:** lines without timing inherit the previous line's time; if no lines have timestamps, fall back to line-index buckets (equal-count instead of equal-time)
- **Scale:** cap at 200 buckets max; merge adjacent buckets for very long sessions
- **Performance:** aggregation is O(n) over lines; trend detection is O(n) over buckets — both trivial for typical session sizes (< 100k lines)
- **Privacy:** all computation is local; no data leaves the extension

---

## Effort

| Phase | Effort |
|-------|--------|
| Aggregation + caching | 1–2 days |
| SVG chart + interaction | 2–3 days |
| Trend detection | 1–2 days |
| Polish + settings | 1 day |
| **Total** | **5–8 days** |

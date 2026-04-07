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
- `item.timestamp` (Unix ms) set on every line in `addToData()` (`viewer-data-add.ts`)
- Lines without wall-clock timestamps inherit the previous line's timestamp
- `allLines` array accessible from webview JS — no backend call needed for current-session data
- Webview panels (performance, insight) as reference for chart UI

## What's missing

1. **Time-series aggregation** — bucket error/warning counts by time interval
2. **Chart rendering** — lightweight SVG bar chart in a webview panel tab
3. **Click-to-navigate** — click a bucket to scroll the viewer to that time range
4. **Spike detection** — moving average comparison to flag anomalous buckets

---

## Implementation

### 1. Time-series aggregation

**Input:** `allLines` array; each item has `timestamp` (Unix ms) and `level`.

**Output:** `{ bucketStartMs: number; errors: number; warnings: number }[]`

**Logic:**

- Bucket size defaults to session duration / 100 (adaptive), clamped to 1 s–5 min range
- User can override with fixed bucket sizes: 10 s, 30 s, 1 min, 5 min
- Lines without timestamps inherit the previous line's timestamp (already handled by `addToData`)
- Only count lines where `level` is `error` or `warning` (configurable)
- Skip markers (`item.type === 'marker'`)

**Caching:** keyed by session URI + line count — recompute only when new lines arrive.

### 2. Chart rendering

- Pure SVG in a webview panel (no external chart library)
- Bar chart: X = time, Y = count; errors in red, warnings in amber
- Hover tooltip: exact count, time range, top line text
- Axes: time labels on X (auto-scaled), count on Y (integer ticks)
- Responsive: resize with panel width

### 3. Click-to-navigate

- Click a bar → post message to viewer → scroll to first line in that time bucket

### 4. Spike detection (moving average)

- Compute a rolling average over N buckets (N = 5)
- Flag a bucket as a spike if `count > 3× rolling average`
- Show flagged buckets with a marker icon on the chart
- Handles non-stationary data (error rate increasing over time)

---

## UI placement

- New **"Error Rate"** tab in the existing side panel (alongside Performance)
- Only visible when a session or log file is loaded

---

## Files to create/modify

| File | Change |
|------|--------|
| `src/ui/panels/viewer-error-rate-panel.ts` | Panel HTML + script generation (follows `viewer-performance-panel.ts` pattern) |
| `src/ui/panels/viewer-error-rate-chart.ts` | SVG chart rendering; hover/click handlers (split for 300-line limit) |
| `src/modules/analysis/error-rate-aggregator.ts` | Bucket errors/warnings by time; return time series |
| `src/modules/analysis/error-rate-spike-detector.ts` | Moving average spike detection |
| `src/ui/panels/viewer-insight-panel.ts` | Embed error rate tab reference |
| `package.json` | Command: `saropaLogCapture.showErrorRate`; settings |

---

## Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `saropaLogCapture.errorRate.bucketSize` | `string` | `"auto"` | `"auto"`, `"10s"`, `"30s"`, `"1m"`, `"5m"` |
| `saropaLogCapture.errorRate.showWarnings` | `boolean` | `true` | Include warnings alongside errors |
| `saropaLogCapture.errorRate.detectSpikes` | `boolean` | `true` | Highlight anomalous buckets |

---

## Test plan

### Unit: error-rate-aggregator

- **Happy path:** session with mixed levels → correct error/warning counts per bucket
- **Edge: no errors** → empty buckets array (or all-zero)
- **Edge: no timestamps** → falls back to line-index buckets (equal-count)
- **Edge: single line** → one bucket with that line's count
- **Boundary: 200-bucket cap** → long session merges adjacent buckets, never exceeds 200
- **Markers skipped** → lines with `type === 'marker'` excluded from counts

### Unit: error-rate-spike-detector

- **Happy path:** quiet session with one burst → burst bucket flagged
- **Edge: all buckets equal** → no spikes flagged
- **Edge: < 5 buckets** → rolling window uses available buckets (no crash)
- **Edge: empty input** → returns empty array

### Integration (lightweight)

- Panel renders with mock `allLines` data; SVG contains expected number of bars
- Click a bar → `postMessage` sent with correct bucket time range

---

## Considerations

- **Missing timestamps:** lines without timing inherit the previous line's time; if no lines have timestamps, fall back to line-index buckets (equal-count instead of equal-time)
- **Scale:** cap at 200 buckets max; merge adjacent buckets for very long sessions
- **Performance:** aggregation is O(n) over lines; spike detection is O(n) over buckets — both trivial for typical session sizes (< 100k lines)
- **Privacy:** all computation is local; no data leaves the extension

---

## Deferred

- Mini sparkline when panel is narrow
- Inline mini-chart above the viewer (toggled via command)
- Shift+click to select/highlight all lines in a bucket
- Keyboard arrow-key navigation between buckets
- Alternative spike algorithms (statistical threshold, rate-of-change, sliding window percentile)
- Cross-session error rate comparison chart

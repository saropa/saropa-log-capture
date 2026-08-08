/**
 * Activity-over-time line chart for the flow-map panel (sits above "Screen dwell").
 *
 * Every timed log occurrence the parser kept — navigation/action breadcrumbs (events) and
 * perf/warn/error overlays (issues) — is a session "activity" sample. We bin those samples across the
 * session's time span and plot count-per-bin as a single line: the vertical axis counts events, the
 * horizontal axis is wall-clock time. Each plotted point is clickable and reveals the first log line
 * in that bin, so a spike in the chart jumps straight to the noisy stretch of the raw log.
 *
 * Pure data → SVG string (no VS Code dependency), so it unit-tests without the Extension Host. The
 * `clockOf` formatter is injected (same pattern as `enteredClock`) to avoid duplicating the
 * ms-of-day → HH:MM:SS helper that the HTML module already owns.
 */

import type { ParsedLog } from './flow-map-model';
import type { FlowShot } from './flow-map-screenshots';
import { pickThumbShot, shotDataAttrs } from './flow-map-svg-shots';
import { esc, stripAnsi } from './flow-map-format';

/** One time bin: how many samples fell in it, and the earliest log line to jump to. */
interface Bin {
    count: number;
    /** 1-based log line of the earliest sample in this bin (the click target); undefined when empty. */
    logLine?: number;
    /** Bin-center timestamp (ms-of-day) used only for the X-axis clock label. */
    readonly centerTsMs: number;
}

/** A timed activity sample reduced to just what the chart needs. */
interface Sample { readonly tsMs: number; readonly logLine?: number; }

const W = 640;
const H = 220;
const ML = 46;   // left margin — room for the count-axis numbers
const MR = 16;
const MT = 16;
const MB = 34;   // bottom margin — room for the time-axis clocks
const PLOT_W = W - ML - MR;
const PLOT_H = H - MT - MB;
/** Thumbnail size in the capture strip below the x axis (portrait, matching a phone capture). */
const SHOT_W = 30;
const SHOT_H = 40;
/** Height the strip adds to the canvas when at least one bin has a capture; 0 when none do. */
const SHOT_STRIP_H = SHOT_H + 8;
/** The XHTML namespace a `<foreignObject>` child must declare to survive XML parsing. */
const XHTML_NS = 'http://www.w3.org/1999/xhtml';

/**
 * Collect every timed sample (events + issues), earliest first. Samples with a non-positive `tsMs`
 * are dropped: the parser uses `0` as the "no timestamp" sentinel (e.g. an untimed slow-query issue),
 * and including those would plant a false spike at 00:00:00 and squash real activity to the right edge.
 */
function collectSamples(parsed: ParsedLog): Sample[] {
    const out: Sample[] = [];
    for (const e of parsed.events) {
        if (e.tsMs > 0) { out.push({ tsMs: e.tsMs, logLine: e.logLine }); }
    }
    for (const i of parsed.issues) {
        if (i.tsMs > 0) { out.push({ tsMs: i.tsMs, logLine: i.logLine }); }
    }
    return out.sort((a, b) => a.tsMs - b.tsMs);
}

/** Bin samples across the time span; aim for ~4 samples per bin, clamped to a readable 6..24. */
function buildBins(samples: Sample[]): { bins: Bin[]; minTs: number; spanMs: number } {
    const minTs = samples[0].tsMs;
    const maxTs = samples[samples.length - 1].tsMs;
    const spanMs = Math.max(0, maxTs - minTs);
    const binCount = Math.min(24, Math.max(6, Math.ceil(samples.length / 4)));
    const bins: Bin[] = Array.from({ length: binCount }, (_, i) => ({
        count: 0,
        centerTsMs: minTs + (spanMs * (i + 0.5)) / binCount,
    }));
    for (const s of samples) {
        // A zero span (all samples same instant) collapses to the first bin.
        const frac = spanMs > 0 ? (s.tsMs - minTs) / spanMs : 0;
        const idx = Math.min(binCount - 1, Math.floor(frac * binCount));
        const bin = bins[idx];
        bin.count += 1;
        // Earliest sample wins the click target (samples are pre-sorted, so the first to land here).
        if (bin.logLine === undefined && s.logLine) { bin.logLine = s.logLine; }
    }
    return { bins, minTs, spanMs };
}

/** Pixel X for bin `i` of `n` (point sits at the bin center). */
function xOf(i: number, n: number): number {
    return ML + (PLOT_W * (i + 0.5)) / n;
}

/** Pixel Y for a count against the chart's max (flat baseline when max is 0). */
function yOf(count: number, maxCount: number): number {
    return MT + PLOT_H - (maxCount > 0 ? (count / maxCount) * PLOT_H : 0);
}

/** Up to ~5 integer count ticks (0..max), evenly stepped. */
function countTicks(maxCount: number): number[] {
    if (maxCount <= 0) { return [0]; }
    if (maxCount <= 4) { return Array.from({ length: maxCount + 1 }, (_, i) => i); }
    const step = Math.ceil(maxCount / 4);
    const ticks: number[] = [];
    for (let v = 0; v <= maxCount; v += step) { ticks.push(v); }
    if (ticks[ticks.length - 1] !== maxCount) { ticks.push(maxCount); }
    return ticks;
}

/** Horizontal gridlines + right-aligned count numbers along the Y axis. */
function yAxisHtml(maxCount: number): string {
    return countTicks(maxCount).map(v => {
        const y = yOf(v, maxCount);
        const grid = `<line class="ac-grid" x1="${ML}" y1="${y}" x2="${ML + PLOT_W}" y2="${y}"/>`;
        const label = `<text class="ac-num" x="${ML - 6}" y="${y + 3}" text-anchor="end">${v}</text>`;
        return grid + label;
    }).join('');
}

/** Clock labels under the X axis at up to 5 evenly-spaced bin centers. */
function xAxisHtml(bins: Bin[], clockOf: (tsMs: number) => string): string {
    const n = bins.length;
    const wanted = Math.min(5, n);
    const seen = new Set<number>();
    const labels: string[] = [];
    for (let k = 0; k < wanted; k++) {
        const i = wanted === 1 ? 0 : Math.round((k * (n - 1)) / (wanted - 1));
        if (seen.has(i)) { continue; }
        seen.add(i);
        const anchor = k === 0 ? 'start' : k === wanted - 1 ? 'end' : 'middle';
        labels.push(`<text class="ac-clock" x="${xOf(i, n)}" y="${H - 12}" text-anchor="${anchor}">`
            + `${esc(clockOf(bins[i].centerTsMs))}</text>`);
    }
    return labels.join('');
}

/** Clickable points for every non-empty bin (empty bins have no log line to jump to). */
function pointsHtml(bins: Bin[], maxCount: number, clockOf: (tsMs: number) => string): string {
    const n = bins.length;
    return bins.map((b, i) => {
        if (b.count === 0) { return ''; }
        const cx = xOf(i, n).toFixed(1);
        const cy = yOf(b.count, maxCount).toFixed(1);
        const clock = esc(clockOf(b.centerTsMs));
        const plural = b.count === 1 ? 'event' : 'events';
        const title = `<title>${clock} · ${b.count} ${plural}${b.logLine ? ' — click to reveal log' : ''}</title>`;
        // Only a known log line makes a point a link; otherwise it is an inert marker.
        if (!b.logLine) {
            return `<circle class="ac-pt" cx="${cx}" cy="${cy}" r="3.5">${title}</circle>`;
        }
        return `<circle class="ac-pt ac-link" cx="${cx}" cy="${cy}" r="4" tabindex="0" role="link" `
            + `data-line="${b.logLine}">${title}</circle>`;
    }).join('');
}

/** The connecting polyline through every bin (including zero-count dips, so spikes read clearly). */
function lineHtml(bins: Bin[], maxCount: number): string {
    const n = bins.length;
    const pts = bins.map((b, i) => `${xOf(i, n).toFixed(1)},${yOf(b.count, maxCount).toFixed(1)}`).join(' ');
    return `<polyline class="ac-line" points="${pts}"/>`;
}

/** A timed sample reduced to the pair the capture lookup needs, sorted by `line` ascending. */
interface LineAnchor { readonly line: number; readonly tsMs: number; }

/**
 * The samples that carry a log line, sorted BY LINE. Built once per chart rather than rescanned per
 * capture, and sorted on the axis the lookup actually searches: `collectSamples` orders by tsMs, and
 * "the last one in tsMs order whose line is at or before X" quietly assumes log lines rise with
 * time. They normally do — but a device clock that steps backward mid-session breaks that assumption
 * with no symptom beyond a thumbnail under the wrong point. Sorting by line removes the assumption
 * instead of relying on it.
 */
function lineAnchors(samples: readonly Sample[]): LineAnchor[] {
    const out: LineAnchor[] = [];
    for (const s of samples) {
        if (s.logLine !== undefined) { out.push({ line: s.logLine, tsMs: s.tsMs }); }
    }
    return out.sort((a, b) => a.line - b.line);
}

/**
 * The moment a capture belongs to, resolved through its LOG LINE rather than its own clock.
 *
 * A capture's clock is HOST-local (see `formatClock` in flow-map-screenshots.ts) while every chart
 * sample is DEVICE-local ms-of-day. Binning on the clock would scatter every thumbnail hours from
 * its point the moment the device sits in another timezone — and would do it silently, since a
 * thumbnail under the wrong bin still looks like a chart. Log line numbers are the one ordering both
 * sides agree on: the capture happened at the same moment as the sample with the greatest log line
 * at or before its own.
 *
 * Binary search, so the strip costs O((samples + shots) log samples) rather than a full scan per
 * capture. Returns undefined when no timed sample precedes the capture — it cannot be placed, so it
 * is left out rather than pinned to the chart's start.
 */
function shotTsMs(shot: FlowShot, anchors: readonly LineAnchor[]): number | undefined {
    let lo = 0;
    let hi = anchors.length - 1;
    let found: number | undefined;
    while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (anchors[mid].line <= shot.logLine) { found = anchors[mid].tsMs; lo = mid + 1; } else { hi = mid - 1; }
    }
    return found;
}

/**
 * One representative capture per bin. A bin can hold several (a burst on one screen), and at 30px a
 * second thumbnail says nothing the first does not — `pickThumbShot` picks the same way a diagram
 * card does, so the fault capture wins and the strip agrees with the cards above it.
 */
function shotsByBin(
    shots: readonly FlowShot[], samples: readonly Sample[],
    bins: { binCount: number; minTs: number; spanMs: number },
): Map<number, FlowShot> {
    const buckets = new Map<number, FlowShot[]>();
    const anchors = lineAnchors(samples);
    for (const shot of shots) {
        const ts = shotTsMs(shot, anchors);
        if (ts === undefined) { continue; }
        const frac = bins.spanMs > 0 ? (ts - bins.minTs) / bins.spanMs : 0;
        const idx = Math.min(bins.binCount - 1, Math.max(0, Math.floor(frac * bins.binCount)));
        const list = buckets.get(idx);
        if (list) { list.push(shot); } else { buckets.set(idx, [shot]); }
    }
    const out = new Map<number, FlowShot>();
    for (const [idx, list] of buckets) {
        const picked = pickThumbShot(list);
        if (picked) { out.set(idx, picked.shot); }
    }
    return out;
}

/**
 * The capture strip below the x axis: each bin's representative capture, drawn at that bin's own x.
 * A `<foreignObject>` `<img>` (the same element the diagram cards use) rather than an HTML strip
 * under the SVG, so the thumbnails share the chart's coordinate system and stay under their own
 * points at every column width instead of re-deriving the mapping and drifting from it.
 *
 * `data-shot-index` counts the WHOLE session's captures, not the strip's, because these thumbnails
 * open the same lightbox the gallery does and its counter must mean one thing.
 */
function shotStripHtml(byBin: ReadonlyMap<number, FlowShot>, binCount: number, all: readonly FlowShot[]): string {
    const top = H + 4;
    return [...byBin].map(([i, shot]) => {
        const x = xOf(i, binCount) - SHOT_W / 2;
        const screen = stripAnsi(shot.screenLabel ?? shot.trigger);
        // Same `clock · trigger · screen` wording as the card thumbnails and the gallery caption, so
        // one capture never describes itself three ways.
        const title = esc(`${shot.clock} · ${shot.trigger} · ${screen}`);
        const label = esc(screen);
        return `<foreignObject x="${x.toFixed(1)}" y="${top}" width="${SHOT_W}" height="${SHOT_H}">`
            + `<img xmlns="${XHTML_NS}" class="fm-mini-shot ac-shot" src="${esc(shot.src)}" role="button" `
            + `tabindex="0" title="${title}" alt="${label}" aria-label="${label}"`
            + `${shotDataAttrs(shot, all.indexOf(shot) + 1, all.length)}/></foreignObject>`;
    }).join('');
}

/**
 * Build the activity-chart section body (returns a note when there is nothing timed to plot).
 * `shots` are the session's captures; the ones that can be placed get a thumbnail under their bin.
 */
export function activityChartHtml(
    parsed: ParsedLog, clockOf: (tsMs: number) => string, shots: readonly FlowShot[] = [],
): string {
    const samples = collectSamples(parsed);
    if (samples.length < 2) {
        return '<p class="ac-empty">Not enough timed activity to chart.</p>';
    }
    const { bins, minTs, spanMs } = buildBins(samples);
    const byBin = shotsByBin(shots, samples, { binCount: bins.length, minTs, spanMs });
    // The strip only costs canvas height when something is actually in it.
    const canvasH = byBin.size > 0 ? H + SHOT_STRIP_H : H;
    const maxCount = Math.max(1, ...bins.map(b => b.count));
    const axisLine = `<line class="ac-axis" x1="${ML}" y1="${MT + PLOT_H}" x2="${ML + PLOT_W}" y2="${MT + PLOT_H}"/>`
        + `<line class="ac-axis" x1="${ML}" y1="${MT}" x2="${ML}" y2="${MT + PLOT_H}"/>`;
    const svg = `<svg class="activity-chart" viewBox="0 0 ${W} ${canvasH}" role="img" `
        + `aria-label="Session activity over time" preserveAspectRatio="xMidYMid meet">`
        + yAxisHtml(maxCount) + axisLine + lineHtml(bins, maxCount)
        + pointsHtml(bins, maxCount, clockOf) + xAxisHtml(bins, clockOf)
        + shotStripHtml(byBin, bins.length, shots)
        + '</svg>';
    return '<p class="legend">Event volume over the session. Click a point to jump the log to that moment.</p>'
        + '<div class="activity-wrap">' + svg + '</div>';
}

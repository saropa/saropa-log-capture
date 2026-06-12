/**
 * Pure inline-SVG sparkline renderer for small trend series (Vitals crash/ANR rate over time, and the
 * per-issue trend mini-chart). Kept free of the `vscode` API so it is unit-testable under `node --test`
 * and reusable by any panel that needs a compact trend line.
 *
 * Convention: series is oldest→newest; a HIGHER value draws a HIGHER line (SVG y is inverted so the
 * peak sits at the top). The line is stretched to the requested box via `preserveAspectRatio="none"`
 * and inherits its color from `currentColor`, so the caller controls good/bad coloring via CSS.
 */

/** Render a sparkline polyline as an inline SVG string, or '' when there are too few points to draw. */
export function renderSparkline(series: readonly number[] | undefined, width = 80, height = 18): string {
    // A single point (or none) is not a trend — drawing a one-point line is misleading, so emit nothing.
    if (!series || series.length < 2) { return ''; }
    const pad = 1;
    const min = Math.min(...series);
    const max = Math.max(...series);
    // A flat series has zero span; fall back to 1 so every point lands mid-box instead of dividing by 0.
    const span = max - min || 1;
    const stepX = (width - pad * 2) / (series.length - 1);
    const points = series
        .map((value, i) => {
            const x = pad + i * stepX;
            const y = pad + (height - pad * 2) * (1 - (value - min) / span);
            return `${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join(' ');
    return `<svg class="vt-spark" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" `
        + `preserveAspectRatio="none" aria-hidden="true">`
        + `<polyline points="${points}" fill="none" stroke="currentColor" stroke-width="1"/></svg>`;
}

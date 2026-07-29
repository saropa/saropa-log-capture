/**
 * Inline SVG arc gauge for the session health score (0–100).
 * Renders a compact 180° arc, color-graduated by score tier:
 * ≥80 green (good), 50–79 amber (mid), <50 red (bad).
 * No external libraries — pure SVG path math.
 */

/** Health score tier boundaries. */
const tierGood = 80;
const tierMid = 50;

/**
 * Build an inline SVG arc gauge for a 0–100 health score.
 * The arc sweeps 180° (bottom half is open). The fill proportion
 * and color both track the score so the gauge reads at a glance.
 */
export function buildHealthGaugeSvg(score: number): string {
  // Guard NaN/undefined — treat as zero (worst tier) rather than rendering "NaN"
  const clamped = Number.isFinite(score) ? Math.max(0, Math.min(100, score)) : 0;
  const colorVar = clamped >= tierGood
    ? '--stat-border-health-good'
    : clamped >= tierMid
      ? '--stat-border-health-mid'
      : '--stat-border-health-bad';

  const size = 52;
  const cx = size / 2;
  const cy = size / 2;
  const r = 20;
  const strokeWidth = 5;

  const sweepAngle = (clamped / 100) * Math.PI;
  const startX = cx - r;
  const startY = cy;
  const endX = cx - r * Math.cos(sweepAngle);
  const endY = cy - r * Math.sin(sweepAngle);
  const largeArc = sweepAngle > Math.PI / 2 ? 1 : 0;

  const trackD = `M ${cx - r} ${cy} A ${r} ${r} 0 1 1 ${cx + r} ${cy}`;
  const fillD = clamped === 0
    ? ''
    : `M ${startX} ${startY} A ${r} ${r} 0 ${largeArc} 1 ${endX.toFixed(1)} ${endY.toFixed(1)}`;

  const fillPath = fillD
    ? `<path d="${fillD}" fill="none" stroke="var(${colorVar})" stroke-width="${strokeWidth}" stroke-linecap="round"/>`
    : '';

  return (
    `<svg class="health-gauge" viewBox="0 0 ${size} ${size}" width="${size}" height="${size / 2 + 4}" aria-hidden="true">` +
    `<path d="${trackD}" fill="none" stroke="var(--border)" stroke-width="${strokeWidth}" stroke-linecap="round"/>` +
    fillPath +
    `<text x="${cx}" y="${cy - 2}" text-anchor="middle" font-size="var(--text-body)" font-weight="700" fill="var(--text)">${clamped}</text>` +
    `</svg>`
  );
}

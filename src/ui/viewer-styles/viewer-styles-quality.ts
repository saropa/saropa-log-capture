/**
 * CSS for quality coverage badges on stack frame lines.
 * Color thresholds: green (>=80%), yellow (50-79%), red (<50%).
 * Uses VS Code theme CSS variables for dark/light/high-contrast compatibility.
 */

/** Returns the CSS for quality badge styling. */
export function getQualityBadgeStyles(): string {
    return `
.quality-badge {
    display: inline-block;
    padding: 0 var(--space-1);
    margin-right: 3px;
    border-radius: var(--radius-sm);
    font-size: 10px;
    font-weight: 600;
    vertical-align: middle;
}
/* Background and border are derived from each badge's own foreground via color-mix
   (the project's established tint idiom, see viewer-styles-decoration-bars.ts). Hardcoded
   rgba green/yellow/red assumed a dark canvas and stayed invisible on light/high-contrast
   themes. Each grade now reads its color from the shared status/accent token (good /
   warning / bad), so the tint tracks the active theme and matches every other dashboard
   severity surface. */
.qb-high {
    color: var(--status-good);
    background: color-mix(in srgb, var(--status-good) 22%, transparent);
    border: 1px solid color-mix(in srgb, var(--status-good) 55%, transparent);
}
.qb-med {
    color: var(--accent-warning);
    background: color-mix(in srgb, var(--accent-warning) 22%, transparent);
    border: 1px solid color-mix(in srgb, var(--accent-warning) 55%, transparent);
}
.qb-low {
    color: var(--status-bad);
    background: color-mix(in srgb, var(--status-bad) 22%, transparent);
    border: 1px solid color-mix(in srgb, var(--status-bad) 55%, transparent);
}

/* Heatmap: subtle line background for stack frames by coverage (when quality badge is shown).
   Same token-derived tint, at a lower percentage so it reads as a faint wash behind the row. */
.line-quality-high {
    background: color-mix(in srgb, var(--status-good) 7%, transparent);
}
.line-quality-med {
    background: color-mix(in srgb, var(--accent-warning) 7%, transparent);
}
.line-quality-low {
    background: color-mix(in srgb, var(--status-bad) 7%, transparent);
}
`;
}

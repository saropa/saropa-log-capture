/**
 * Crashlytics issue-detail loading skeleton, error state, and Trouble-rail chrome
 * (plan 110, Stage 3).
 *
 * The old loading view rendered one line — "Loading issue…" — over the whole log area,
 * discarding the title, subtitle, counts, state, and version range the clicked row was
 * already carrying in its data-* attributes. Here the header paints immediately from
 * that meta and only the stack, the one part that needs the network, shimmers.
 *
 * The shimmer bars reuse the panel's existing `cp-pulse` keyframes rather than adding a
 * second animation, so a reduced-motion or theme change has one place to land.
 *
 * Severity color comes from the `.cd-sev-crash` / `.cd-sev-anr` / `.cd-sev-nf` classes
 * the stat cards already define (they set `color`), so the dot paints with
 * `background: currentColor` and no accent token is duplicated here.
 */
export function getCrashlyticsSkeletonStyles(): string {
    return /* css */ `
/* ===================================================================
   Crashlytics detail — loading skeleton + error state
   =================================================================== */
.cd-skel-head {
    display: flex;
    align-items: flex-start;
    gap: var(--space-2);
    margin-bottom: var(--space-2);
}
.cd-skel-sev {
    flex-shrink: 0;
    width: 10px;
    height: 10px;
    margin-top: 4px;
    border-radius: 50%;
    background: currentColor;
}
.cd-skel-titles { flex: 1; min-width: 0; }
.cd-skel-sub {
    color: var(--muted);
    font-size: var(--text-caption);
    overflow-wrap: anywhere;
    margin-bottom: var(--space-2);
}
.cd-skel-chips { display: flex; flex-wrap: wrap; gap: var(--space-1); }
.cd-skel-chip {
    background: var(--surface-3);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    color: var(--text);
    font-size: var(--text-caption);
    font-variant-numeric: tabular-nums;
    padding: 1px var(--space-2);
}

/* Placeholder bars where the stack trace will land. Widths taper so the block reads as
   text rather than a progress bar; aria-hidden keeps it out of the announced content. */
.cd-shimmer { display: flex; flex-direction: column; gap: 6px; padding: var(--space-2) 0; }
.cd-shimmer i {
    display: block;
    height: 10px;
    border-radius: var(--radius-sm);
    background: var(--surface-3);
    animation: cp-pulse 1.5s ease-in-out infinite;
}
.cd-shimmer i:nth-child(1) { width: 92%; }
.cd-shimmer i:nth-child(2) { width: 78%; }
.cd-shimmer i:nth-child(3) { width: 85%; }
.cd-shimmer i:nth-child(4) { width: 64%; }
.cd-shimmer i:nth-child(5) { width: 73%; }

.cd-error-actions { margin-top: var(--space-3); }
.cd-retry {
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border: none;
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-size: var(--text-caption);
    padding: var(--space-1) var(--space-3);
}
.cd-retry:hover { background: var(--vscode-button-hoverBackground, var(--vscode-button-background)); }
`;
}

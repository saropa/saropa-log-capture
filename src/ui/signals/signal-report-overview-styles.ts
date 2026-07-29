/**
 * CSS for signal report overview rows, stat cards, and health gauge.
 * Extracted from signal-report-styles.ts to keep files under the 300-line limit.
 */

export function getOverviewStyles(): string {
    return /* css */ `
.overview-row {
    display: flex;
    gap: var(--space-2);
    padding: var(--space-1) 0;
    font-size: var(--text-caption);
    align-items: center;
    border-bottom: 1px solid color-mix(in srgb, var(--border) 50%, transparent);
}
.overview-row:last-of-type { border-bottom: none; }
/* Health gauge row needs extra vertical space for the SVG arc. */
.overview-row--gauge { align-items: flex-start; }
.health-gauge { display: block; }
.overview-label {
    flex-shrink: 0;
    min-width: 8ch;
    color: var(--muted);
    font-weight: 500;
}
.overview-value {
    word-break: break-all;
    color: var(--text);
}
.overview-file-link {
    color: var(--link);
    text-decoration: none;
    cursor: pointer;
}
.overview-file-link:hover {
    text-decoration: underline;
}
.overview-stats {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
    margin: var(--space-2) 0;
}
.overview-stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    min-width: 60px;
    padding: 6px 10px;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--surface-2);
    transition: border-color 0.15s ease, transform 0.15s ease;
}
.overview-stat:hover {
    border-color: var(--link);
    transform: translateY(-1px);
}
.stat-count {
    font-size: var(--text-h2);
    font-weight: 700;
    color: var(--text);
}
.stat-label {
    /* No 10px token; --text-caption (11px) is the smallest type-scale step. */
    font-size: var(--text-caption);
    color: var(--muted);
    text-align: center;
}
/* Severity-keyed top border on stat cards so the eye reads error/warning/info at a glance. */
.overview-stat[data-severity="error"] { border-top: 3px solid var(--stat-border-error); }
.overview-stat[data-severity="warning"] { border-top: 3px solid var(--stat-border-warning); }
.overview-stat[data-severity="info"] { border-top: 3px solid var(--stat-border-info); }
`;
}

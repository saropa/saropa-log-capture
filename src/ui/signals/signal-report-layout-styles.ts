/**
 * CSS for the signal report two-column responsive grid and collapsible sections.
 * Extracted to keep signal-report-styles.ts under the 300-line limit.
 */

export function getLayoutStyles(): string {
    return /* css */ `
/* --- Report header --- */
.report-header {
    margin-bottom: var(--space-3);
}
.report-header .btn-row {
    margin: var(--space-1) 0 0;
}

/* --- Two-column responsive grid ---
 * Single column on narrow panels (<900px), two columns on wide monitors.
 * Primary column (overview, evidence, details, related) gets more space
 * because evidence blocks contain wide code lines.
 */
.report-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 0 20px;
}
@media (min-width: 900px) {
    .report-grid {
        grid-template-columns: 3fr 2fr;
        align-items: start;
    }
}

/* --- Collapsible sections ---
 * Each section is a <details> with a <summary> toggle.
 * The triangle marker is replaced with a subtle chevron via CSS.
 */
.section-slot {
    margin: 0 0 var(--space-1);
    min-height: 0;
    border-left: 3px solid transparent;
    padding-left: var(--space-2);
    transition: border-color 0.2s ease;
}
.section-toggle {
    cursor: pointer;
    list-style: none;
    user-select: none;
    display: flex;
    align-items: center;
    gap: 6px;
}
/* Remove default <details> marker across browsers */
.section-toggle::-webkit-details-marker { display: none; }
.section-toggle::marker { content: ''; }

/* Chevron indicator — rotates when section is open */
.section-toggle::before {
    content: '';
    display: inline-block;
    width: 0;
    height: 0;
    border-style: solid;
    border-width: 5px 0 5px 6px;
    border-color: transparent transparent transparent var(--muted);
    transition: transform 0.15s ease;
    flex-shrink: 0;
}
details[open] > .section-toggle::before {
    transform: rotate(90deg);
}

/* Override the default h2 margin inside toggles — the toggle handles spacing */
.section-toggle h2 {
    margin: var(--space-2) 0 var(--space-1);
    flex: 1;
}

.section-body {
    padding: 0 0 var(--space-1);
}

/* --- Section accent borders ---
 * Subtle left-border tint per section category so the eye can
 * quickly scan which group a section belongs to.
 */
.section-slot:hover {
    border-left-color: var(--link);
}
/* Per-section accent tints by category role: info-blue for context sections
   (overview, recommendations), brand-orange for the core evidence (evidence,
   details), warning-yellow for the related/secondary signal groups, and a muted
   neutral for the supporting history/ecosystem sections. Tints come from
   color-mix on the semantic tokens so they track the host theme. */
#section-overview { border-left-color: color-mix(in srgb, var(--accent-info) 35%, transparent); }
#section-evidence { border-left-color: color-mix(in srgb, var(--brand-2) 35%, transparent); }
#section-details { border-left-color: color-mix(in srgb, var(--brand-2) 35%, transparent); }
#section-related { border-left-color: color-mix(in srgb, var(--accent-warning) 25%, transparent); }
#section-other-signals { border-left-color: color-mix(in srgb, var(--accent-warning) 25%, transparent); }
#section-history { border-left-color: color-mix(in srgb, var(--muted) 25%, transparent); }
#section-recommendations { border-left-color: color-mix(in srgb, var(--accent-info) 25%, transparent); }
#section-ecosystem { border-left-color: color-mix(in srgb, var(--muted) 20%, transparent); }
`;
}

/**
 * CSS for the signal report two-column responsive grid and collapsible sections.
 * Extracted to keep signal-report-styles.ts under the 300-line limit.
 */

export function getLayoutStyles(): string {
    return /* css */ `
/* --- Report header --- */
.report-header {
    margin-bottom: 12px;
}
.report-header .btn-row {
    margin: 4px 0 0;
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
    margin: 0 0 4px;
    min-height: 0;
    border-left: 3px solid transparent;
    padding-left: 8px;
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
    border-color: transparent transparent transparent var(--vscode-descriptionForeground);
    transition: transform 0.15s ease;
    flex-shrink: 0;
}
details[open] > .section-toggle::before {
    transform: rotate(90deg);
}

/* Override the default h2 margin inside toggles — the toggle handles spacing */
.section-toggle h2 {
    margin: 8px 0 4px;
    flex: 1;
}

.section-body {
    padding: 0 0 4px;
}

/* --- Section accent borders ---
 * Subtle left-border tint per section category so the eye can
 * quickly scan which group a section belongs to.
 */
.section-slot:hover {
    border-left-color: var(--vscode-textLink-foreground, #3794ff);
}
#section-overview { border-left-color: rgba(55, 148, 255, 0.35); }
#section-evidence { border-left-color: rgba(234, 92, 0, 0.35); }
#section-details { border-left-color: rgba(234, 92, 0, 0.35); }
#section-related { border-left-color: rgba(204, 167, 0, 0.25); }
#section-other-signals { border-left-color: rgba(204, 167, 0, 0.25); }
#section-history { border-left-color: rgba(128, 128, 128, 0.25); }
#section-recommendations { border-left-color: rgba(55, 148, 255, 0.25); }
#section-ecosystem { border-left-color: rgba(128, 128, 128, 0.2); }
`;
}

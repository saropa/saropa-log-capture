/**
 * Signal panel CSS: add-to-case button, hero block, embedded performance panel.
 */

/** Return CSS for Signal panel hero and add-to-case styles. */
export function getSignalHeroStyles(): string {
    return /* css */ `

/* Inline add-to-case button on recurring cards */
.re-add-to-case {
    margin-right: var(--space-1);
    font-weight: bold;
    cursor: pointer;
}

.re-add-to-case:hover {
    text-decoration: underline;
}

/* Embedded performance panel inside Signal panel */
.signal-hero-block {
    padding-bottom: 6px;
    padding-left: var(--space-2);
    margin-left: calc(-1 * var(--space-2));
    border-left: 3px solid transparent;
    border-bottom: 1px solid var(--vscode-panel-border);
    margin-bottom: var(--space-1);
}

.signal-hero-block.signal-hero-has-errors {
    border-left-color: var(--vscode-errorForeground, var(--accent-critical));
}

.signal-hero-block.signal-hero-has-warnings {
    border-left-color: var(--vscode-editorWarning-foreground, var(--accent-warning));
}

.signal-hero-block.signal-hero-has-errors.signal-hero-has-warnings {
    border-left-color: var(--vscode-errorForeground, var(--accent-critical));
}

/* The error/warning COUNT is the headline of the hero. Without emphasis the whole metric line is
   flat 11px text and "5" reads no louder than its label. Bumping the number to 13px/700 with the
   severity color (and tabular figures so multi-digit counts stay aligned) makes the count the first
   thing the eye lands on. flex-shrink:0 keeps it from collapsing when the hero row is tight. */
.signal-hero-num {
    font-size: var(--text-body);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    flex-shrink: 0;
}

.signal-hero-num-error { color: var(--vscode-errorForeground); }
.signal-hero-num-warn { color: var(--vscode-editorWarning-foreground); }

.signal-section-session-details .performance-panel {
    display: flex !important;
    min-width: 0;
    border: none;
    box-shadow: none;
    background: transparent;
}

.signal-section-session-details .performance-panel-header {
    padding: var(--space-1) 0 var(--space-2);
}

.signal-section-session-details .pp-close {
    display: none;
}
`;
}

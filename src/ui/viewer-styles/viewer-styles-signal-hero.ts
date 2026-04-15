/**
 * Signal panel CSS: add-to-case button, hero block, embedded performance panel.
 */

/** Return CSS for Signal panel hero and add-to-case styles. */
export function getSignalHeroStyles(): string {
    return /* css */ `

/* Inline add-to-case button on recurring cards */
.re-add-to-case {
    margin-right: 4px;
    font-weight: bold;
    cursor: pointer;
}

.re-add-to-case:hover {
    text-decoration: underline;
}

/* Embedded performance panel inside Signal panel */
.signal-hero-block {
    padding-bottom: 6px;
    padding-left: 8px;
    margin-left: -8px;
    border-left: 3px solid transparent;
    border-bottom: 1px solid var(--vscode-panel-border);
    margin-bottom: 4px;
}

.signal-hero-block.signal-hero-has-errors {
    border-left-color: var(--vscode-errorForeground, #f14c4c);
}

.signal-hero-block.signal-hero-has-warnings {
    border-left-color: var(--vscode-editorWarning-foreground, #cca700);
}

.signal-hero-block.signal-hero-has-errors.signal-hero-has-warnings {
    border-left-color: var(--vscode-errorForeground, #f14c4c);
}

.signal-section-session-details .performance-panel {
    display: flex !important;
    min-width: 0;
    border: none;
    box-shadow: none;
    background: transparent;
}

.signal-section-session-details .performance-panel-header {
    padding: 4px 0 8px;
}

.signal-section-session-details .pp-close {
    display: none;
}
`;
}

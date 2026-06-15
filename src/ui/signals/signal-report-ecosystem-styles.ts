/** CSS for the ecosystem (companion extensions) section of the signal report. */

export function getEcosystemStyles(): string {
    return /* css */ `
/* Companion extensions (ecosystem) section */
.ecosystem-block { margin: var(--space-2) 0; }
.ecosystem-block-heading { font-weight: 600; font-size: var(--text-caption); margin: 0 0 var(--space-1); }
.ecosystem-data { margin: var(--space-1) 0; }
.ecosystem-data-row { display: flex; gap: var(--space-2); padding: 2px 0; font-size: var(--text-caption); }
.ecosystem-data-label { flex-shrink: 0; min-width: 14ch; color: var(--muted); font-weight: 500; }
.ecosystem-data-value { word-break: break-all; }
.ecosystem-status { display: flex; align-items: center; gap: 6px; font-size: var(--text-caption); padding: var(--space-1) 0; color: var(--muted); }
.ecosystem-status-icon { color: var(--vscode-testing-iconPassed, var(--status-good)); font-weight: 700; }
.ecosystem-prompt {
    padding: var(--space-2) var(--space-3);
    margin: var(--space-1) 0;
    border: 1px dashed var(--border);
    border-radius: var(--radius-sm);
    background: var(--surface-2);
    font-size: var(--text-caption);
}
.ecosystem-prompt-label { font-weight: 600; display: block; margin-bottom: 2px; }
.ecosystem-prompt-benefit { display: block; color: var(--muted); margin-bottom: 6px; }
.ecosystem-prompt-link {
    color: var(--link);
    cursor: pointer;
    text-decoration: none;
    font-weight: 500;
}
.ecosystem-prompt-link:hover { text-decoration: underline; }
`;
}

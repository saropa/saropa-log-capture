/**
 * Signal panel CSS: panel container, header, content, accordion section structure.
 */

/** Return CSS for Signal panel layout and accordion structure. */
export function getSignalLayoutStyles(): string {
    return /* css */ `

/* ===================================================================
   Signal Panel — single scroll (Cases, Recurring, Hot files, Performance)
   =================================================================== */
.signal-panel {
    width: 100%;
    min-width: 280px;
    height: 100%;
    background: var(--vscode-sideBar-background, var(--vscode-editor-background));
    border-right: 1px solid var(--vscode-sideBar-border, var(--vscode-panel-border));
    /* Slide-out edge lift: the panel floats over the log rows, so use the
       overlay elevation token rather than a baked black alpha. */
    box-shadow: var(--shadow-lg);
    display: none;
    flex-direction: column;
    overflow: hidden;
}

.signal-panel.visible {
    display: flex;
}

.signal-panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-2) var(--space-3);
    font-weight: 600;
    font-size: 12px;
    border-bottom: 1px solid var(--vscode-panel-border);
    flex-shrink: 0;
}

.signal-panel-actions {
    display: flex;
    align-items: center;
    gap: var(--space-1);
}

.signal-panel-copy-md {
    background: none;
    border: none;
    color: var(--vscode-descriptionForeground);
    cursor: pointer;
    padding: var(--space-1);
    border-radius: var(--radius-sm);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color 0.12s ease, background 0.12s ease;
}

.signal-panel-copy-md:hover {
    color: var(--vscode-foreground);
    /* Toolbar hover scrim; the fallback is a faint text-tint so it tracks the
       theme instead of a fixed neutral gray when the host var is absent. */
    background: var(--vscode-toolbar-hoverBackground, color-mix(in srgb, var(--text) 30%, transparent));
}

.signal-panel-close {
    background: none;
    border: none;
    color: var(--vscode-descriptionForeground);
    cursor: pointer;
    /* 16px matches the close glyph in the Performance and Crashlytics panels; 18px here made
       the Signal panel's close button visibly larger than its siblings (inconsistent affordance). */
    font-size: 16px;
    line-height: 1;
    padding: 2px 6px;
    border-radius: var(--radius-sm);
    transition: color 0.12s ease, background 0.12s ease;
}

.signal-panel-close:hover {
    color: var(--vscode-errorForeground, var(--accent-critical));
    background: var(--vscode-toolbar-hoverBackground, color-mix(in srgb, var(--text) 30%, transparent));
}

.signal-panel-content {
    flex: 1;
    min-height: 0;
    overflow: auto;
    padding: 0 var(--space-2) var(--space-2);
}

/* Accordion sections */
.signal-section {
    border-bottom: 1px solid var(--vscode-panel-border);
    margin-bottom: var(--space-1);
}

.signal-section:last-child {
    border-bottom: none;
}

.signal-section-header {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: none;
    border: none;
    color: var(--vscode-foreground);
    cursor: pointer;
    font-size: 12px;
    font-weight: 600;
    padding: var(--space-2) var(--space-1);
    text-align: left;
    transition: background 0.12s ease, color 0.12s ease;
}

.signal-section-header:hover {
    background: var(--vscode-toolbar-hoverBackground, color-mix(in srgb, var(--text) 15%, transparent));
    color: var(--vscode-foreground);
}

.signal-section-emoji {
    margin-right: 6px;
    font-size: 14px;
    line-height: 1;
    flex-shrink: 0;
}

.signal-section-title {
    flex: 1;
}

.signal-section-toggle {
    width: 16px;
    height: 16px;
    opacity: 0.7;
    transition: transform 0.15s ease;
}

.signal-section-toggle::before {
    content: "\\25BC";
    font-size: 10px;
}

.signal-section-header.expanded .signal-section-toggle {
    transform: rotate(0deg);
}

.signal-section-header:not(.expanded) .signal-section-toggle {
    transform: rotate(-90deg);
}

.signal-section-body {
    padding: var(--space-1) 0 var(--space-3);
    overflow: hidden;
}

.signal-section .session-collections {
    flex: 0 0 auto;
}
`;
}

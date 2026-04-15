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
    box-shadow: 2px 0 8px rgba(0, 0, 0, 0.3);
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
    padding: 8px 12px;
    font-weight: 600;
    font-size: 12px;
    border-bottom: 1px solid var(--vscode-panel-border);
    flex-shrink: 0;
}

.signal-panel-actions {
    display: flex;
    align-items: center;
    gap: 4px;
}

.signal-panel-copy-md {
    background: none;
    border: none;
    color: var(--vscode-descriptionForeground);
    cursor: pointer;
    padding: 4px;
    border-radius: 3px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color 0.12s ease, background 0.12s ease;
}

.signal-panel-copy-md:hover {
    color: var(--vscode-foreground);
    background: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31));
}

.signal-panel-close {
    background: none;
    border: none;
    color: var(--vscode-descriptionForeground);
    cursor: pointer;
    font-size: 18px;
    line-height: 1;
    padding: 2px 6px;
    border-radius: 3px;
    transition: color 0.12s ease, background 0.12s ease;
}

.signal-panel-close:hover {
    color: var(--vscode-foreground);
    background: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31));
}

.signal-panel-content {
    flex: 1;
    min-height: 0;
    overflow: auto;
    padding: 0 8px 8px;
}

/* Accordion sections */
.signal-section {
    border-bottom: 1px solid var(--vscode-panel-border);
    margin-bottom: 4px;
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
    padding: 8px 4px;
    text-align: left;
    transition: background 0.12s ease, color 0.12s ease;
}

.signal-section-header:hover {
    background: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.15));
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
    padding: 4px 0 12px;
    overflow: hidden;
}

.signal-section .session-investigations {
    flex: 0 0 auto;
}
`;
}

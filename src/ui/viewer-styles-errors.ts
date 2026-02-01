/**
 * CSS styles for error breakpoint alerts in the viewer.
 *
 * Includes flash effects, error badge, and modal styles.
 */
export function getErrorStyles(): string {
    return /* css */ `

/* ===================================================================
   Error Flash Effect
   Red border flash when errors are detected.
   =================================================================== */
@keyframes error-flash {
    0%, 100% { box-shadow: none; }
    50% { box-shadow: inset 0 0 0 3px var(--vscode-errorForeground, #f44); }
}

#log-content.error-flash {
    animation: error-flash 0.3s ease-in-out;
}

/* ===================================================================
   Error Badge
   Shows count of new errors in footer.
   =================================================================== */
#error-badge {
    padding: 2px 6px;
    border-radius: 3px;
    background: var(--vscode-errorBackground, rgba(244, 68, 68, 0.1));
    font-size: 10px;
    transition: all 0.2s ease;
}

#error-badge:hover {
    background: var(--vscode-errorBackground, rgba(244, 68, 68, 0.2));
}

/* ===================================================================
   Error Modal
   Popup alert when errors are detected.
   =================================================================== */
.error-modal {
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 300;
    align-items: center;
    justify-content: center;
}

.error-modal.visible {
    display: flex;
}

.error-modal-content {
    background: var(--vscode-editorWidget-background);
    border: 1px solid var(--vscode-errorForeground, #f44);
    border-radius: 4px;
    padding: 16px;
    max-width: 400px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
}

.error-modal-content h3 {
    margin: 0 0 8px 0;
    color: var(--vscode-errorForeground, #f44);
    font-size: 14px;
}

.error-modal-content p {
    margin: 0 0 12px 0;
    font-size: 12px;
}

.error-modal-btn {
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border: none;
    padding: 4px 12px;
    border-radius: 2px;
    cursor: pointer;
    font-size: 12px;
}

.error-modal-btn:hover {
    background: var(--vscode-button-hoverBackground);
}

/* Error breakpoint toggle button */
#error-breakpoint-toggle {
    background: none;
    border: 1px solid var(--vscode-descriptionForeground);
    color: var(--vscode-descriptionForeground);
    font-size: 10px;
    padding: 1px 6px;
    cursor: pointer;
    border-radius: 3px;
}

#error-breakpoint-toggle:hover {
    background: var(--vscode-button-hoverBackground);
    color: var(--vscode-button-foreground);
}
`;
}

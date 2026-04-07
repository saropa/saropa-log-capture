/**
 * CSS styles for the edit line modal dialog in the viewer webview.
 *
 * Extracted from viewer-styles-modal.ts to keep files under the
 * 300-line code limit.
 */
export function getEditModalStyles(): string {
    return /* css */ `

/* ===================================================================
   Edit Line Modal
   Modal dialog for editing a log line and saving changes to file.
   =================================================================== */
.edit-modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 400;
}

.edit-modal-content {
    background: var(--vscode-editorWidget-background);
    border: 1px solid var(--vscode-panel-border);
    border-radius: 4px;
    padding: 0;
    min-width: 500px;
    max-width: 80vw;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
    display: flex;
    flex-direction: column;
}

.edit-modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    border-bottom: 1px solid var(--vscode-panel-border);
    font-weight: 500;
    font-size: 13px;
}

.edit-modal-close {
    background: none;
    border: none;
    color: var(--vscode-descriptionForeground);
    font-size: 16px;
    cursor: pointer;
    padding: 0;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.edit-modal-close:hover {
    color: var(--vscode-foreground);
}

.edit-warning {
    background: var(--vscode-inputValidation-warningBackground, rgba(252, 192, 0, 0.15));
    color: var(--vscode-inputValidation-warningForeground, #fc0);
    padding: 8px 16px;
    font-size: 11px;
    border-bottom: 1px solid var(--vscode-inputValidation-warningBorder, rgba(252, 192, 0, 0.3));
}

#edit-modal-textarea {
    width: 100%;
    min-height: 100px;
    padding: 12px 16px;
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: none;
    font-family: var(--vscode-editor-font-family, monospace);
    font-size: var(--vscode-editor-font-size, 13px);
    resize: vertical;
    outline: none;
}

#edit-modal-textarea:focus {
    background: var(--vscode-input-background);
    outline: 1px solid var(--vscode-focusBorder);
}

.edit-modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding: 12px 16px;
    border-top: 1px solid var(--vscode-panel-border);
}

.edit-modal-btn {
    padding: 6px 14px;
    border: none;
    border-radius: 2px;
    cursor: pointer;
    font-size: 12px;
    font-family: inherit;
}

.edit-modal-save {
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
}

.edit-modal-save:hover {
    background: var(--vscode-button-hoverBackground);
}

.edit-modal-cancel {
    background: var(--vscode-button-secondaryBackground);
    color: var(--vscode-button-secondaryForeground);
}

.edit-modal-cancel:hover {
    background: var(--vscode-button-secondaryHoverBackground);
}
`;
}

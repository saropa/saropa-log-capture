/**
 * CSS styles for the export logs modal dialog in the viewer webview.
 *
 * Edit line modal styles are in viewer-styles-edit-modal.ts.
 */
export function getModalStyles(): string {
    return /* css */ `

/* ===================================================================
   Export Modal
   Modal dialog for exporting logs with level-based filtering and
   preset templates (Errors Only, Full Debug, etc.).
   =================================================================== */
.modal {
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.6);
    align-items: center;
    justify-content: center;
    z-index: 400;
}
.modal.visible { display: flex; }

.modal-content {
    background: var(--vscode-editorWidget-background);
    border: 1px solid var(--vscode-panel-border);
    border-radius: 4px;
    padding: 0;
    min-width: 450px;
    max-width: 600px;
    max-height: 80vh;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
    display: flex;
    flex-direction: column;
}

.modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    border-bottom: 1px solid var(--vscode-panel-border);
    font-weight: 500;
    font-size: 13px;
}

.modal-close {
    background: none;
    border: none;
    color: var(--vscode-descriptionForeground);
    font-size: 18px;
    cursor: pointer;
    padding: 0;
    width: 20px;
    height: 20px;
    line-height: 1;
}
.modal-close:hover { color: var(--vscode-foreground); }

.modal-body {
    padding: 16px;
    overflow-y: auto;
    max-height: 60vh;
}

/* Export accordion — collapsible sections with selection counts */
.export-accordion {
    border: 1px solid var(--vscode-panel-border);
    border-radius: 3px;
    margin-bottom: 8px;
}
.export-accordion-header {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    padding: 6px 8px;
    background: var(--vscode-sideBar-background, var(--vscode-panel-background));
    border: none;
    color: var(--vscode-foreground);
    font-size: 11px;
    cursor: pointer;
    text-align: left;
    border-radius: 3px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}
.export-accordion-header:hover {
    background: var(--vscode-list-hoverBackground);
}
.export-accordion-arrow {
    font-size: 14px;
    flex-shrink: 0;
    transition: transform 0.15s ease;
}
.export-accordion.expanded .export-accordion-arrow {
    transform: rotate(90deg);
}
.export-accordion-title { font-weight: 600; }
.export-accordion-summary {
    flex: 1;
    text-align: right;
    font-size: 10px;
    color: var(--vscode-descriptionForeground);
    text-transform: none;
    letter-spacing: normal;
}
.export-accordion-body {
    max-height: 0;
    opacity: 0;
    overflow: hidden;
    padding: 0 8px;
    transition: max-height 0.2s ease, opacity 0.2s ease,
                padding-top 0.15s ease, padding-bottom 0.15s ease;
}
.export-accordion.expanded .export-accordion-body {
    max-height: 300px;
    opacity: 1;
    padding: 4px 8px 8px;
}

@media (prefers-reduced-motion: reduce) {
    .export-accordion-arrow,
    .export-accordion-body { transition: none !important; }
}

.export-section {
    margin-bottom: 16px;
}
.export-section h4 {
    font-size: 11px;
    font-weight: 600;
    color: var(--vscode-descriptionForeground);
    margin-bottom: 8px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.export-section select {
    width: 100%;
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border, transparent);
    padding: 6px 8px;
    border-radius: 2px;
    font-size: 12px;
    cursor: pointer;
}

.export-checkbox {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 0;
    cursor: pointer;
    font-size: 12px;
}
.export-checkbox input[type="checkbox"] {
    accent-color: var(--vscode-button-background);
}
.export-checkbox:hover {
    color: var(--vscode-foreground);
}

#export-preview {
    background: var(--vscode-textBlockQuote-background, rgba(127, 127, 127, 0.1));
    border-left: 2px solid var(--vscode-textBlockQuote-border, #007acc);
    padding: 8px 12px;
    border-radius: 2px;
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
}

#export-line-count {
    font-weight: 600;
    color: var(--vscode-foreground);
}

.modal-footer {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    border-top: 1px solid var(--vscode-panel-border);
}
.modal-footer-spacer { flex: 1; }

.modal-btn {
    padding: 6px 14px;
    border: none;
    border-radius: 2px;
    cursor: pointer;
    font-size: 12px;
    font-family: inherit;
    background: var(--vscode-button-secondaryBackground);
    color: var(--vscode-button-secondaryForeground);
}
.modal-btn:hover {
    background: var(--vscode-button-secondaryHoverBackground);
}

.modal-btn-primary {
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
}
.modal-btn-primary:hover {
    background: var(--vscode-button-hoverBackground);
}

/* Log file path actions (footer filename) */
.log-file-modal-content {
    min-width: 280px;
    max-width: 400px;
}
.log-file-modal-body {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding-top: 4px;
    padding-bottom: 16px;
}
.log-file-modal-btn {
    width: 100%;
    text-align: center;
}
`;
}

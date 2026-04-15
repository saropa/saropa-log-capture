/** CSS styles for exclusion pattern chips and audio preview controls in the options panel. */
export function getExclusionChipStyles(): string {
    return /* css */ `
/* --- Exclusion pattern chips: removable pills in noise-reduction section --- */
.exclusion-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    padding: 4px 0 2px;
}
.exclusion-chip {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    font-size: 11px;
    padding: 2px 6px;
    border-radius: 10px;
    border: 1px solid var(--vscode-descriptionForeground);
    background: var(--vscode-button-secondaryBackground, rgba(90, 93, 94, 0.31));
    color: var(--vscode-button-secondaryForeground, var(--vscode-foreground));
    white-space: nowrap;
    max-width: 100%;
    transition: opacity 0.15s;
}
.exclusion-chip-text {
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 180px;
}
.exclusion-chip-remove {
    background: none;
    border: none;
    color: var(--vscode-descriptionForeground);
    font-size: 12px;
    cursor: pointer;
    padding: 0 2px;
    line-height: 1;
}
.exclusion-chip-remove:hover {
    color: var(--vscode-errorForeground, #f44);
}
.exclusion-chips-disabled .exclusion-chip {
    opacity: 0.4;
}

/* --- Inline exclusion add input --- */
.exclusion-input-wrapper {
    display: flex;
    align-items: center;
    background: var(--vscode-input-background);
    border: 1px solid var(--vscode-input-border, transparent);
    border-radius: 2px;
    margin: 4px 0;
}

/* Checkbox toggle inline with the exclusion text input */
.exclusion-toggle {
    display: flex;
    align-items: center;
    padding: 4px 2px 4px 6px;
    cursor: pointer;
    flex-shrink: 0;
}
.exclusion-toggle input[type="checkbox"] {
    accent-color: var(--vscode-button-background);
    cursor: pointer;
    margin: 0;
}

.exclusion-input-wrapper:focus-within {
    border-color: var(--vscode-focusBorder);
}
#exclusion-add-input {
    flex: 1;
    min-width: 0;
    background: transparent;
    color: var(--vscode-input-foreground);
    border: none;
    padding: 4px 8px;
    font-size: 11px;
    font-family: inherit;
    outline: none;
}
#exclusion-add-btn {
    background: var(--vscode-button-secondaryBackground);
    color: var(--vscode-button-secondaryForeground);
    border: none;
    border-left: 1px solid var(--vscode-input-border, transparent);
    font-size: 11px;
    padding: 4px 10px;
    cursor: pointer;
    flex-shrink: 0;
}
#exclusion-add-btn:hover {
    background: var(--vscode-button-secondaryHoverBackground);
}

/* Audio preview buttons */
.preview-sound-btn {
    background: var(--vscode-button-secondaryBackground);
    color: var(--vscode-button-secondaryForeground);
    border: 1px solid var(--vscode-button-border, transparent);
    font-size: 10px;
    padding: 2px 8px;
    cursor: pointer;
    border-radius: 2px;
    margin-left: 4px;
}

.preview-sound-btn:hover {
    background: var(--vscode-button-secondaryHoverBackground);
}

/* Volume slider (range input) */
input[type="range"] {
    cursor: pointer;
    accent-color: var(--vscode-button-background);
}
`;
}

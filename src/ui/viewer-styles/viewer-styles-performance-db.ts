/** CSS styles for the Performance panel Database tab (Drift rollup + timeline). */
export function getPerformanceDbTabStyles(): string {
    return /* css */ `

/* --- Database tab (Drift rollup + timeline) --- */
.pp-db-view { padding: 8px 12px; font-size: 11px; }
.pp-db-empty, .pp-db-note {
    color: var(--vscode-descriptionForeground);
    margin: 8px 0;
    line-height: 1.45;
}
.pp-db-drift-row {
    margin-bottom: 10px;
    padding: 8px 10px;
    font-size: 11px;
    line-height: 1.45;
    background: var(--vscode-textBlockQuote-background, var(--surface-3));
    border-left: 3px solid var(--vscode-debugConsole-infoForeground, var(--accent-info));
    color: var(--vscode-foreground);
}
.pp-db-drift-title { font-weight: 600; }
.pp-db-drift-open {
    margin-left: 6px;
    padding: 2px 8px;
    font-size: 10px;
    cursor: pointer;
    border: 1px solid var(--vscode-button-border, var(--vscode-panel-border));
    background: var(--vscode-button-secondaryBackground, transparent);
    color: var(--vscode-button-secondaryForeground, var(--vscode-foreground));
    border-radius: 3px;
}
.pp-db-drift-open:hover {
    background: var(--vscode-button-secondaryHoverBackground, var(--vscode-toolbar-hoverBackground));
}
.pp-db-time-filter-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 10px;
    padding: 6px 8px;
    font-size: 10px;
    background: var(--vscode-editor-inactiveSelectionBackground, var(--surface-3));
    border-radius: 4px;
}
.pp-db-clear-time {
    padding: 2px 8px;
    font-size: 10px;
    cursor: pointer;
    border: 1px solid var(--vscode-button-border, var(--vscode-panel-border));
    background: var(--vscode-button-secondaryBackground, transparent);
    color: var(--vscode-button-secondaryForeground, var(--vscode-foreground));
    border-radius: 3px;
}
.pp-db-histo {
    font-size: 10px;
    color: var(--vscode-descriptionForeground);
    margin: 0 0 12px 0;
    line-height: 1.4;
}
.pp-db-summary {
    margin-bottom: 12px;
    line-height: 1.45;
    color: var(--vscode-foreground);
}
.pp-db-timeline { margin-bottom: 14px; }
.pp-db-timeline-label {
    font-size: 10px;
    font-weight: 600;
    margin-bottom: 6px;
    opacity: 0.85;
}
.pp-db-timeline-hint {
    font-weight: 400;
    opacity: 0.75;
}
.pp-db-timeline-track {
    position: relative;
    cursor: crosshair;
    touch-action: none;
}
.pp-db-viewport-band {
    display: none;
    position: absolute;
    left: 0;
    top: 0;
    height: 100%;
    width: 0;
    /* Find-match fallbacks: rgba(234,92,0,…) is the Saropa brand orange — keep
       the viewport highlight on-brand as a translucent tint when the host
       theme does not define a find-match background. */
    background: var(--vscode-editor-findMatchHighlightBackground, color-mix(in srgb, var(--brand-2) 25%, transparent));
    border-left: 1px solid var(--vscode-editor-findMatchBorder, color-mix(in srgb, var(--brand-2) 50%, transparent));
    border-right: 1px solid var(--vscode-editor-findMatchBorder, color-mix(in srgb, var(--brand-2) 50%, transparent));
    pointer-events: none;
    z-index: 1;
    box-sizing: border-box;
}
.pp-db-filter-band {
    display: none;
    position: absolute;
    left: 0;
    top: 0;
    height: 100%;
    width: 0;
    /* Neutral slider tint + focus edge fallbacks: derive the gray fill from the
       foreground at low alpha, and lean on --border-strong (the focus-adjacent
       edge token) when the host theme omits a focus border. */
    background: var(--vscode-minimapSliderBackground, color-mix(in srgb, var(--text) 28%, transparent));
    border: 1px solid var(--vscode-focusBorder, var(--border-strong));
    pointer-events: none;
    z-index: 2;
    box-sizing: border-box;
}
.pp-db-brush-selection {
    display: none;
    position: absolute;
    left: 0;
    top: 0;
    height: 100%;
    width: 0;
    /* Brush selection fallbacks: the teal merge-current tint reads as a positive
       "selected range" highlight, so derive it from --status-good; the dashed
       edge tracks the same info accent as the histogram bars. */
    background: var(--vscode-mergeCurrentContentBackground, color-mix(in srgb, var(--status-good) 20%, transparent));
    border: 1px dashed var(--vscode-debugConsole-infoForeground, var(--accent-info));
    pointer-events: none;
    z-index: 3;
    box-sizing: border-box;
}
.pp-db-bars {
    display: flex;
    align-items: flex-end;
    gap: 2px;
    height: 56px;
    padding: 4px 0;
    border-bottom: 1px solid var(--vscode-panel-border);
    position: relative;
    z-index: 0;
}
.pp-db-bar-wrap {
    flex: 1;
    min-width: 0;
    height: 100%;
    display: flex;
    align-items: flex-end;
    justify-content: center;
}
.pp-db-bar {
    width: 100%;
    max-width: 10px;
    margin: 0 auto;
    min-height: 2px;
    background: var(--vscode-debugConsole-infoForeground, var(--accent-info));
    border-radius: 2px 2px 0 0;
    opacity: 0.85;
}
.pp-db-table-title {
    font-size: 10px;
    font-weight: 600;
    margin: 10px 0 6px 0;
    opacity: 0.85;
}
.pp-db-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 10px;
    font-family: var(--vscode-editor-font-family, monospace);
}
.pp-db-table th {
    text-align: left;
    padding: 4px 6px;
    border-bottom: 1px solid var(--vscode-panel-border);
    font-weight: 600;
    opacity: 0.75;
}
.pp-db-table td {
    padding: 4px 6px;
    border-bottom: 1px solid var(--vscode-panel-border, transparent);
    vertical-align: top;
    word-break: break-all;
}
.pp-db-fp { color: var(--vscode-descriptionForeground); }

`;
}

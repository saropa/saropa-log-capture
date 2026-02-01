/**
 * CSS styles for interactive UI components in the viewer webview.
 *
 * Covers pinned section, exclusion controls, statistics counters,
 * level filter buttons, inline peek, scrollbar minimap, and session header.
 */
export function getUiStyles(): string {
    return /* css */ `

/* ===================================================================
   Pinned Section
   Sticky area at the top of the viewport holding user-pinned lines.
   Scrollable with a max height so it doesn't dominate the view.
   Uses --vscode-panel-background to match the VS Code bottom panel.
   =================================================================== */
#pinned-section {
    position: sticky;
    top: 0;
    z-index: 5;
    /* Panel background blends with the VS Code bottom panel chrome */
    background: var(--vscode-panel-background);
    border-bottom: 1px solid var(--vscode-panel-border);
    max-height: 30vh;  /* cap height so pins don't eat all space */
    overflow-y: auto;
    flex-shrink: 0;
}
.pinned-header {
    font-size: 10px;
    padding: 2px 8px;
    color: var(--vscode-descriptionForeground);
    font-weight: bold;
    border-bottom: 1px solid var(--vscode-panel-border);
}
.pinned-item {
    padding: 0 8px;
    line-height: 1.5;
    white-space: pre-wrap;
    word-break: break-all;
    display: flex;
    align-items: baseline;
    gap: 4px;
    cursor: pointer;  /* click to scroll to original line */
}
.pinned-item:hover {
    background: var(--vscode-list-hoverBackground);
}
/* Small "x" button to remove a pinned line */
.unpin-btn {
    cursor: pointer;
    color: var(--vscode-descriptionForeground);
    font-size: 10px;
    flex-shrink: 0;
}
.unpin-btn:hover {
    color: var(--vscode-errorForeground, #f44);
}
.pinned-text {
    flex: 1;
    overflow: hidden;
}

/* --- Line selection highlight (click or keyboard nav) --- */
.line.selected, .stack-header.selected, .marker.selected {
    background: var(--vscode-editor-selectionBackground, rgba(38, 79, 120, 0.5));
}

/* ===================================================================
   Exclusion Controls
   Footer elements for the pattern-based line exclusion feature.
   =================================================================== */
#exclusion-count {
    font-size: 10px;
    color: var(--vscode-descriptionForeground);
    white-space: nowrap;
}
#exclusion-toggle {
    background: none;
    border: 1px solid var(--vscode-descriptionForeground);
    color: var(--vscode-descriptionForeground);
    font-size: 10px;
    padding: 1px 6px;
    cursor: pointer;
    border-radius: 3px;
}

/* ===================================================================
   Live Statistics Counters
   Real-time running totals for errors, warnings, performance, and info.
   =================================================================== */
#stats-counters {
    display: flex;
    gap: 6px;
    font-size: 10px;
    font-weight: 500;
    align-items: center;
}
.stat-error {
    color: var(--vscode-errorForeground, #f44);
}
.stat-warning {
    color: var(--vscode-editorWarning-foreground, #cca700);
}
.stat-performance {
    color: var(--vscode-debugConsole-infoForeground, #b695f8);
}
.stat-info {
    color: var(--vscode-terminal-ansiGreen, #4ec9b0);
}

/* ===================================================================
   Level Filter Circles
   Independent toggles for each log level (info, warning, error).
   All enabled by default, click to toggle on/off.
   =================================================================== */
.level-filter-group {
    display: flex;
    gap: 4px;
    align-items: center;
}
.level-circle {
    background: none;
    border: none;
    font-size: 14px;
    padding: 2px;
    cursor: pointer;
    opacity: 1;
    transition: opacity 0.2s ease, transform 0.1s ease;
    line-height: 1;
}
.level-circle:hover {
    transform: scale(1.15);
}
/* Inactive (disabled) circles are dimmed, desaturated, and struck through */
.level-circle:not(.active) { opacity: 0.25; filter: grayscale(0.8); text-decoration: line-through; }
/* Lines outside the active level filter are dimmed as context */
.line.context-line { opacity: 0.4; }

/* ===================================================================
   Inline Peek
   Expandable context view inserted inline after the viewport.
   Shows surrounding lines around a double-clicked target line.
   =================================================================== */
.inline-peek {
    border-top: 2px solid var(--vscode-focusBorder, #007acc);
    border-bottom: 2px solid var(--vscode-focusBorder, #007acc);
    background: var(--vscode-editorHoverWidget-background, var(--vscode-editor-background));
    margin: 4px 0;
}
.peek-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 8px;
    font-size: 10px;
    color: var(--vscode-descriptionForeground);
    border-bottom: 1px solid var(--vscode-panel-border);
}
.peek-close {
    background: none;
    border: none;
    color: var(--vscode-descriptionForeground);
    font-size: 14px;
    cursor: pointer;
    padding: 0 4px;
}
.peek-close:hover { color: var(--vscode-errorForeground, #f44); }
.peek-target {
    background: var(--vscode-editor-lineHighlightBackground, rgba(255, 255, 0, 0.15));
    border-left: 3px solid var(--vscode-editorLineNumber-activeForeground, #c6c6c6);
}
.peek-context { opacity: 0.7; }

/* ===================================================================
   Scrollbar Minimap
   Visual overview of search matches, errors, and warnings on scrollbar.
   =================================================================== */
.scrollbar-minimap {
    position: absolute;
    top: 0;
    right: 0;
    width: 8px;
    height: 100%;
    pointer-events: none;
    z-index: 10;
}

.minimap-marker {
    position: absolute;
    width: 100%;
    height: 2px;
    pointer-events: none;
}

.minimap-search-match {
    background: var(--vscode-editorOverviewRuler-findMatchForeground, rgba(234, 92, 0, 0.8));
}

.minimap-current-match {
    background: var(--vscode-editorOverviewRuler-findMatchForeground, rgba(255, 150, 50, 1));
    height: 3px;
    z-index: 2;
}

.minimap-error {
    background: var(--vscode-editorOverviewRuler-errorForeground, rgba(244, 68, 68, 0.8));
}

.minimap-warning {
    background: var(--vscode-editorOverviewRuler-warningForeground, rgba(204, 167, 0, 0.8));
}

.minimap-viewport {
    position: absolute;
    width: 100%;
    background: var(--vscode-scrollbarSlider-background, rgba(121, 121, 121, 0.4));
    border: 1px solid var(--vscode-scrollbarSlider-activeBackground, rgba(191, 191, 191, 0.4));
    pointer-events: none;
    z-index: 1;
}

/* ===================================================================
   Session Header
   Collapsible info block showing session metadata (project, platform,
   debug adapter, etc.). Parsed from context header in log files.
   =================================================================== */
.session-header {
    background: var(--vscode-editorWidget-background, var(--vscode-editor-background));
    border-bottom: 1px solid var(--vscode-panel-border);
    margin: 0;
    padding: 0;
}

.session-header-toggle {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px;
    cursor: pointer;
    font-size: 11px;
    font-weight: 500;
    color: var(--vscode-foreground);
    user-select: none;
}

.session-header-toggle:hover {
    background: var(--vscode-list-hoverBackground, rgba(255, 255, 255, 0.05));
}

.session-chevron {
    font-size: 10px;
    color: var(--vscode-descriptionForeground);
    transition: transform 0.2s ease;
}

.session-title {
    flex: 1;
}

.session-header-content {
    max-height: 500px;
    overflow: hidden;
    transition: max-height 0.3s ease, padding 0.3s ease;
    padding: 8px 12px;
}

.session-header.collapsed .session-header-content {
    max-height: 0;
    padding: 0 12px;
}

.session-info-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 4px;
}

.session-info-row {
    display: flex;
    align-items: baseline;
    gap: 8px;
    font-size: 11px;
    line-height: 1.4;
}

.session-info-key {
    color: var(--vscode-descriptionForeground);
    font-weight: 500;
    min-width: 120px;
    flex-shrink: 0;
}

.session-info-value {
    color: var(--vscode-foreground);
    word-break: break-word;
}
`;
}

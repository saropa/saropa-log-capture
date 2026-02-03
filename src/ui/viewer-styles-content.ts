/**
 * CSS styles for log content rendering in the viewer webview.
 *
 * Covers timing markers, stack trace groups, jump-to-bottom button,
 * footer bar, annotations/timing, and stack trace intelligence.
 */
export function getContentStyles(): string {
    return /* css */ `
/* ===================================================================
   Timing Markers
   User-inserted dividers that visually separate log sections.
   Styled with green accent to stand out from regular log lines.
   =================================================================== */
.marker {
    border-top: 1px solid var(--vscode-editorGutter-addedBackground, #28a745);
    border-bottom: 1px solid var(--vscode-editorGutter-addedBackground, #28a745);
    background: var(--vscode-diffEditor-insertedLineBackground, rgba(40, 167, 69, 0.1));
    color: var(--vscode-editorGutter-addedBackground, #28a745);
    padding: 4px 8px;
    text-align: center;
    font-style: italic;
    line-height: 1.5;
}

/* ===================================================================
   Stack Trace Groups
   Collapsible groups: click the header (error message) to expand/
   collapse the individual stack frames beneath it.
   =================================================================== */
.stack-group { margin: 0; }
.stack-header {
    padding: 0 8px;
    cursor: pointer;
    color: var(--vscode-debugConsole-errorForeground, #f48771);
    line-height: 1.5;
    white-space: pre-wrap;
    word-break: break-all;
    user-select: none;
}
.stack-header:hover { background: var(--vscode-list-hoverBackground); }
/* When collapsed, hide all child frame lines */
.stack-group.collapsed .stack-frames { display: none; }
/* Individual stack frames are indented and dimmed */
.stack-frames .line {
    padding-left: 20px;
    color: var(--vscode-descriptionForeground);
}

/* ===================================================================
   Jump-to-Bottom Button
   Inline button shown at bottom of log content when user scrolls away.
   Positioned absolute within #log-content container.
   =================================================================== */
#log-content {
    position: relative;
}
#jump-btn {
    display: none;      /* shown via JS when not at bottom */
    position: absolute;
    bottom: 8px;
    right: 8px;
    background: var(--vscode-editorWidget-background);
    color: var(--vscode-editorWidget-foreground);
    border: 1px solid var(--vscode-widget-border, var(--vscode-panel-border));
    padding: 4px 10px;
    cursor: pointer;
    border-radius: 4px;
    font-size: 11px;
    opacity: 0.85;
    transition: opacity 0.2s ease;
}
#jump-btn:hover {
    opacity: 1;
    background: var(--vscode-list-hoverBackground);
}

/* ===================================================================
   Footer Bar
   Sticky bar at the bottom showing line count, watch chips, level
   circles, filter badge, and action buttons (search, options).
   Uses --vscode-panel-background to match the VS Code bottom panel.
   =================================================================== */
#footer {
    position: sticky;
    bottom: 0;
    /* Panel background blends with the VS Code bottom panel chrome */
    background: var(--vscode-panel-background);
    border-top: 1px solid var(--vscode-panel-border);
    padding: 4px 8px;
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 4px;
}
/* Warning style when capture is paused */
#footer.paused {
    color: var(--vscode-statusBarItem-warningForeground, #fc0);
    background: var(--vscode-statusBarItem-warningBackground, rgba(252, 192, 0, 0.15));
}

/* --- Shared footer button style --- */
.footer-btn {
    background: none;
    border: 1px solid var(--vscode-descriptionForeground);
    color: var(--vscode-descriptionForeground);
    font-size: 11px;
    padding: 1px 6px;
    cursor: pointer;
    border-radius: 3px;
    white-space: nowrap;
}
.footer-btn:hover {
    background: var(--vscode-button-hoverBackground);
    color: var(--vscode-button-foreground);
}
/* Push right-aligned group to the end of footer */
.footer-spacer { flex: 1; }

/* --- Active filter badge in footer --- */
.filter-badge {
    font-size: 10px;
    padding: 1px 6px;
    border-radius: 8px;
    background: var(--vscode-badge-background, #007acc);
    color: var(--vscode-badge-foreground, #fff);
    cursor: pointer;
    white-space: nowrap;
    font-weight: bold;
    line-height: 1;
}
.filter-badge:hover {
    opacity: 0.85;
}

/* ===================================================================
   Annotations & Timing
   Visual indicators for deduplication notes, slow gaps between
   log lines, and per-line elapsed timestamps.
   =================================================================== */
/* Dedup annotation: "Error (x54)" style inline note */
.annotation {
    padding: 1px 8px 1px 24px;
    font-size: 11px;
    font-style: italic;
    color: var(--vscode-descriptionForeground);
    background: var(--vscode-editor-inactiveSelectionBackground, rgba(255,255,255,0.04));
}
/* Dashed warning line shown when a time gap exceeds the threshold */
.slow-gap {
    text-align: center;
    color: var(--vscode-editorWarning-foreground, #fc0);
    font-size: 10px;
    padding: 2px 0;
    opacity: 0.7;
    border-top: 1px dashed var(--vscode-editorWarning-foreground, rgba(252, 192, 0, 0.3));
}
/* Per-line elapsed time label (e.g. "+1.2s") */
.elapsed-time {
    color: var(--vscode-descriptionForeground);
    font-size: 10px;
    min-width: 50px;
    display: inline-block;
    opacity: 0.7;
}

/* ===================================================================
   Stack Trace Intelligence
   Styles for framework frame dimming, app-only toggle, and
   deduplication badges on repeated stack traces.
   =================================================================== */
/* Framework/library frames are dimmed to highlight app code */
.framework-frame { opacity: 0.4; }
/* Badge showing how many times a stack trace was repeated */
.stack-dedup-badge {
    font-size: 10px;
    opacity: 0.7;
    margin-left: 4px;
}

/* ===================================================================
   Repeat Notifications
   Real-time notifications when duplicate log lines are detected.
   Shows count and preview of repeated message.
   =================================================================== */
.repeat-notification {
    opacity: 0.75;
    font-style: italic;
    color: var(--vscode-descriptionForeground);
}
.repeat-preview {
    font-size: 0.95em;
    opacity: 0.9;
}

/* ===================================================================
   Visual Spacing (Breathing Room)
   Adds configurable margin before/after log sections for readability.
   =================================================================== */
.spacing-before {
    margin-top: 12px;
}
.spacing-after {
    margin-bottom: 12px;
}

/* ===================================================================
   Session Info — compact prefix line + slide-out panel
   =================================================================== */
.session-info-prefix {
    padding: 3px 8px;
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
    background: var(--vscode-editorWidget-background, var(--vscode-editor-background));
    border-bottom: 1px solid var(--vscode-panel-border);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex-shrink: 0;
}

/* --- Info panel (slide-out, same pattern as session/options panels) --- */
.info-panel {
    position: fixed;
    right: -100%;
    top: 0;
    bottom: 0;
    width: 25%;
    min-width: 240px;
    max-width: 360px;
    background: var(--vscode-sideBar-background, var(--vscode-editor-background));
    border-left: 1px solid var(--vscode-sideBar-border, var(--vscode-panel-border));
    box-shadow: -2px 0 8px rgba(0, 0, 0, 0.3);
    transition: right 0.3s ease;
    z-index: 240;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    pointer-events: none;
}
.info-panel.visible {
    right: var(--icon-bar-width, 36px);
    pointer-events: auto;
}
.info-panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    font-weight: 600;
    font-size: 12px;
    border-bottom: 1px solid var(--vscode-panel-border);
}
.info-panel-close {
    background: none;
    border: none;
    color: var(--vscode-descriptionForeground);
    font-size: 16px;
    cursor: pointer;
    padding: 0 4px;
}
.info-panel-close:hover {
    color: var(--vscode-errorForeground, #f44);
}
.info-panel-content {
    flex: 1;
    overflow-y: auto;
    padding: 8px 12px;
}
.info-panel-empty {
    font-size: 12px;
    color: var(--vscode-descriptionForeground);
    text-align: center;
    padding: 16px 0;
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
    min-width: 100px;
    flex-shrink: 0;
}
.session-info-value {
    color: var(--vscode-foreground);
    word-break: break-word;
}
`;
}

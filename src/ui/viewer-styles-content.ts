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
.line.spacing-before {
    margin-top: 8px;
}
.line.spacing-after {
    margin-bottom: 8px;
}
`;
}

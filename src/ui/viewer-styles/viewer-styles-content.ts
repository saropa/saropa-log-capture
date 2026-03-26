import { getFooterStyles } from './viewer-styles-footer';

/** CSS for timing markers, stack traces, jump button, footer, annotations. */
export function getContentStyles(): string {
    return getFooterStyles() + /* css */ `
/* --- Timing Markers --- */
.marker {
    border-top: 1px solid var(--vscode-editorGutter-addedBackground, #28a745);
    border-bottom: 1px solid var(--vscode-editorGutter-addedBackground, #28a745);
    background: var(--vscode-diffEditor-insertedLineBackground, rgba(40, 167, 69, 0.1));
    color: var(--vscode-editorGutter-addedBackground, #28a745);
    padding: 4px 8px 4px 16px;
    text-align: center;
    font-style: italic;
    line-height: 1.5;
}
.slow-query-burst-marker {
    cursor: pointer;
    font-style: italic;
    text-decoration: underline;
    text-underline-offset: 2px;
}
.slow-query-burst-marker:hover {
    color: var(--vscode-textLink-activeForeground, var(--vscode-textLink-foreground));
}

/* --- Stack Trace Groups --- */
.stack-group { margin: 0; }
.stack-header {
    padding: 0 8px 0 16px;
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
    padding-left: 28px;
    color: var(--vscode-descriptionForeground);
}
/* Thread header lines from Android/Java thread dumps */
.thread-header {
    color: var(--vscode-textLink-foreground);
    font-weight: 600;
    font-style: italic;
}
/* Thread dump summary marker injected before multi-thread dumps */
.thread-dump-summary {
    color: var(--vscode-debugConsole-warningForeground, #ff9800);
    font-weight: 700;
    font-size: 0.95em;
}
/* ANR pattern warning badge on blocking threads */
.anr-badge { color: var(--vscode-editorWarning-foreground, #fc0); margin-right: 4px; }
.anr-warning { color: var(--vscode-editorWarning-foreground, #fc0); }

/* Correlation badge: line is part of a detected correlation */
.correlation-badge { color: var(--vscode-textLink-foreground); cursor: pointer; margin-left: 2px; }
.correlation-badge:hover { text-decoration: underline; }

/* ===================================================================
   Jump-to-Top / Jump-to-Bottom Buttons
   Position and inset come from syncJumpButtonInset() (fixed + viewport rects). Opacity-only
   animation avoids transform on the buttons conflicting with compositor positioning.
   =================================================================== */
#log-content {
    position: relative;
}
@keyframes jump-btn-fade-in { from { opacity: 0; } to { opacity: 0.85; } }
#jump-btn, #jump-top-btn {
    display: none;
    position: fixed;
    left: auto;
    right: 8px;
    background: var(--vscode-editorWidget-background);
    color: var(--vscode-editorWidget-foreground);
    border: 1px solid var(--vscode-widget-border, var(--vscode-panel-border));
    padding: 4px 10px;
    cursor: pointer;
    border-radius: 4px;
    font-size: 11px;
    opacity: 0.85;
    z-index: 15;
    transition: opacity 0.2s ease;
    animation: jump-btn-fade-in 0.2s ease-out;
    pointer-events: auto;
}
#jump-btn { bottom: 8px; }
#jump-top-btn { top: 8px; }
#jump-btn:hover, #jump-top-btn:hover {
    opacity: 1;
    background: var(--vscode-list-hoverBackground);
}

/* ===================================================================
   Annotations & Timing
   Visual indicators for deduplication notes, slow gaps between
   log lines, and per-line elapsed timestamps.
   =================================================================== */
/* Dedup annotation: "Error (x54)" style inline note */
.annotation {
    padding: 1px 8px 1px 32px;
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
/* Consecutive duplicate lines collapsed in compress mode (same styling family as stack dedup). */
.compress-dup-badge {
    font-size: 10px;
    opacity: 0.75;
    margin-right: 6px;
    color: var(--vscode-descriptionForeground);
    font-style: normal;
    vertical-align: baseline;
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

`;
}

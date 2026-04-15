"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLineStyles = getLineStyles;
/** CSS for individual log lines, copy float, links, focus indicators, level colors, separators, and no-wrap. */
function getLineStyles() {
    return /* css */ `
/* --- Individual log lines --- */
.line {
    white-space: pre-wrap;
    /* break-all shredded monospace decorations; Debug Console–style wrapping first, break long tokens only if needed. */
    word-break: normal;
    overflow-wrap: anywhere;
    padding: 0 8px 0 1.85em;
    line-height: var(--log-line-height, 1.5);
    height: calc(1em * var(--log-line-height, 1.5));
    overflow: visible;
    transition: background 0.1s ease;
}
.line:hover { background: var(--vscode-list-hoverBackground); }

/* --- Floating copy icon (single overlay pinned to right edge of #log-content) --- */
.line, .stack-header { position: relative; }
#copy-float {
    display: none;
    position: absolute;
    font-size: 14px;
    padding: 2px;
    cursor: pointer;
    color: var(--vscode-descriptionForeground);
    background: var(--vscode-editor-background);
    border-radius: 3px;
    user-select: none;
    z-index: 10;
}
#copy-float:hover {
    color: var(--vscode-editor-foreground);
    background: var(--vscode-button-hoverBackground, rgba(90,93,94,0.31));
}
.copy-toast {
    position: fixed;
    bottom: 48px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--vscode-editorWidget-background);
    color: var(--vscode-editorWidget-foreground);
    border: 1px solid var(--vscode-widget-border, var(--vscode-panel-border));
    padding: 4px 12px;
    border-radius: 4px;
    font-size: 12px;
    opacity: 0;
    transition: opacity 0.15s ease;
    pointer-events: none;
    z-index: 300;
}
.copy-toast.visible { opacity: 1; }

/* --- Clickable source file links within log lines --- */
.source-link {
    color: var(--vscode-editorLineNumber-foreground, #858585);
    text-decoration: none;
    cursor: pointer;
    transition: color 0.15s ease;
}
.source-link:hover {
    color: var(--vscode-textLink-foreground, #3794ff);
    text-decoration: underline;
}

/* --- Clickable URL links within log lines --- */
.url-link {
    color: var(--vscode-editorLineNumber-foreground, #858585);
    cursor: pointer;
    text-decoration: underline;
    transition: color 0.15s ease;
}
.url-link:hover {
    color: var(--vscode-textLink-foreground, #3794ff);
}

/* --- Focus indicators for keyboard navigation --- */
button:focus-visible, .ib-icon:focus-visible, input:focus-visible {
    outline: 1px solid var(--vscode-focusBorder, #007acc);
    outline-offset: -1px;
}

/* --- stderr output lines (DAP category "stderr") --- */
.line.cat-stderr {
    color: var(--vscode-debugConsole-errorForeground, #f48771);
}

/* --- Log level styling (error/warning/performance/info) --- */
.line.level-error {
    color: var(--vscode-debugConsole-errorForeground, #f48771);
}
/* Softer than primary fault lines; dashed edge matches severity bar "recent context" tone.
   Uses outline-style trick: inset box-shadow avoids shifting content (no padding override). */
.line.recent-error-context {
    box-shadow: inset 2px 0 0 color-mix(in srgb, var(--vscode-debugConsole-errorForeground, #f48771) 50%, var(--vscode-panel-border, #555));
}
.line.level-error.recent-error-context {
    color: color-mix(in srgb, var(--vscode-debugConsole-errorForeground, #f48771) 72%, var(--vscode-editor-foreground, #d4d4d4));
}
.line.level-warning {
    color: var(--vscode-debugConsole-warningForeground, #cca700);
}
/* Performance: purple bar + text (--vscode-charts-purple) matches level-bar-performance. */
.line.level-performance {
    color: var(--vscode-charts-purple, #a855f7);
}
/* Info: same token as Debug Console info tint, gutter dot, and in-log "Info" highlights. */
.line.level-info {
    color: var(--vscode-debugConsole-infoForeground, #b695f8);
}
.line.level-todo {
    color: var(--vscode-terminal-ansiWhite, #e5e5e5);
    opacity: 0.9;
}
.line.level-debug {
    color: var(--vscode-terminal-ansiYellow, #dcdcaa);
    opacity: 0.8;
}
.line.level-notice {
    color: var(--vscode-charts-blue, #2196f3);
}
.line.level-database {
    color: var(--vscode-terminal-ansiCyan, #00bcd4);
}

/* --- ASCII separator lines (===, ---, +---, Drift/Unicode box banners, etc.) --- */
.line.separator-line {
    color: var(--vscode-terminal-ansiYellow, #dcdcaa);
    opacity: 0.8;
    word-break: normal;
    overflow-wrap: normal;
    /* One row per captured log line; scroll #log-content horizontally if the banner is wider than the pane. */
    white-space: pre;
}

/* --- No-wrap mode: horizontal scroll instead of wrapping --- */
#log-content.nowrap {
    overflow-x: auto;
}
#log-content.nowrap .line,
#log-content.nowrap .stack-header,
#log-content.nowrap .stack-frames .line {
    white-space: pre;
    word-break: normal;
}
`;
}
//# sourceMappingURL=viewer-styles-lines.js.map
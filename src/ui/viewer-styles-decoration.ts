/**
 * CSS styles for log line decorations and settings panel.
 *
 * Covers decoration prefix (severity dot, counter, timestamp),
 * decoration settings panel, severity bars, and whole-line tinting.
 */
export function getDecorationStyles(): string {
    return /* css */ `

/* ===================================================================
   Decoration Prefix & Settings
   Line decoration prefix (severity dot, counter, timestamp) and
   the settings popover panel for toggling individual parts.
   =================================================================== */
/* Decoration prefix (severity dot, counter, timestamp) */
.line-decoration {
    font-size: 11px;
    opacity: 0.85;
    white-space: nowrap;
    user-select: none;
}
.deco-counter {
    color: var(--vscode-editorLineNumber-foreground, #858585);
}

/* Hanging indent for decorated lines: overflow text aligns with content, not decoration */
.line:has(.line-decoration) {
    padding-left: 170px;
    text-indent: -170px;
}
.line:has(.line-decoration) .line-decoration {
    /* Pulled back to left edge by negative text-indent */
    margin-right: 0;
}
/* Emoji toggle buttons (decorations, audio, minimap) */
.emoji-toggle {
    background: none;
    border: 1px solid transparent;
    font-size: 14px;
    padding: 1px 4px;
    cursor: pointer;
    border-radius: 3px;
    transition: opacity 0.15s;
}
.emoji-toggle.toggle-inactive {
    opacity: 0.35;
}
.emoji-toggle:hover {
    background: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31));
}
#deco-toggle {
    /* inherits .emoji-toggle */
}
#deco-settings-btn {
    background: none;
    border: 1px solid var(--vscode-descriptionForeground);
    color: var(--vscode-descriptionForeground);
    font-size: 10px;
    padding: 1px 4px;
    cursor: pointer;
    border-radius: 3px;
}
/* Decoration settings popover panel */
.deco-settings-panel {
    display: none;
    position: fixed;
    z-index: 180;
    background: var(--vscode-menu-background, var(--vscode-editor-background));
    border: 1px solid var(--vscode-menu-border, var(--vscode-panel-border));
    border-radius: 4px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    min-width: 180px;
    padding: 4px 0;
    font-size: 12px;
}
.deco-settings-panel.visible { display: block; }
.deco-settings-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 4px 8px;
    font-size: 11px;
    font-weight: bold;
    color: var(--vscode-foreground);
    border-bottom: 1px solid var(--vscode-menu-separatorBackground, var(--vscode-panel-border));
}
.deco-settings-close {
    background: none;
    border: none;
    color: var(--vscode-descriptionForeground);
    font-size: 14px;
    cursor: pointer;
    padding: 0 4px;
}
.deco-settings-close:hover { color: var(--vscode-errorForeground, #f44); }
.deco-settings-row {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px;
    color: var(--vscode-menu-foreground, var(--vscode-editor-foreground));
    cursor: default;
}
.deco-settings-row:hover {
    background: var(--vscode-menu-selectionBackground, var(--vscode-list-hoverBackground));
}
.deco-settings-row.deco-indent {
    padding-left: 24px;
    font-size: 11px;
}
.deco-settings-row input[type="checkbox"] {
    accent-color: var(--vscode-button-background);
}
.deco-settings-row select {
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border, transparent);
    font-size: 11px;
    padding: 1px 4px;
    border-radius: 2px;
}
.deco-settings-separator {
    height: 1px;
    background: var(--vscode-menu-separatorBackground, var(--vscode-panel-border));
    margin: 4px 8px;
}
/* Whole-line severity tinting (background colors by log level) */
.line.line-tint-error {
    background-color: rgba(255, 60, 60, 0.12);
}
.line.line-tint-error:hover {
    background-color: rgba(255, 60, 60, 0.20);
}
.line.line-tint-warning {
    background-color: rgba(255, 204, 0, 0.10);
}
.line.line-tint-warning:hover {
    background-color: rgba(255, 204, 0, 0.18);
}
.line.line-tint-performance {
    background-color: rgba(180, 140, 255, 0.10);
}
.line.line-tint-performance:hover {
    background-color: rgba(180, 140, 255, 0.18);
}
.line.line-tint-todo {
    background-color: rgba(200, 200, 200, 0.08);
}
.line.line-tint-todo:hover {
    background-color: rgba(200, 200, 200, 0.16);
}
.line.line-tint-debug {
    background-color: rgba(220, 220, 170, 0.08);
}
.line.line-tint-debug:hover {
    background-color: rgba(220, 220, 170, 0.16);
}
.line.line-tint-notice {
    background-color: rgba(79, 193, 255, 0.08);
}
.line.line-tint-notice:hover {
    background-color: rgba(79, 193, 255, 0.16);
}
.line.line-tint-info {
    background-color: rgba(78, 201, 176, 0.06);
}
.line.line-tint-info:hover {
    background-color: rgba(78, 201, 176, 0.14);
}

/* Continuous timeline in log gutter */
#viewport { position: relative; }
#viewport::before {
    content: ''; position: absolute; left: 12px;
    top: 0; bottom: 0; width: 1px;
    background: var(--vscode-panel-border);
    pointer-events: none;
}

/* Severity dot mode (colored circle on timeline) */
[class*="level-bar-"] { z-index: 1; }
[class*="level-bar-"]::before {
    content: ''; position: absolute; left: 8px;
    top: 50%; transform: translateY(-50%);
    width: 9px; height: 9px; border-radius: 50%;
    pointer-events: none;
}
.level-bar-error::before { background: var(--vscode-debugConsole-errorForeground, #f48771); }
.level-bar-warning::before { background: var(--vscode-debugConsole-warningForeground, #cca700); }
.level-bar-performance::before { background: var(--vscode-debugConsole-infoForeground, #b695f8); }
.level-bar-todo::before { background: var(--vscode-terminal-ansiWhite, #e5e5e5); }
.level-bar-debug::before { background: var(--vscode-terminal-ansiYellow, #dcdcaa); }
.level-bar-notice::before { background: var(--vscode-terminal-ansiCyan, #4fc1ff); }
.level-bar-framework::before { background: var(--vscode-textLink-foreground, #3794ff); }
.level-bar-info::before { background: var(--vscode-terminal-ansiGreen, #4ec9b0); }

/* Error classification badges */
.error-badge {
    display: inline-block;
    padding: 1px 6px;
    margin-right: 4px;
    border-radius: 3px;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.5px;
    vertical-align: middle;
}

.error-badge-critical {
    background-color: rgba(255, 0, 0, 0.2);
    color: var(--vscode-errorForeground, #f48771);
    border: 1px solid var(--vscode-errorForeground, #f48771);
}

.error-badge-transient {
    background-color: rgba(255, 165, 0, 0.15);
    color: var(--vscode-debugConsole-warningForeground, #cca700);
    border: 1px solid var(--vscode-debugConsole-warningForeground, #cca700);
}

.error-badge-bug {
    background-color: rgba(255, 105, 180, 0.15);
    color: var(--vscode-debugConsole-errorForeground, #f48771);
    border: 1px solid var(--vscode-debugConsole-errorForeground, #f48771);
}

.error-badge-anr {
    background-color: rgba(255, 152, 0, 0.2);
    color: var(--vscode-debugConsole-warningForeground, #ff9800);
    border: 1px solid rgba(255, 152, 0, 0.3);
}
`;
}

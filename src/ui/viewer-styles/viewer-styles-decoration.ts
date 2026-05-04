import { getDecorationBarStyles } from './viewer-styles-decoration-bars';
import { getCollapseControlStyles } from './viewer-styles-collapse-controls';

/**
 * CSS styles for log line decoration prefix and settings panel.
 *
 * Covers decoration prefix (severity dot, counter, timestamp),
 * decoration settings panel, and emoji toggle buttons.
 *
 * Severity bars, line tints, connectors, and badges are in
 * `viewer-styles-decoration-bars.ts`.
 */
export function getDecorationStyles(): string {
    return /* css */ `

/* ===================================================================
   Decoration Prefix & Settings
   Line decoration prefix (severity dot, counter, timestamp) and
   the settings popover panel for toggling individual parts.
   =================================================================== */
/* Decoration prefix (severity dot, counter, timestamp) — scale with zoom via em */
.line-decoration {
    font-size: 0.85em;
    color: var(--vscode-editorLineNumber-foreground, #858585);
    white-space: nowrap;
    user-select: none;
}

/* Clickable metadata filter toggles (PID, TID, tag) in the decoration prefix. */
.meta-filter-toggle {
    cursor: pointer;
    border-radius: 2px;
    padding: 0 1px;
}
.meta-filter-toggle:hover {
    background: var(--vscode-editor-hoverHighlightBackground, rgba(173, 214, 255, 0.15));
    text-decoration: underline;
}
.deco-parsed-tag {
    color: var(--vscode-textLink-foreground, #3794ff);
}
.deco-pid-tid {
    opacity: 0.7;
}
.deco-level-prefix {
    font-weight: bold;
}

/* Hanging indent for decorated lines: overflow text aligns with content, not decoration. 13em scales with --log-font-size. */
/* When time/number are shown, reserve 1.25em left for severity bar (dot at 0.69em + 0.54em) so the bar does not cover the numbers. */
.line:has(.line-decoration) {
    padding-left: var(--deco-prefix-width-em, 14.25em); /* 1.25em bar clearance + dynamic decoration width */
    text-indent: calc(-1 * var(--deco-content-indent-em, 13em));
}
.line:has(.line-decoration) .line-decoration {
    /* Pulled right of severity bar by padding; indent pulls decoration start to 1.25em */
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
` + getDecorationBarStyles() + getCollapseControlStyles();
}

/**
 * CSS styles for overlay and popup elements in the viewer webview.
 *
 * Covers split breadcrumb, JSON collapsible blocks, and context menu.
 * Decoration and modal styles are in separate modules.
 */
import { getDecorationStyles } from './viewer-styles-decoration';
import { getModalStyles } from './viewer-styles-modal';

export function getOverlayStyles(): string {
    return getDecorationStyles() + getModalStyles() + /* css */ `

/* ===================================================================
   Split Breadcrumb
   Navigation bar shown when viewing a sub-range of the log
   (e.g. lines around a search result). Shows current position
   and prev/next buttons.
   Uses --vscode-panel-background to match the VS Code bottom panel.
   =================================================================== */
#split-breadcrumb {
    display: none;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    /* Panel background blends with the VS Code bottom panel chrome */
    background: var(--vscode-panel-background);
    border-bottom: 1px solid var(--vscode-panel-border);
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
}
#split-breadcrumb.visible { display: flex; }
#split-breadcrumb .part-label {
    font-weight: bold;
}
#split-breadcrumb button {
    background: none;
    border: 1px solid var(--vscode-descriptionForeground);
    color: var(--vscode-descriptionForeground);
    font-size: 10px;
    padding: 1px 6px;
    cursor: pointer;
    border-radius: 3px;
}
#split-breadcrumb button:hover {
    background: var(--vscode-button-hoverBackground);
    color: var(--vscode-button-foreground);
}
#split-breadcrumb button:disabled {
    opacity: 0.4;
    cursor: default;
}

/* ===================================================================
   JSON Collapsible Blocks
   Inline expandable JSON objects in log output. Toggle between
   a compact one-line preview and full formatted expansion.
   =================================================================== */
.json-collapsible { display: inline; }
.json-toggle {
    cursor: pointer;
    color: var(--vscode-textLink-foreground, #3794ff);
    font-family: sans-serif;
    font-size: 10px;
    padding: 0 4px;
    user-select: none;
}
.json-toggle:hover { color: var(--vscode-textLink-activeForeground, #3794ff); }
/* Collapsed: shows truncated preview text */
.json-preview {
    color: var(--vscode-descriptionForeground);
    font-size: 0.95em;
}
/* Expanded: full formatted JSON in a quote block */
.json-expanded {
    display: block;
    margin: 4px 0 4px 16px;
    padding: 4px 8px;
    background: var(--vscode-textBlockQuote-background, rgba(127, 127, 127, 0.1));
    border-left: 2px solid var(--vscode-textBlockQuote-border, #007acc);
    font-size: 0.95em;
    line-height: 1.4;
    white-space: pre;
    overflow-x: auto;
}
.json-expanded.hidden { display: none; }
.json-preview.hidden { display: none; }

/* ===================================================================
   Context Menu
   Right-click menu for log lines. Provides actions like copy,
   pin, exclude, search codebase, etc.
   =================================================================== */
.context-menu {
    display: none;
    position: fixed;
    z-index: 200;
    background: var(--vscode-menu-background, var(--vscode-editor-background));
    border: 1px solid var(--vscode-menu-border, var(--vscode-panel-border));
    border-radius: 4px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    min-width: 160px;
    padding: 4px 0;
    overflow-y: auto;
}
@keyframes menu-pop-in { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
.context-menu.visible { display: block; animation: menu-pop-in 0.12s ease-out; }
.context-menu-item {
    padding: 6px 12px;
    cursor: pointer;
    font-size: 12px;
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--vscode-menu-foreground, var(--vscode-editor-foreground));
}
.context-menu-item:hover {
    background: var(--vscode-menu-selectionBackground, var(--vscode-list-hoverBackground));
    color: var(--vscode-menu-selectionForeground, inherit);
}
.context-menu-item .codicon {
    font-size: 14px;
    opacity: 0.8;
}
.context-menu-separator {
    height: 1px;
    background: var(--vscode-menu-separatorBackground, var(--vscode-panel-border));
    margin: 4px 8px;
}
`;
}

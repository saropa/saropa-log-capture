/**
 * CSS styles for the log viewer webview.
 *
 * All colors use --vscode-* CSS variables so the viewer automatically
 * matches the user's active VS Code theme (light, dark, or high-contrast).
 *
 * Layout: The viewer lives in the VS Code bottom panel (next to Output /
 * Terminal tabs). Panel-scoped elements use --vscode-panel-background to
 * blend seamlessly with the surrounding panel chrome.
 */
import { getContentStyles } from './viewer-styles-content';
import { getComponentStyles } from './viewer-styles-components';
import { getOverlayStyles } from './viewer-styles-overlays';
import { getTagStyles } from './viewer-styles-tags';
import { getOptionsStyles } from './viewer-styles-options';
import { getErrorStyles } from './viewer-styles-errors';

export function getViewerStyles(): string {
    return /* css */ `

/* ===================================================================
   Reset & Root Layout
   The webview body is a flex column filling the panel viewport.
   Child sections (pinned, log-content, search-bar, footer) stack
   vertically with log-content taking all remaining space.
   =================================================================== */
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
    background: var(--vscode-editor-background);
    color: var(--vscode-editor-foreground);
    font-family: var(--vscode-editor-font-family, monospace);
    font-size: var(--log-font-size, var(--vscode-editor-font-size, 13px));
    overflow-y: auto;
    height: 100vh;
    display: flex;
    flex-direction: column;
}

/* ===================================================================
   Viewer Header
   Shows the current filename and can be toggled on/off.
   =================================================================== */
#viewer-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 8px;
    background: var(--vscode-titleBar-activeBackground, var(--vscode-panel-background));
    border-bottom: 1px solid var(--vscode-panel-border);
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
    min-height: 24px;
    transition: all 0.2s ease;
}

#viewer-header.collapsed {
    min-height: 0;
    padding: 0;
    overflow: hidden;
    border-bottom: none;
}

#viewer-header.collapsed #header-filename {
    display: none;
}

#header-filename {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: 500;
}

#header-toggle {
    background: none;
    border: none;
    color: var(--vscode-descriptionForeground);
    font-size: 10px;
    cursor: pointer;
    padding: 2px 4px;
    transition: transform 0.2s ease;
}

#viewer-header.collapsed #header-toggle {
    transform: rotate(180deg);
}

#header-toggle:hover {
    color: var(--vscode-foreground);
}

/* ===================================================================
   Log Content Area
   Main scrollable region holding all log lines. Uses flex:1 to fill
   available space between the pinned section above and footer below.
   =================================================================== */
#log-content {
    flex: 1;
    overflow-y: auto;
    padding: 4px 0;
    position: relative;
}

/* --- Individual log lines --- */
.line {
    white-space: pre-wrap;
    word-break: break-all;
    padding: 0 8px;
    line-height: var(--log-line-height, 1.5);
}
.line:hover { background: var(--vscode-list-hoverBackground); }

/* --- Clickable source file links within log lines --- */
.source-link {
    color: var(--vscode-textLink-foreground, #3794ff);
    text-decoration: none;
    cursor: pointer;
}
.source-link:hover { text-decoration: underline; }

/* --- stderr output lines (DAP category "stderr") --- */
.line.cat-stderr {
    color: var(--vscode-debugConsole-errorForeground, #f48771);
}

/* --- Log level styling (error/warning/performance/info) --- */
.line.level-error {
    color: var(--vscode-debugConsole-errorForeground, #f48771);
}
.line.level-warning {
    color: var(--vscode-debugConsole-warningForeground, #cca700);
}
.line.level-performance {
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
    color: var(--vscode-terminal-ansiCyan, #4fc1ff);
}
/* info lines use default foreground color for consistency */

/* --- ASCII separator lines (===, ---, +---, etc.) --- */
.line.separator-line {
    color: var(--vscode-terminal-ansiYellow, #dcdcaa);
    opacity: 0.8;
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
` + getContentStyles() + getComponentStyles() + getOverlayStyles() + getTagStyles() + getOptionsStyles() + getErrorStyles();
}

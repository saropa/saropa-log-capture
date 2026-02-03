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
import { getIconBarStyles } from './viewer-styles-icon-bar';
import { getSessionPanelStyles } from './viewer-styles-session';
import { getFindPanelStyles } from './viewer-styles-find';
import { getBookmarkPanelStyles } from './viewer-styles-bookmarks';

export function getViewerStyles(): string {
    return /* css */ `

/* ===================================================================
   Reset & Root Layout
   The webview body is a flex row: main content column + icon bar.
   The #main-content div stacks children vertically (breadcrumb, content,
   footer) with log-content taking all remaining space.
   =================================================================== */
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
    background: var(--vscode-editor-background);
    color: var(--vscode-editor-foreground);
    font-family: var(--vscode-editor-font-family, monospace);
    font-size: var(--log-font-size, var(--vscode-editor-font-size, 13px));
    overflow: hidden;
    height: 100vh;
    display: flex;
    flex-direction: row;
}

#main-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
    height: 100vh;
    overflow: hidden;
}

/* ===================================================================
   Log Content Wrapper
   Flex row containing the scrollable log area and the minimap panel.
   =================================================================== */
#log-content-wrapper {
    position: relative;
    flex: 1;
    min-height: 0;
    display: flex;
}

/* ===================================================================
   Log Content Area
   Main scrollable region. Native scrollbar is always hidden because
   the minimap panel serves as the scrollbar replacement.
   =================================================================== */
#log-content {
    flex: 1;
    min-width: 0;
    height: 100%;
    overflow-y: auto;
    padding: 4px 0;
    position: relative;
    scrollbar-width: none;
}
#log-content::-webkit-scrollbar { display: none; }

/* --- Individual log lines --- */
.line {
    white-space: pre-wrap;
    word-break: break-all;
    padding: 0 8px;
    line-height: var(--log-line-height, 1.5);
    transition: background 0.1s ease;
}
.line:hover { background: var(--vscode-list-hoverBackground); }

/* --- Clickable source file links within log lines --- */
.source-link {
    color: var(--vscode-textLink-foreground, #3794ff);
    text-decoration: none;
    cursor: pointer;
}
.source-link:hover { text-decoration: underline; }

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
` + getContentStyles() + getComponentStyles() + getOverlayStyles() + getTagStyles() + getOptionsStyles() + getErrorStyles() + getIconBarStyles() + getSessionPanelStyles() + getFindPanelStyles() + getBookmarkPanelStyles();
}

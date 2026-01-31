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
    font-size: var(--vscode-editor-font-size, 13px);
    overflow-y: auto;
    height: 100vh;
    display: flex;
    flex-direction: column;
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
}

/* --- Individual log lines --- */
.line {
    white-space: pre-wrap;
    word-break: break-all;
    padding: 0 8px;
    line-height: 1.5;
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
    color: var(--vscode-debugConsole-errorForeground, #f44);
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
    color: var(--vscode-errorForeground, #f44);
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
   Floating action button shown when the user scrolls away from the
   bottom of the log. Clicking it auto-scrolls to the latest output.
   Positioned fixed at bottom-right within the webview viewport.
   =================================================================== */
#jump-btn {
    display: none;      /* shown via JS when not at bottom */
    position: fixed;
    bottom: 32px;       /* above the footer bar */
    right: 12px;
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border: none;
    padding: 4px 12px;
    cursor: pointer;
    border-radius: 4px;
    font-size: 12px;
    z-index: 10;
}
#jump-btn:hover { background: var(--vscode-button-hoverBackground); }

/* ===================================================================
   Footer Bar
   Sticky bar at the bottom showing line count, watch chips, and
   toggle buttons (wrap, exclusions, app-only, level filter).
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

/* --- Footer toggle buttons (word-wrap, exclusions, app-only) --- */
#wrap-toggle {
    background: none;
    border: 1px solid var(--vscode-descriptionForeground);
    color: var(--vscode-descriptionForeground);
    font-size: 10px;
    padding: 1px 6px;
    cursor: pointer;
    border-radius: 3px;
    margin-left: auto; /* push to right edge of footer */
}

/* --- Filter preset dropdown in footer --- */
#filter-select {
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border, transparent);
    font-size: 10px;
    padding: 1px 4px;
    max-width: 120px;
    cursor: pointer;
}
#wrap-toggle:hover {
    background: var(--vscode-button-hoverBackground);
    color: var(--vscode-button-foreground);
}

/* ===================================================================
   Search Bar
   Inline find bar above the footer. Contains text input, match count,
   and prev/next navigation buttons.
   Uses --vscode-panel-background to match the VS Code bottom panel.
   =================================================================== */
#search-bar {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    /* Panel background blends with the VS Code bottom panel chrome */
    background: var(--vscode-panel-background);
    border-top: 1px solid var(--vscode-panel-border);
    flex-shrink: 0;
}
#search-input {
    flex: 1;
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border, transparent);
    padding: 2px 6px;
    font-size: 12px;
    font-family: inherit;
    outline: none;
}
#search-input:focus { border-color: var(--vscode-focusBorder); }
#match-count {
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
    white-space: nowrap;
}
#search-bar button {
    background: none;
    border: none;
    color: var(--vscode-descriptionForeground);
    cursor: pointer;
    font-size: 12px;
    padding: 2px 4px;
}
#search-bar button:hover { color: var(--vscode-foreground); }

/* --- Search match highlighting --- */
mark {
    background: var(--vscode-editor-findMatchHighlightBackground, rgba(234, 92, 0, 0.33));
    color: inherit;
    border-radius: 2px;
}
/* Currently focused match gets a brighter highlight */
.current-match mark {
    background: var(--vscode-editor-findMatchBackground, rgba(255, 150, 50, 0.6));
}
.search-match {
    background: var(--vscode-editor-findMatchHighlightBackground, rgba(234, 92, 0, 0.1));
}

/* ===================================================================
   Keyword Watch Chips
   Small badges in the footer showing hit counts for watched keywords.
   Flash animation plays when a new match arrives.
   =================================================================== */
#watch-counts {
    display: flex;
    gap: 4px;
    align-items: center;
}
.watch-chip {
    display: inline-block;
    font-size: 10px;
    padding: 0 5px;
    border-radius: 8px;
    white-space: nowrap;
}
/* Error-level watch chip (red) */
.watch-error {
    background: var(--vscode-inputValidation-errorBackground, rgba(255, 0, 0, 0.2));
    color: var(--vscode-errorForeground, #f44);
}
/* Warning-level watch chip (yellow) */
.watch-warn {
    background: var(--vscode-inputValidation-warningBackground, rgba(255, 204, 0, 0.2));
    color: var(--vscode-editorWarning-foreground, #fc0);
}
/* Brief scale-up animation on new watch hit */
@keyframes watch-flash {
    0% { opacity: 1; transform: scale(1.2); }
    100% { opacity: 1; transform: scale(1); }
}
.watch-chip.flash {
    animation: watch-flash 0.4s ease-out;
}

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
/* Toggle button to show/hide framework frames */
#app-only-toggle {
    background: none;
    border: 1px solid var(--vscode-descriptionForeground);
    color: var(--vscode-descriptionForeground);
    font-size: 10px;
    padding: 1px 6px;
    cursor: pointer;
    border-radius: 3px;
}
/* Badge showing how many times a stack trace was repeated */
.stack-dedup-badge {
    font-size: 10px;
    opacity: 0.7;
    margin-left: 4px;
}
/* Decoration prefix (severity dot, counter, timestamp) */
.line-decoration {
    font-size: 11px;
    opacity: 0.85;
    white-space: nowrap;
    user-select: none;
}
#deco-toggle {
    background: none;
    border: 1px solid var(--vscode-descriptionForeground);
    color: var(--vscode-descriptionForeground);
    font-size: 10px;
    padding: 1px 6px;
    cursor: pointer;
    border-radius: 3px;
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
/* Whole-line severity tinting (subtle backgrounds) */
.line.line-tint-error {
    background-color: rgba(255, 0, 0, 0.08);
}
.line.line-tint-error:hover {
    background-color: rgba(255, 0, 0, 0.14);
}
.line.line-tint-warning {
    background-color: rgba(255, 204, 0, 0.08);
}
.line.line-tint-warning:hover {
    background-color: rgba(255, 204, 0, 0.14);
}

/* ===================================================================
   Source Preview Popup
   Hover tooltip showing a few lines of source code around a
   stack frame location. Positioned fixed within the webview.
   =================================================================== */
#source-preview {
    position: fixed;
    display: none;
    background: var(--vscode-editorHoverWidget-background, var(--vscode-editor-background));
    border: 1px solid var(--vscode-editorHoverWidget-border, var(--vscode-panel-border));
    border-radius: 4px;
    padding: 8px;
    font-size: 12px;
    max-width: 500px;
    min-width: 200px;
    z-index: 100;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    overflow: hidden;
}
#source-preview.visible { display: block; }
#source-preview .preview-header {
    font-size: 10px;
    color: var(--vscode-descriptionForeground);
    margin-bottom: 4px;
    border-bottom: 1px solid var(--vscode-panel-border);
    padding-bottom: 4px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
#source-preview .preview-code {
    font-family: var(--vscode-editor-font-family, monospace);
    white-space: pre;
    overflow-x: auto;
    line-height: 1.4;
}
#source-preview .preview-line {
    padding: 0 4px;
}
/* Highlighted target line in the source preview */
#source-preview .preview-line.target {
    background: var(--vscode-editor-lineHighlightBackground, rgba(255, 255, 0, 0.1));
    border-left: 2px solid var(--vscode-editorLineNumber-activeForeground, #c6c6c6);
}
#source-preview .line-num {
    color: var(--vscode-editorLineNumber-foreground, #858585);
    display: inline-block;
    min-width: 30px;
    text-align: right;
    margin-right: 8px;
    user-select: none;
}
#source-preview .preview-loading {
    color: var(--vscode-descriptionForeground);
    font-style: italic;
}

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

/* --- Export preset dropdown in footer --- */
#preset-select {
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border, transparent);
    font-size: 10px;
    padding: 1px 4px;
    max-width: 140px;
    cursor: pointer;
}

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
}
.context-menu.visible { display: block; }
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

/* ===================================================================
   Level Filter Buttons
   Segmented button group in the footer for filtering log lines
   by severity level (All / Info / Warn / Error).
   =================================================================== */
.level-btn-group {
    display: flex;
    gap: 0;
    border: 1px solid var(--vscode-descriptionForeground);
    border-radius: 3px;
    overflow: hidden;
}
.level-btn {
    background: none;
    border: none;
    border-right: 1px solid var(--vscode-descriptionForeground);
    color: var(--vscode-descriptionForeground);
    font-size: 10px;
    padding: 1px 6px;
    cursor: pointer;
}
.level-btn:last-child { border-right: none; }
/* Active filter button highlighted with button theme */
.level-btn.active {
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
}
.level-btn:hover:not(.active) {
    background: var(--vscode-list-hoverBackground);
}
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
`;
}

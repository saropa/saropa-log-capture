"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLevelStyles = getLevelStyles;
/**
 * CSS styles for the level filter UI: compact dot summary in the footer,
 * fly-up menu with toggle circles, and context-line decorations.
 */
function getLevelStyles() {
    return /* css */ `

/* ===================================================================
   Level Filter — Compact Dot Summary (footer trigger)
   Clickable dot groups toggle levels; label opens fly-up menu.
   =================================================================== */
.level-summary {
    display: inline-flex;
    gap: 2px;
    align-items: center;
    padding: 2px 4px;
    border-radius: 3px;
}
.level-dot-group {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    cursor: pointer;
    padding: 2px;
    border-radius: 4px;
}
.level-dot-group:hover {
    background: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31));
}
.level-dot {
    display: inline-block;
    width: 10px;
    height: 10px;
    min-width: 10px;
    min-height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
    transition: opacity 0.2s ease;
}
.level-dot:not(.active) { opacity: 0.3; }
.level-dot-info { background: #4caf50; }
.level-dot-warning { background: #ff9800; }
.level-dot-error { background: #f44336; }
.level-dot-performance { background: #9c27b0; }
.level-dot-todo { background: #bdbdbd; }
.level-dot-debug { background: #795548; }
.level-dot-notice { background: #2196f3; }
.dot-count {
    font-size: 10px;
    color: var(--vscode-descriptionForeground);
    line-height: 1;
}
.dot-count:empty { display: none; }
.level-trigger-label {
    font-size: 10px;
    color: var(--vscode-descriptionForeground);
    margin-left: 2px;
    cursor: pointer;
    padding: 2px 4px;
    border-radius: 3px;
}
.level-trigger-label:hover {
    background: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31));
}

/* ===================================================================
   Level Filter — Fly-up Menu
   Popup positioned above the footer showing full level toggles
   plus Select All / Select None. Stays open during toggling.
   =================================================================== */
#level-flyup {
    display: none;
    position: fixed;
    bottom: 30px;
    left: 8px;
    background: var(--vscode-editorWidget-background, var(--vscode-editor-background, #1e1e1e));
    border: 1px solid var(--vscode-editorWidget-border, var(--vscode-panel-border));
    border-radius: 4px;
    box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.3);
    padding: 6px;
    z-index: 150;
    min-width: 120px;
}
@keyframes flyup-enter { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
#level-flyup.visible { display: flex; flex-direction: column; gap: 2px; animation: flyup-enter 0.15s ease-out; }
.level-flyup-title {
    font-size: 11px;
    font-weight: 600;
    color: var(--vscode-foreground);
    padding: 2px 4px;
}
.level-flyup-help {
    font-size: 10px;
    color: var(--vscode-descriptionForeground);
    line-height: 1.35;
    padding: 0 4px 6px;
    max-width: 260px;
}
.level-flyup-header {
    display: flex;
    gap: 8px;
    padding: 2px 4px 4px;
    border-bottom: 1px solid var(--vscode-panel-border);
    margin-bottom: 2px;
    font-size: 11px;
}
/* All/None toggles: buttons for keyboard a11y (plan 028). */
.level-flyup-header button {
    background: none;
    border: 1px solid var(--vscode-descriptionForeground);
    color: var(--vscode-descriptionForeground);
    font-size: 11px;
    padding: 1px 8px;
    cursor: pointer;
    border-radius: 3px;
    text-decoration: none;
}
.level-flyup-header button.active {
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border-color: var(--vscode-button-background);
}
.level-flyup-header button:hover {
    background: var(--vscode-button-hoverBackground);
    color: var(--vscode-button-foreground);
}

/* ===================================================================
   Level Filter Circles (inside fly-up)
   Interactive toggles for each log level.
   =================================================================== */
.level-circle {
    background: none;
    border: 1px solid transparent;
    color: inherit;
    font-size: 11px;
    padding: 2px 6px;
    cursor: pointer;
    opacity: 1;
    transition: opacity 0.2s ease, background 0.15s ease;
    line-height: 1.2;
    border-radius: 3px;
    white-space: nowrap;
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: 6px;
    width: 100%;
    text-align: left;
}
.level-emoji { flex-shrink: 0; }
.level-label { flex: 1; text-align: left; }
.level-count {
    font-size: 10px;
    color: var(--vscode-descriptionForeground);
    min-width: 20px;
    text-align: right;
}
.level-circle:hover {
    background: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31));
    border-color: var(--vscode-descriptionForeground);
}
/* Inactive (disabled) circles are dimmed and desaturated */
.level-circle:not(.active) {
    opacity: 0.25;
    filter: grayscale(0.8);
}
/* Context lines slider inside the level fly-up */
.level-flyup-context { border-top: 1px solid var(--vscode-panel-border); margin-top: 4px; padding: 4px 4px 2px; }
.level-flyup-context-label { font-size: 10px; color: var(--vscode-descriptionForeground); }
.level-flyup-context input[type="range"] { width: 100%; margin-top: 2px; }
.line.context-line { opacity: 0.4; }
.line.context-first { position: relative; }
.line.context-first::before { content: ''; position: absolute; top: 0; left: 8px; right: 8px; border-top: 1px dashed rgba(128,128,128,0.35); }

`;
}
//# sourceMappingURL=viewer-styles-level.js.map
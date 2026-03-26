"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getReplayStyles = getReplayStyles;
/** CSS for the horizontal replay panel anchored to bottom-right. */
function getReplayStyles() {
    return /* css */ `

/* ===================================================================
   Session Replay — horizontal panel (bottom-right of log area)
   =================================================================== */

/* Horizontal floating panel — bottom-right, above footer */
.replay-bar {
    display: none !important;
    position: absolute;
    bottom: 8px;
    right: calc(8px + var(--mm-w, 60px));
    z-index: 16;
    flex-direction: row;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    background: var(--vscode-editorWidget-background);
    border: 1px solid var(--vscode-widget-border, var(--vscode-panel-border));
    border-radius: 6px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
    pointer-events: auto;
}
.replay-bar.replay-bar-visible {
    display: flex !important;
    animation: replay-bar-enter 0.15s ease-out;
}
@keyframes replay-bar-enter { from { opacity: 0; } to { opacity: 1; } }

/* Transport buttons row (play/pause/stop side by side) */
.replay-btn-row {
    display: flex;
    gap: 2px;
}
.replay-btn {
    background: none;
    border: 1px solid var(--vscode-descriptionForeground);
    color: var(--vscode-descriptionForeground);
    padding: 2px 5px;
    cursor: pointer;
    border-radius: 3px;
    font-size: 12px;
}
.replay-btn:hover {
    background: var(--vscode-button-hoverBackground);
    color: var(--vscode-button-foreground);
}

/* Mode & speed selects — compact inline */
.replay-mode, .replay-speed {
    font-size: 10px;
    padding: 1px 2px;
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border);
    border-radius: 3px;
    text-align: center;
}

/* Horizontal scrubber — fills remaining horizontal space */
.replay-scrubber {
    flex: 1;
    min-width: 80px;
    height: 16px;
}

/* Status text */
.replay-status {
    font-size: 9px;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    color: var(--vscode-descriptionForeground);
}

`;
}
//# sourceMappingURL=viewer-styles-replay.js.map
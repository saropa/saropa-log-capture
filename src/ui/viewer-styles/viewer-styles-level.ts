/**
 * CSS styles for the level filter UI: compact dot summary in the footer,
 * fly-up menu with toggle circles, and context-line decorations.
 */
export function getLevelStyles(): string {
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
    width: 12px;
    height: 12px;
    min-width: 12px;
    min-height: 12px;
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
.level-dot-database { background: #00bcd4; }
/* Level letter chip — sits between the colored dot and the count.
   Why: 8 colors at 12px are unscannable on dense toolbar (color-blind users
   especially), and the toolbar footer was the only level-filter UI without
   any text label, diverging from the filter drawer's emoji+label+count
   chips. Match the dot color (active) or descriptionForeground (inactive)
   so the chip carries the same active-state cue as the dot beside it. */
.level-letter {
    font-size: 10px;
    font-weight: 600;
    line-height: 1;
    letter-spacing: 0;
    user-select: none;
    transition: opacity 0.2s ease;
    color: var(--vscode-descriptionForeground);
}
.level-dot-group:has(.level-dot:not(.active)) .level-letter { opacity: 0.45; }
.level-letter-error { color: #f44336; }
.level-letter-warning { color: #ff9800; }
.level-letter-info { color: #4caf50; }
.level-letter-performance { color: #9c27b0; }
.level-letter-todo { color: var(--vscode-descriptionForeground); }
.level-letter-debug { color: #a1887f; }
.level-letter-notice { color: #2196f3; }
.level-letter-database { color: #00bcd4; }
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

/* Level fly-up removed — level toggles are now in the toolbar filter drawer. */

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

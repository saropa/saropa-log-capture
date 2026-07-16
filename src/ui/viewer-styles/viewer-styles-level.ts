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
/* Trouble Mode dims the dots for the levels it actively hides (everything but
   error / warning / performance) so the toolbar reflects what is suppressed,
   without touching the real level-filter state (enabledLevels). Mirrors the
   inactive-dot / inactive-letter opacities above. */
body.slc-trouble-active .level-dot-group[data-level="info"] .level-dot,
body.slc-trouble-active .level-dot-group[data-level="notice"] .level-dot,
body.slc-trouble-active .level-dot-group[data-level="debug"] .level-dot,
body.slc-trouble-active .level-dot-group[data-level="database"] .level-dot,
body.slc-trouble-active .level-dot-group[data-level="todo"] .level-dot { opacity: 0.3; }
body.slc-trouble-active .level-dot-group[data-level="info"] .level-letter,
body.slc-trouble-active .level-dot-group[data-level="notice"] .level-letter,
body.slc-trouble-active .level-dot-group[data-level="debug"] .level-letter,
body.slc-trouble-active .level-dot-group[data-level="database"] .level-letter,
body.slc-trouble-active .level-dot-group[data-level="todo"] .level-letter { opacity: 0.45; }
/* Dot palette matches .line.level-* text colors in viewer-styles-lines.ts and
   .level-bar-* in viewer-styles-decoration-bars.ts. Info=blue, Notice=cyan,
   Database=green — keep the three in lockstep when any one changes. */
.level-dot-info { background: #2196f3; }
.level-dot-warning { background: #ff9800; }
.level-dot-error { background: #f44336; }
.level-dot-performance { background: #9c27b0; }
.level-dot-todo { background: #bdbdbd; }
.level-dot-debug { background: #795548; }
.level-dot-notice { background: #00bcd4; }
.level-dot-database { background: #4caf50; }
/* Level letter chip — sits between the colored dot and the count.
   Why: 8 colors at 12px are unscannable on dense toolbar (color-blind users
   especially), and the toolbar footer was the only level-filter UI without
   any text label, diverging from the filter drawer's emoji+label+count
   chips. Per-level colors match the dot; inactive groups also lower letter
   opacity via :has(.level-dot:not(.active)) so state stays paired with the dot. */
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
.level-letter-info { color: #2196f3; }
.level-letter-performance { color: #9c27b0; }
.level-letter-todo { color: var(--vscode-descriptionForeground); }
.level-letter-debug { color: #a1887f; }
.level-letter-notice { color: #00bcd4; }
.level-letter-database { color: #4caf50; }
/* Count pill. Was faint descriptionForeground gray and near-illegible on the dense
   toolbar; now a filled chip in the level's own color so each counter is high-contrast
   and self-identifying. Foreground is chosen per level to clear WCAG AA (4.5:1) for the
   10px bold number: near-black on the bright/mid fills (warning/info/error/todo/notice/
   database) and white only on the two genuinely dark fills (performance purple, debug
   brown). White-on-red/-blue was rejected — it sits at ~3.9:1 / ~3.1:1 and the count
   must be VERY legible. Backgrounds must stay in lockstep with .level-dot-* above and the
   line/bar colors those comment. */
.dot-count {
    font-size: 10px;
    font-weight: 700;
    line-height: 15px;
    letter-spacing: 0.2px;
    padding: 0 6px;
    border-radius: 8px;
    color: #fff;
    background: var(--vscode-badge-background);
}
.dot-count:empty { display: none; }
.dot-count-error    { background: #f44336; color: #2a0400; }
.dot-count-warning  { background: #ff9800; color: #1c1200; }
.dot-count-info     { background: #2196f3; color: #051f33; }
.dot-count-performance { background: #9c27b0; color: #fff; }
.dot-count-todo     { background: #bdbdbd; color: #1a1a1a; }
.dot-count-notice   { background: #00bcd4; color: #062a2e; }
.dot-count-debug    { background: #795548; color: #fff; }
.dot-count-database { background: #4caf50; color: #0a2410; }
/* Inactive level: dim the whole pill to match the dot/letter dimming, so a filtered-out
   level's count reads as off without losing its identity color. */
.level-dot-group:has(.level-dot:not(.active)) .dot-count { opacity: 0.4; }
/* Trouble Mode suppresses info/notice/debug/database/todo without clearing .active (it
   leaves the real level-filter state alone), so the inactive-dimming rule above cannot
   fire for those. Dim their count pills explicitly to match the dimmed dot/letter above —
   otherwise a bright pill would contradict the "this level is hidden" signal. Keep this
   list in step with the trouble-mode .level-dot / .level-letter rules earlier in this file. */
body.slc-trouble-active .level-dot-group[data-level="info"] .dot-count,
body.slc-trouble-active .level-dot-group[data-level="notice"] .dot-count,
body.slc-trouble-active .level-dot-group[data-level="debug"] .dot-count,
body.slc-trouble-active .level-dot-group[data-level="database"] .dot-count,
body.slc-trouble-active .level-dot-group[data-level="todo"] .dot-count { opacity: 0.4; }
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

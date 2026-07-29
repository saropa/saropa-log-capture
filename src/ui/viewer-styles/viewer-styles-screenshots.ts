/**
 * Styles for the screenshot surfaces (plan 114): per-line camera badge, floating
 * thumbnail popover, and the footer camera toggle + gallery counter.
 * Tokens/vars only — no raw hex (design-system rule).
 */
export function getScreenshotStyles(): string {
    return /* css */ `
/* Per-line camera badge — sits inline with the other line badges (db/trace). */
.screenshot-badge {
    cursor: pointer;
    opacity: 0.75;
}
.screenshot-badge:hover { opacity: 1; }

/* Floating thumbnail popover. Fixed-position overlay — deliberately NOT an inline row
   expansion, so line heights and the prefix-sum scroll math are untouched. */
.screenshot-popover {
    position: fixed;
    z-index: 1000;
    max-width: 320px;
    padding: var(--space-1, 4px);
    background: var(--vscode-editorWidget-background);
    border: 1px solid var(--vscode-editorWidget-border);
    border-radius: 4px;
    box-shadow: 0 4px 12px var(--vscode-widget-shadow);
    cursor: pointer;
}
.screenshot-popover-img {
    display: block;
    max-width: 100%;
    max-height: 200px;
    border-radius: 2px;
}
.screenshot-popover-caption {
    padding: 2px 4px;
    font-size: 0.85em;
    color: var(--vscode-descriptionForeground);
}

/* Footer camera toggle: always visible; dimmed = capture disabled. */
.screenshot-toggle {
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    color: var(--vscode-foreground);
    opacity: 0.85;
}
.screenshot-toggle:hover { opacity: 1; }
.screenshot-toggle.screenshot-toggle-off {
    opacity: 0.35;
}
.screenshot-toggle.screenshot-toggle-off:hover { opacity: 0.6; }

/* Footer capture counter — click opens the gallery. */
.screenshot-count {
    cursor: pointer;
    font-size: 0.9em;
    color: var(--vscode-descriptionForeground);
    padding: 0 2px;
}
.screenshot-count:hover { color: var(--vscode-foreground); }
`;
}

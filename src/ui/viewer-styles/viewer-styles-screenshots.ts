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
    background: var(--surface-2);
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
    color: var(--muted);
}
/* Full path of the previewed PNG. Monospace and break-all because an absolute path is longer than
   the popover is wide and must wrap rather than clip — a truncated path is not an actionable one.
   user-select:text so it can be highlighted and copied without opening the file. */
.screenshot-popover-path {
    padding: 0 4px 2px;
    font-family: var(--vscode-editor-font-family);
    font-size: 0.78em;
    color: var(--muted);
    word-break: break-all;
    user-select: text;
}

/* Footer camera toggle: always visible; dimmed = capture disabled. flex-shrink 0 so a
   narrow sidebar ellipsizes the filename (which is the designed shrink target) instead
   of crushing the icon. */
.screenshot-toggle {
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    flex-shrink: 0;
    color: var(--text);
    opacity: 0.85;
}
.screenshot-toggle:hover { opacity: 1; }
.screenshot-toggle.screenshot-toggle-off {
    opacity: 0.35;
}
.screenshot-toggle.screenshot-toggle-off:hover { opacity: 0.6; }

/* Camera options menu — fixed popover anchored to the footer icon. */
.screenshot-menu {
    position: fixed;
    z-index: 1000;
    min-width: 200px;
    padding: var(--space-1, 4px);
    background: var(--vscode-menu-background, var(--surface-2));
    color: var(--vscode-menu-foreground, var(--text));
    border: 1px solid var(--vscode-menu-border, var(--vscode-editorWidget-border));
    border-radius: 4px;
    box-shadow: 0 4px 12px var(--vscode-widget-shadow);
    display: flex;
    flex-direction: column;
}
.screenshot-menu-row {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: var(--space-1) var(--space-2);
    font-size: var(--vscode-font-size);
    cursor: pointer;
    border-radius: var(--radius-sm);
    background: none;
    border: none;
    color: inherit;
    text-align: left;
}
.screenshot-menu-row:hover { background: var(--vscode-list-hoverBackground); }
/* Master row reads as the header of the checkbox group. */
.screenshot-menu-master { font-weight: 600; }
.screenshot-menu input[type="checkbox"]:disabled + span { opacity: 0.5; }
.screenshot-menu-sep {
    height: 1px;
    margin: 4px 2px;
    background: var(--vscode-menu-separatorBackground, var(--vscode-editorWidget-border));
}
.screenshot-menu-limits {
    padding: 3px 8px 4px;
    font-size: 0.85em;
    color: var(--muted);
}

/* Footer capture counter — click opens the gallery. */
/* Capture-now button — present only while a live session can actually be photographed. */
.screenshot-shoot {
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    flex-shrink: 0;
    color: var(--text);
    opacity: 0.85;
}
.screenshot-shoot:hover { opacity: 1; color: var(--accent-critical); }

/* Capture counter as a pill: reads as a count badge beside the file identity rather than
   as loose text, and stays legible on both the toolbar and the log banner. */
.screenshot-count,
.screenshot-pill {
    cursor: pointer;
    flex-shrink: 0;
    white-space: nowrap;
    font-size: 0.85em;
    line-height: 1.4;
    color: var(--vscode-badge-foreground);
    background: var(--vscode-badge-background);
    border-radius: 9px;
    padding: 0 6px;
    margin: 0 2px;
}
.screenshot-count:hover,
.screenshot-pill:hover { filter: brightness(1.15); }
`;
}

/**
 * CSS for the sticky footer bar: line count, watch chips, level circles,
 * filter badge, action buttons (search, options), and version link.
 */
export function getFooterStyles(): string {
    return /* css */ `

/* ===================================================================
   Footer Bar
   Sticky bar at the bottom showing line count, watch chips, level
   circles, filter badge, and action buttons (search, options).
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
    user-select: none;
}
/* Warning style when capture is paused */
#footer.paused {
    color: var(--vscode-statusBarItem-warningForeground, #fc0);
    background: var(--vscode-statusBarItem-warningBackground, rgba(252, 192, 0, 0.15));
}

/* --- Clickable filename in footer --- */
.footer-filename {
    cursor: pointer; transition: color 0.15s ease;
    text-decoration: underline; text-decoration-style: dotted; text-underline-offset: 2px;
}
.footer-filename:hover { color: var(--vscode-textLink-foreground, #3794ff); text-decoration-style: solid; }

/* --- Shared footer button style --- */
.footer-btn {
    background: none;
    border: 1px solid var(--vscode-descriptionForeground);
    color: var(--vscode-descriptionForeground);
    font-size: 11px;
    padding: 1px 6px;
    cursor: pointer;
    border-radius: 3px;
    white-space: nowrap;
    transition: background 0.15s ease, color 0.15s ease;
}
.footer-btn:hover {
    background: var(--vscode-button-hoverBackground);
    color: var(--vscode-button-foreground);
}
/* Push right-aligned group to the end of footer */
.footer-spacer { flex: 1; }

/* Line count — tabular digits prevent width jitter */
#line-count { white-space: nowrap; font-variant-numeric: tabular-nums; }

/* Selection count (lines + chars) when text is selected in viewport */
.footer-selection { white-space: nowrap; font-variant-numeric: tabular-nums; margin-left: 6px; }
.footer-selection:empty { display: none; }

/* Footer actions menu — hidden by default, shown when file is loaded */
.footer-actions-menu { display: none; position: relative; }
.footer-actions-menu.footer-actions-visible { display: inline-flex; align-items: center; }
.footer-actions-btn { display: inline-flex; align-items: center; gap: 3px; }
.footer-actions-popover {
    display: none;
    position: absolute;
    right: 0;
    bottom: calc(100% + 6px);
    min-width: 140px;
    padding: 4px;
    border-radius: 4px;
    border: 1px solid var(--vscode-widget-border, var(--vscode-panel-border));
    background: var(--vscode-editorWidget-background, var(--vscode-panel-background));
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
    z-index: 30;
}
.footer-actions-menu.footer-actions-open .footer-actions-popover { display: block; }
.footer-actions-item {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 6px;
    border: 0;
    border-radius: 3px;
    background: transparent;
    color: var(--vscode-foreground);
    font-size: 11px;
    text-align: left;
    padding: 4px 6px;
    cursor: pointer;
}
.footer-actions-item:hover {
    background: var(--vscode-list-hoverBackground);
}
.footer-actions-item.is-disabled {
    opacity: 0.45;
    cursor: default;
}
.footer-actions-item.is-disabled:hover {
    background: transparent;
}
.footer-actions-separator {
    border: none;
    border-top: 1px solid var(--vscode-widget-border, var(--vscode-panel-border));
    margin: 3px 4px;
}
.footer-dot { display: none; color: var(--vscode-descriptionForeground); }
.footer-actions-menu.footer-actions-visible + .footer-dot { display: inline; }

/* Version link at far right — opens About panel */
.footer-version-link {
    color: var(--vscode-textLink-foreground, #3794ff);
    text-decoration: none;
    white-space: nowrap;
    margin-left: 8px;
}
.footer-version-link:hover { text-decoration: underline; }

/* --- Active filter badge in footer --- */
@keyframes badge-pop { from { transform: scale(0); opacity: 0; } to { transform: scale(1); opacity: 1; } }
.filter-badge {
    display: none;
    font-size: 10px;
    padding: 1px 6px;
    border-radius: 8px;
    background: var(--vscode-badge-background, #007acc);
    color: var(--vscode-badge-foreground, #fff);
    cursor: pointer;
    white-space: nowrap;
    font-weight: bold;
    line-height: 1;
    animation: badge-pop 0.2s ease-out;
}
.filter-badge:hover {
    opacity: 0.85;
}

`;
}

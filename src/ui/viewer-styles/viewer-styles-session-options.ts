/**
 * CSS for the Logs panel header kebab options menu.
 * Extracted from viewer-styles-session-panel.ts so the layout file stays under
 * the 300-line house limit after the toolbar row was replaced by this popover.
 *
 * The popover is positioned relative to .session-panel-header (the layout
 * file sets `position: relative` on that header). Toggle switches use a
 * pure-CSS pill so the active/inactive flip stays cheap — no JS animation.
 */

/** CSS for the kebab menu, its toggle rows, separator, and export action. */
export function getSessionOptionsMenuStyles(): string {
    return /* css */ `

/* --- Display options menu (kebab popover) ---
   Visibility is class-driven: the popover is display:none by default and only
   shows when .open is present. The previous design used inline style="display:none"
   + JS toggling element.style.display, which left the popover one stray
   element.style.display='' (or .cssText reset) away from rendering visible — and
   on first integration that's exactly what happened: the menu started open on
   panel load even though no code path explicitly opened it. Class toggling is
   side-effect-free and survives any future style-attribute clear. */
.session-options-menu {
    display: none;
    position: absolute;
    top: 100%;
    right: 8px;
    z-index: 30;
    min-width: 240px;
    max-width: calc(100% - 16px);
    flex-direction: column;
    gap: 2px;
    padding: 6px;
    background: var(--vscode-menu-background, var(--vscode-editor-background));
    border: 1px solid var(--vscode-menu-border, var(--vscode-panel-border));
    border-radius: 4px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.35);
}
.session-options-menu.open { display: flex; }

.session-options-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 6px;
}
.session-options-row-label {
    flex: 1;
    font-size: 12px;
    color: var(--vscode-foreground);
}

/* Date range filter dropdown (All time / Last 7 days / Last 30 days). */
.session-date-range-select {
    font-size: 12px;
    padding: 2px 6px;
    border-radius: 3px;
    border: 1px solid var(--vscode-input-border, transparent);
    background: var(--vscode-input-background, transparent);
    color: var(--vscode-input-foreground, var(--vscode-foreground));
}

/* Toggle row: icon + label on the left, switch on the right. The switch is a
   pure-CSS pill driven by .active (added/removed by syncToggleButtons). */
.session-options-toggle {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 6px;
    background: none;
    border: 1px solid transparent;
    border-radius: 3px;
    color: var(--vscode-foreground);
    font-size: 12px;
    cursor: pointer;
    text-align: left;
}
.session-options-toggle:hover {
    background: var(--vscode-menu-selectionBackground, var(--vscode-list-hoverBackground));
    color: var(--vscode-menu-selectionForeground, inherit);
}
.session-options-toggle-icon { font-size: 14px; opacity: 0.85; }
.session-options-toggle-text { flex: 1; }

.session-options-toggle-switch {
    display: inline-flex;
    align-items: center;
    width: 26px;
    height: 14px;
    padding: 1px;
    border-radius: 8px;
    background: var(--vscode-input-background, rgba(120, 120, 120, 0.4));
    border: 1px solid var(--vscode-input-border, transparent);
    transition: background 0.12s ease-out;
}
.session-options-toggle-thumb {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--vscode-descriptionForeground);
    transform: translateX(0);
    transition: transform 0.12s ease-out, background 0.12s ease-out;
}
.session-options-toggle.active .session-options-toggle-switch {
    background: var(--vscode-button-background, var(--vscode-focusBorder));
}
.session-options-toggle.active .session-options-toggle-thumb {
    transform: translateX(12px);
    background: var(--vscode-button-foreground, #fff);
}

.session-options-sep {
    border: none;
    border-top: 1px solid var(--vscode-menu-separatorBackground, var(--vscode-panel-border));
    margin: 4px 4px;
}

.session-options-action {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 6px;
    background: none;
    border: 1px solid transparent;
    border-radius: 3px;
    color: var(--vscode-foreground);
    font-size: 12px;
    cursor: pointer;
    text-align: left;
}
.session-options-action:hover {
    background: var(--vscode-menu-selectionBackground, var(--vscode-list-hoverBackground));
    color: var(--vscode-menu-selectionForeground, inherit);
}
.session-options-action .codicon { font-size: 14px; opacity: 0.85; }

/* Highlight the kebab button while the menu is open so the popover origin
   is obvious. Mirrors .session-toggle-btn.active appearance. */
.session-panel-action.active {
    color: var(--vscode-foreground);
    background: var(--vscode-button-secondaryBackground, rgba(90, 93, 94, 0.31));
}
`;
}

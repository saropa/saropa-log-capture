/** CSS for the right-click context menu, submenus, and toggle items. */
export function getContextMenuStyles(): string {
    return /* css */ `

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
    width: max-content;
    padding: 4px 0;
    white-space: nowrap;
}
@keyframes menu-pop-in { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
.context-menu.visible { display: block; animation: menu-pop-in 0.12s ease-out; }
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
.context-menu-item.is-disabled {
    opacity: 0.45;
    cursor: default;
}
.context-menu-item.is-disabled:hover {
    background: transparent;
    color: var(--vscode-menu-foreground, var(--vscode-editor-foreground));
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

/* --- Submenu trigger row --- */
.context-menu-submenu {
    position: relative;
    padding: 6px 12px;
    cursor: pointer;
    font-size: 12px;
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--vscode-menu-foreground, var(--vscode-editor-foreground));
}
.context-menu-submenu:hover {
    background: var(--vscode-menu-selectionBackground, var(--vscode-list-hoverBackground));
    color: var(--vscode-menu-selectionForeground, inherit);
}
.context-menu-submenu .codicon { font-size: 14px; opacity: 0.8; }
.context-menu-arrow { margin-left: auto; font-size: 12px !important; opacity: 0.6; }

/* --- Submenu flyout panel ---
   left:100% / top:0 are the natural (open-right, grow-down) defaults. positionSubmenu()
   in viewer-context-menu.ts overrides left/right/top/bottom and (when the flyout is taller
   than the viewport) max-height with inline styles on each trigger's mouseenter, so the
   panel is placed against the live viewport per-submenu instead of via global flip classes.
   overflow-y:auto makes a capped flyout scroll instead of clipping off-screen. */
.context-menu-submenu-content {
    display: none;
    position: absolute;
    left: 100%;
    top: 0;
    z-index: 201;
    background: var(--vscode-menu-background, var(--vscode-editor-background));
    border: 1px solid var(--vscode-menu-border, var(--vscode-panel-border));
    border-radius: 4px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    min-width: 160px;
    width: max-content;
    padding: 4px 0;
    white-space: nowrap;
    overflow-y: auto;
    overscroll-behavior: contain; /* a scroll inside the flyout must not bubble to the log list */
}
.context-menu-submenu:hover > .context-menu-submenu-content { display: block; }

/* --- Toggle items (checkmark + label) --- */
/* Check sits left of the label (VS Code convention): icon → ✓ → label.
   Previously absolute-positioned at right:8px, which looked like a submenu ▸ arrow
   and caused users to expect a flyout that never appeared. */
.context-menu-toggle { position: relative; }
.context-menu-toggle .context-menu-check {
    font-size: 14px;
    opacity: 0;
    margin-right: -4px; /* tighten gap between check and label */
}
.context-menu-toggle.checked .context-menu-check { opacity: 0.8; }
/* Explicit flex item so the text label is never collapsed by the flex layout.
   font-family inherits from .context-menu-item; override only if needed. */
.context-menu-label { flex: 1 1 auto; }
/* Right-aligned dimmed shortcut hint (VS Code convention: Ctrl+C sits right of the label).
   margin-left:auto pushes it to the far right; the label's flex:1 already fills the middle. */
.context-menu-shortcut {
    margin-left: 24px;
    opacity: 0.5;
    font-size: 11px;
    white-space: nowrap;
}

`;
}

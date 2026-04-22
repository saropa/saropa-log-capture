"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getContextMenuStyles = getContextMenuStyles;
/** CSS for the right-click context menu, submenus, and toggle items. */
function getContextMenuStyles() {
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

/* --- Submenu flyout panel --- */
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
}
.context-menu-submenu:hover > .context-menu-submenu-content { display: block; }
/* Flip submenus left when context menu is near right viewport edge */
.context-menu.flip-submenu .context-menu-submenu-content { left: auto; right: 100%; }
/* When menu is near top, push submenu content down so top is not cropped (e.g. terminal tab bar, toolbar). */
.context-menu.flip-submenu-vertical-top .context-menu-submenu-content {
    top: var(--submenu-content-top, 0);
    bottom: auto;
}
/* Near bottom only: align submenu bottom with trigger so flyout opens upward. Must not apply when
   flip-submenu-vertical-top is also set — short panels often need both JS flags, and the top offset must win. */
.context-menu.flip-submenu-vertical:not(.flip-submenu-vertical-top) .context-menu-submenu-content { top: auto; bottom: 0; }

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

`;
}
//# sourceMappingURL=viewer-styles-context-menu.js.map
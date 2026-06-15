/**
 * CSS styles for the Recurring Errors slide-out panel.
 * Follows the same fixed-position pattern as other icon-bar panels.
 */

/** Return CSS for the recurring errors panel and its cards. */
export function getRecurringPanelStyles(): string {
    return /* css */ `

/* ===================================================================
   Recurring Errors Panel — slide-out
   =================================================================== */
.recurring-panel {
    width: 100%;
    min-width: 280px;
    height: 100%;
    background: var(--vscode-sideBar-background, var(--vscode-editor-background));
    border-right: 1px solid var(--vscode-sideBar-border, var(--vscode-panel-border));
    box-shadow: var(--shadow);
    display: none;
    flex-direction: column;
    overflow: hidden;
}

.recurring-panel.visible {
    display: flex;
}

.recurring-panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-2) var(--space-3);
    font-weight: 600;
    font-size: 12px;
    border-bottom: 1px solid var(--vscode-panel-border);
}

.recurring-panel-actions {
    display: flex;
    align-items: center;
    gap: var(--space-1);
}

.recurring-panel-action {
    background: none;
    border: none;
    color: var(--vscode-descriptionForeground);
    cursor: pointer;
    padding: 2px var(--space-1);
    border-radius: var(--radius-sm);
    font-size: 14px;
}

.recurring-panel-action:hover {
    color: var(--vscode-foreground);
    background: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31));
}

.recurring-panel-close {
    background: none;
    border: none;
    color: var(--vscode-descriptionForeground);
    font-size: 16px;
    cursor: pointer;
    padding: 0 4px;
}

.recurring-panel-close:hover {
    /* Destructive close = fail/red role; one token across every panel's close button. */
    color: var(--status-bad);
    background: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31));
}

.recurring-panel-content {
    flex: 1;
    overflow-y: auto;
    padding: var(--space-1) 0;
}

/* --- Recurring error cards --- */
.re-card {
    border-bottom: 1px solid var(--vscode-panel-border);
    padding: 6px var(--space-3);
    font-size: 12px;
}

.re-card:hover { background: var(--vscode-list-hoverBackground); }
.re-closed { opacity: 0.5; }

.re-text {
    font-family: var(--vscode-editor-font-family, monospace);
    font-size: 11px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    color: var(--vscode-errorForeground);
}

.re-meta { font-size: 0.9em; opacity: 0.8; margin-top: 2px; }

.re-regression { font-size: 0.85em; opacity: 0.85; margin-top: 2px; }
.re-regression .re-commit-link { color: var(--vscode-textLink-foreground); }
.re-regression .re-commit-link:hover { text-decoration: underline; }
.re-regression code { font-size: 0.95em; }

.re-actions { display: flex; gap: var(--space-1); margin-top: 3px; }

.re-action {
    background: var(--vscode-button-secondaryBackground);
    color: var(--vscode-button-secondaryForeground);
    border: none;
    padding: 1px var(--space-2);
    cursor: pointer;
    border-radius: 2px;
    font-size: 11px;
}

.re-action:hover { background: var(--vscode-button-secondaryHoverBackground); }

.recurring-empty {
    padding: var(--space-4) var(--space-3);
    font-size: 12px;
    color: var(--vscode-descriptionForeground);
    text-align: center;
}

.recurring-loading {
    padding: var(--space-4) var(--space-3);
    font-size: 12px;
    color: var(--vscode-descriptionForeground);
    text-align: center;
    animation: re-pulse 1.5s ease-in-out infinite;
}

@keyframes re-pulse { 0%, 100% { opacity: 0.6; } 50% { opacity: 0.2; } }

.recurring-footer {
    padding: var(--space-2) var(--space-3);
    text-align: center;
    cursor: pointer;
    color: var(--vscode-textLink-foreground);
    font-size: 12px;
    border-top: 1px solid var(--vscode-panel-border);
}

.recurring-footer { display: flex; align-items: center; justify-content: center; gap: var(--space-3); flex-wrap: wrap; }
#recurring-footer-signals:hover { text-decoration: underline; }
.recurring-footer-action {
    cursor: pointer;
    color: var(--vscode-textLink-foreground);
}
.recurring-footer-action:hover { text-decoration: underline; }

/* --- Category badges ---
   Theme-token pills matching the Crashlytics panel's .cp-badge treatment so the two
   crash surfaces read as one design language. Raw Material hex (#d32f2f + #fff text) was
   replaced with inputValidation tints + badge tokens: the old white-on-color text failed
   WCAG contrast on light themes, and the fixed hex ignored the active VS Code theme. These
   tokens carry their own foreground/border so the badges adapt to light, dark, and
   high-contrast themes. */
.re-cat-badge {
    display: inline-flex;
    align-items: center;
    font-size: 0.7em;
    padding: 1px 7px;
    border-radius: 9px;
    font-weight: 600;
    letter-spacing: 0.02em;
    border: 1px solid transparent;
    vertical-align: middle;
    margin-right: 4px;
}

/* Fatal → error tint (mirrors .cp-badge-crash). */
.re-cat-fatal { background: var(--vscode-inputValidation-errorBackground); color: var(--vscode-errorForeground); border-color: var(--vscode-inputValidation-errorBorder, var(--vscode-errorForeground)); }
/* ANR → warning tint (mirrors .cp-badge-anr). */
.re-cat-anr { background: var(--vscode-inputValidation-warningBackground); color: var(--vscode-editorWarning-foreground); border-color: var(--vscode-inputValidation-warningBorder, var(--vscode-editorWarning-foreground)); }
/* OOM → neutral badge fill with a purple foreground so it stays distinct from fatal/anr
   without a dedicated inputValidation token (none exists for purple). */
.re-cat-oom { background: var(--vscode-badge-background); color: var(--vscode-charts-purple, var(--vscode-debugConsole-infoForeground)); border-color: var(--vscode-charts-purple, var(--vscode-contrastBorder, transparent)); }
/* Native → neutral badge tokens (mirrors .cp-badge-nf). */
.re-cat-native { background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); }
`;
}

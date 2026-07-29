/**
 * CSS styles for the options panel in the viewer webview.
 *
 * Slide-out panel from the right side with organized sections for all viewer settings.
 */
import { getExclusionChipStyles } from './viewer-styles-exclusion-chips';
import { getOptionsExtraStyles } from './viewer-styles-options-extra';
import { getSeverityKeywordsStyles } from './viewer-styles-options-severity-keywords';

export function getOptionsStyles(): string {
    return /* css */ `

/* ===================================================================
   Options Panel
   Slide-out panel showing all viewer settings
   organized into logical sections.
   =================================================================== */
.options-panel {
    width: 100%;
    min-width: 280px;
    height: 100%;
    background: var(--vscode-sideBar-background, var(--surface-1));
    border-right: 1px solid var(--vscode-sideBar-border, var(--border));
    box-shadow: 2px 0 8px rgba(0, 0, 0, 0.3);
    display: none;
    flex-direction: column;
    overflow: hidden;
}

.options-panel.visible {
    display: flex;
}

.options-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-2) var(--space-3);
    background: var(--vscode-sideBarTitle-background, var(--vscode-panel-background));
    border-bottom: 1px solid var(--vscode-sideBar-border, var(--border));
    font-weight: bold;
    font-size: var(--text-body);
}

.options-close {
    background: none;
    border: none;
    color: var(--muted);
    cursor: pointer;
    padding: 2px;
    border-radius: var(--radius-sm);
    font-size: 14px;
}

.options-close:hover {
    color: var(--vscode-errorForeground, #f44);
    background: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31));
}

.options-search-wrapper {
    display: flex;
    align-items: center;
    background: var(--inset);
    border-bottom: 1px solid var(--vscode-sideBar-border, var(--border));
    padding: var(--space-1) var(--space-2);
}
#filters-search,
#options-search {
    flex: 1;
    min-width: 0;
    background: transparent;
    color: var(--vscode-input-foreground);
    border: none;
    padding: 3px 4px;
    font-size: var(--text-caption);
    font-family: inherit;
    outline: none;
}
.options-search-clear {
    background: none;
    border: none;
    color: var(--muted);
    font-size: 14px;
    cursor: pointer;
    padding: 0 var(--space-1);
    line-height: 1;
    visibility: hidden;
}
.options-search-clear.visible { visibility: visible; }
.options-search-clear:hover { color: var(--vscode-errorForeground, #f44); }

.options-filtered-hidden { display: none !important; }

.options-content {
    flex: 1;
    overflow-y: auto;
    padding: var(--space-2) 0;
}

.options-section {
    margin-bottom: var(--space-4);
    padding: 0 var(--space-3);
}

.options-section-title {
    font-size: var(--text-caption);
    font-weight: bold;
    text-transform: uppercase;
    color: var(--muted);
    margin: 0 0 8px 0;
    padding: 0;
}

.options-row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-1) 0;
    font-size: 12px;
    cursor: pointer;
}

.options-row input[type="checkbox"], .options-row input[type="radio"] {
    accent-color: var(--vscode-button-background);
    cursor: pointer;
}
.scope-disabled { opacity: 0.4; pointer-events: none; }
.scope-suffix { opacity: 0.5; margin-left: var(--space-1); font-style: italic; }

.options-row select {
    background: var(--inset);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border, transparent);
    font-size: var(--text-caption);
    padding: 2px 4px;
    border-radius: 2px;
    flex: 1;
}

.options-row:has(select) {
    cursor: default;
}

.options-row:hover:has(input[type="checkbox"]) {
    background: var(--vscode-list-hoverBackground, rgba(255, 255, 255, 0.05));
}

/* Container for the tier source groups */
.tier-filter-list {
    padding: 6px 10px;
}
/* Tier radio groups (Flutter / Device / External) — radios below legend */
.tier-radio-group {
    border: none;
    margin: 0;
    padding: var(--space-2) 0;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-1) 10px;
    font-size: 12px;
}
.tier-radio-group legend {
    /* Legend sits on its own line above the radios */
    width: 100%;
    padding: 0 0 4px;
    font-weight: 600;
    font-size: 12px;
    color: var(--text);
}
/* Inline hint after the tier legend — explains what the tier includes */
.tier-hint {
    font-weight: normal;
    font-size: var(--text-caption);
    opacity: 0.6;
}
/* Vertical spacing before Device and External tiers */
.tier-radio-group-spaced {
    margin-top: 10px;
    padding-top: 10px;
    border-top: 1px solid var(--border);
}
.tier-radio-group label {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    cursor: pointer;
    font-size: 12px;
    /* Indent radios under the legend */
    margin-left: var(--space-3);
}
.tier-radio-group input[type="radio"] {
    accent-color: var(--vscode-button-background);
    cursor: pointer;
    margin: 0;
}

.options-indent {
    margin-left: 20px;
    padding-left: var(--space-3);
    border-left: 2px solid var(--vscode-panel-border, rgba(255, 255, 255, 0.1));
    transition: opacity 0.15s ease;
}

.options-row input:disabled + span,
.deco-settings-row input:disabled + span {
    opacity: 0.4;
}

/* Action buttons (Reset to default, Reset all, SQL Query History…) */
.options-action-btn {
    background: var(--vscode-button-secondaryBackground, rgba(90, 93, 94, 0.5));
    color: var(--vscode-button-secondaryForeground, var(--text));
    border: 1px solid var(--vscode-button-border, transparent);
    font-size: var(--text-caption);
    padding: var(--space-1) var(--space-3);
    cursor: pointer;
    border-radius: var(--radius-sm);
}
.options-action-btn:hover {
    background: var(--vscode-button-secondaryHoverBackground, rgba(90, 93, 94, 0.7));
}

/* Hint/status text under a control */
.options-hint {
    font-size: 10px;
    color: var(--muted);
    opacity: 0.8;
    padding: 0 0 4px 24px;
}

/* Log Sources: subheading before external source checkboxes */
.source-external-group-title {
    margin-top: var(--space-2);
    padding-top: var(--space-1);
    font-weight: 600;
    opacity: 0.95;
}

/* Code Location Scope: contextual warning when narrowing hides most lines */
.scope-filter-hint {
    margin-top: 6px;
    padding-left: var(--space-2);
    border-left: 2px solid var(--accent-warning);
}
.scope-hint-reset-btn {
    margin-left: var(--space-2);
    padding: 1px 6px;
    border: 1px solid var(--vscode-button-border, transparent);
    border-radius: var(--radius-sm);
    background: var(--vscode-button-secondaryBackground);
    color: var(--vscode-button-secondaryForeground);
    font-size: 10px;
    cursor: pointer;
}
.scope-hint-reset-btn:hover {
    background: var(--vscode-button-secondaryHoverBackground);
}

/* Integrations button in options (opens Integrations screen) */
.options-integrations-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border: 1px solid var(--vscode-button-border, transparent);
    font-size: 12px;
    padding: 6px 12px;
    cursor: pointer;
    border-radius: var(--radius-sm);
    text-align: left;
}
.options-integrations-btn:hover {
    background: var(--vscode-button-hoverBackground);
}
.options-integrations-btn .codicon { font-size: 14px; }

/* Hide options content when Integrations view is shown */
.options-content-hidden {
    display: none !important;
}

` + getOptionsExtraStyles() + getExclusionChipStyles() + getSeverityKeywordsStyles();
}

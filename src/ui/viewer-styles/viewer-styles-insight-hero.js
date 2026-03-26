"use strict";
/**
 * Insight panel CSS: add-to-case button, hero block, embedded performance panel.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getInsightHeroStyles = getInsightHeroStyles;
/** Return CSS for Insight panel hero and add-to-case styles. */
function getInsightHeroStyles() {
    return /* css */ `

/* Inline add-to-case button on recurring cards */
.re-add-to-case {
    margin-right: 4px;
    font-weight: bold;
    cursor: pointer;
}

.re-add-to-case:hover {
    text-decoration: underline;
}

/* Embedded performance panel inside Insight */
.insight-hero-block {
    padding-bottom: 6px;
    padding-left: 8px;
    margin-left: -8px;
    border-left: 3px solid transparent;
    border-bottom: 1px solid var(--vscode-panel-border);
    margin-bottom: 4px;
}

.insight-hero-block.insight-hero-has-errors {
    border-left-color: var(--vscode-errorForeground, #f14c4c);
}

.insight-hero-block.insight-hero-has-warnings {
    border-left-color: var(--vscode-editorWarning-foreground, #cca700);
}

.insight-hero-block.insight-hero-has-errors.insight-hero-has-warnings {
    border-left-color: var(--vscode-errorForeground, #f14c4c);
}

.insight-section-session-details .performance-panel {
    display: flex !important;
    min-width: 0;
    border: none;
    box-shadow: none;
    background: transparent;
}

.insight-section-session-details .performance-panel-header {
    padding: 4px 0 8px;
}

.insight-section-session-details .pp-close {
    display: none;
}
`;
}
//# sourceMappingURL=viewer-styles-insight-hero.js.map
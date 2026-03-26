"use strict";
/**
 * Session tag chips, empty/loading states, and loading animations.
 * Composed by viewer-styles-session.ts.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSessionTagsLoadingStyles = getSessionTagsLoadingStyles;
/** Session tags section and loading/empty state styles. */
function getSessionTagsLoadingStyles() {
    return /* css */ `

/* --- Session tag chips (correlation filters: file/error tags across sessions) --- */
.session-tags-section {
    padding: 6px 12px;
    border-bottom: 1px solid var(--vscode-panel-border);
    flex-shrink: 0;
    min-height: 0;
}
.session-tags-section .session-tag-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    align-items: center;
    max-height: 4.8em;
    overflow-y: auto;
    overflow-x: hidden;
}
.session-tags-section .source-tag-chip {
    border: none;
    background: var(--vscode-badge-background, rgba(128, 128, 128, 0.25));
    color: var(--vscode-badge-foreground, var(--vscode-foreground));
}
.session-tags-section .source-tag-chip.active {
    background: var(--vscode-button-secondaryBackground, rgba(90, 93, 94, 0.31));
    color: var(--vscode-button-secondaryForeground, var(--vscode-foreground));
}
.session-tags-section .source-tag-chip .tag-label {
    display: inline-block;
    max-width: 140px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.session-tags-section .tag-count {
    flex-shrink: 0;
}

/* --- Empty / loading states --- */
.session-empty {
    padding: 16px 12px;
    font-size: 12px;
    color: var(--vscode-descriptionForeground);
    text-align: center;
}

.session-loading {
    padding: 12px 12px 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.session-loading-bar {
    height: 4px;
    background: var(--vscode-progressBar-background, rgba(128, 128, 128, 0.2));
    border-radius: 2px;
    overflow: hidden;
}

.session-loading-bar-fill {
    height: 100%;
    width: 40%;
    background: var(--vscode-progressBar-foreground, var(--vscode-focusBorder, #3794ff));
    border-radius: 2px;
    animation: session-progress-indeterminate 1.2s ease-in-out infinite;
}

.session-loading-label {
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
}

.session-loading-shimmer {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 4px;
}

.session-shimmer-line {
    height: 36px;
    border-radius: 4px;
    background: var(--vscode-sideBar-background, #252526);
    position: relative;
    overflow: hidden;
}

.session-shimmer-line::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(
        90deg,
        transparent 0%,
        var(--vscode-widget-border, rgba(255, 255, 255, 0.08)) 45%,
        var(--vscode-focusBorder, rgba(255, 255, 255, 0.12)) 50%,
        var(--vscode-widget-border, rgba(255, 255, 255, 0.08)) 55%,
        transparent 100%
    );
    background-size: 200% 100%;
    animation: session-shimmer 1.8s ease-in-out infinite;
}

.session-shimmer-line-short {
    width: 60%;
}

@keyframes session-progress-indeterminate {
    0% { transform: translateX(-100%); }
    50% { transform: translateX(150%); }
    100% { transform: translateX(-100%); }
}

@keyframes session-shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
}
`;
}
//# sourceMappingURL=viewer-styles-session-tags-loading.js.map
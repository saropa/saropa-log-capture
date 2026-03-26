"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUnifiedTimelineStyles = getUnifiedTimelineStyles;
exports.getTimelineStyles = getTimelineStyles;
/** CSS for the unified timeline panel (Phase 3: virtual scrolling, scrubber, minimap). */
function getUnifiedTimelineStyles() {
    return /* css */ `
* { margin: 0; padding: 0; box-sizing: border-box; }
body { background: var(--vscode-editor-background); color: var(--vscode-editor-foreground); font-family: var(--vscode-font-family, sans-serif); font-size: 13px; height: 100vh; display: flex; flex-direction: column; overflow: hidden; }

.header { padding: 10px 16px; background: var(--vscode-sideBar-background); border-bottom: 1px solid var(--vscode-panel-border); flex-shrink: 0; }
.title { font-size: 14px; font-weight: 600; margin-bottom: 2px; }
.subtitle { font-size: 11px; color: var(--vscode-descriptionForeground); }

.toolbar { display: flex; flex-wrap: wrap; gap: 12px; padding: 8px 16px; border-bottom: 1px solid var(--vscode-panel-border); background: var(--vscode-sideBar-background); flex-shrink: 0; align-items: center; }
.source-filters { display: flex; gap: 10px; flex-wrap: wrap; }
.source-filter { display: flex; align-items: center; gap: 4px; cursor: pointer; font-size: 11px; }
.source-filter input { cursor: pointer; width: 14px; height: 14px; }
.source-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.source-label { color: var(--vscode-editor-foreground); }
.source-count { color: var(--vscode-descriptionForeground); font-size: 10px; }
.stats-bar { display: flex; gap: 12px; font-size: 11px; color: var(--vscode-descriptionForeground); }
.stat-item { display: flex; align-items: center; gap: 4px; }
.stat-dot { width: 8px; height: 8px; border-radius: 50%; }
.stat-dot.error { background: var(--vscode-editorError-foreground, #f14c4c); }
.stat-dot.warning { background: var(--vscode-editorWarning-foreground, #cca700); }
.stat-dot.perf { background: var(--vscode-charts-purple, #b267e6); }
.export-buttons { display: flex; gap: 6px; margin-left: auto; }
.export-btn { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); border: none; padding: 4px 10px; border-radius: 3px; cursor: pointer; font-size: 11px; }
.export-btn:hover { background: var(--vscode-button-secondaryHoverBackground); }

.time-scrubber { display: flex; align-items: center; gap: 10px; padding: 8px 16px; border-bottom: 1px solid var(--vscode-panel-border); flex-shrink: 0; }
.time-label { font-family: var(--vscode-editor-font-family, monospace); font-size: 11px; color: var(--vscode-descriptionForeground); min-width: 60px; }
.time-label.end { text-align: right; }
.scrubber-track { flex: 1; height: 20px; background: var(--vscode-input-background); border-radius: 4px; position: relative; cursor: pointer; }
.scrubber-range { position: absolute; top: 4px; bottom: 4px; background: var(--vscode-button-background); border-radius: 2px; opacity: 0.5; }
.scrubber-handle { position: absolute; top: 2px; width: 10px; height: 16px; background: var(--vscode-button-background); border-radius: 3px; cursor: ew-resize; transform: translateX(-50%); }
.scrubber-handle:hover { background: var(--vscode-button-hoverBackground); }
.zoom-controls { display: flex; gap: 4px; }
.zoom-btn { width: 24px; height: 24px; background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); border: none; border-radius: 3px; cursor: pointer; font-size: 14px; line-height: 1; }
.zoom-btn:hover { background: var(--vscode-button-secondaryHoverBackground); }

.minimap { display: flex; align-items: flex-end; gap: 1px; height: 36px; padding: 3px 16px; background: var(--vscode-sideBar-background); border-bottom: 1px solid var(--vscode-panel-border); flex-shrink: 0; position: relative; cursor: pointer; }
.minimap-bar { width: 1%; min-width: 2px; border-radius: 1px 1px 0 0; transition: opacity 0.1s; }
.minimap-bar:hover { opacity: 0.7; }
.minimap-viewport { position: absolute; top: 3px; bottom: 3px; background: var(--vscode-editor-selectionBackground); border: 1px solid var(--vscode-focusBorder); border-radius: 2px; pointer-events: none; }

.timeline-container { flex: 1; overflow-y: auto; overflow-x: hidden; }
.virtual-spacer { width: 100%; }

.event-row { display: flex; align-items: flex-start; padding: 4px 16px; gap: 8px; height: 28px; cursor: pointer; transition: background 0.1s; border-bottom: 1px solid transparent; }
.event-row:hover { background: var(--vscode-list-hoverBackground); }
.event-row.selected { background: var(--vscode-list-activeSelectionBackground); color: var(--vscode-list-activeSelectionForeground); }
.event-time { width: 65px; flex-shrink: 0; font-family: var(--vscode-editor-font-family, monospace); font-size: 11px; color: var(--vscode-descriptionForeground); text-align: right; }
.event-icon { width: 14px; flex-shrink: 0; text-align: center; font-size: 11px; }
.level-error .event-icon { color: var(--vscode-editorError-foreground, #f14c4c); }
.level-warning .event-icon { color: var(--vscode-editorWarning-foreground, #cca700); }
.level-perf .event-icon { color: var(--vscode-charts-purple, #b267e6); }
.level-debug .event-icon, .level-info .event-icon { color: var(--vscode-descriptionForeground); }
.event-source { width: 70px; flex-shrink: 0; font-size: 10px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; }
.event-summary { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-family: var(--vscode-editor-font-family, monospace); font-size: 12px; }
.level-error { background: color-mix(in srgb, var(--vscode-editorError-foreground, #f14c4c) 8%, transparent); }
.level-warning { background: color-mix(in srgb, var(--vscode-editorWarning-foreground, #cca700) 5%, transparent); }

.correlation-badge { color: var(--vscode-textLink-foreground); cursor: pointer; margin-left: 4px; }
.correlation-badge:hover { text-decoration: underline; }
.event-row.correlation-highlight { background: var(--vscode-list-hoverBackground); outline: 1px solid var(--vscode-focusBorder); }

.timeline-correlations { padding: 8px 16px; border-bottom: 1px solid var(--vscode-panel-border); background: var(--vscode-sideBar-background); flex-shrink: 0; }
.timeline-correlations .cp-header { font-weight: 600; margin-bottom: 6px; font-size: 12px; }
.timeline-correlations .cp-list { display: flex; flex-direction: column; gap: 8px; }
.timeline-correlations .cp-item { border: 1px solid var(--vscode-panel-border); border-radius: 4px; padding: 6px 10px; }
.timeline-correlations .cp-desc { font-size: 11px; margin-bottom: 4px; font-weight: 500; }
.timeline-correlations .cp-events { margin: 0; padding-left: 18px; font-size: 11px; }
.timeline-correlations .cp-events li { margin: 2px 0; list-style: disc; }
.timeline-correlations .cp-jump { background: none; border: none; color: var(--vscode-textLink-foreground); cursor: pointer; padding: 0; margin-right: 4px; text-decoration: underline; font-size: inherit; transition: color 0.12s ease; }
.timeline-correlations .cp-jump:hover { color: var(--vscode-textLink-activeForeground); }
.timeline-correlations .cp-high { border-left: 3px solid var(--vscode-testing-iconPassed); }
.timeline-correlations .cp-medium { border-left: 3px solid var(--vscode-editorWarning-foreground); }
.timeline-correlations .cp-low { border-left: 3px solid var(--vscode-descriptionForeground); }

.empty-state, .loading, .error-state { padding: 32px 16px; text-align: center; color: var(--vscode-disabledForeground); font-style: italic; }
.loading::before { content: ''; display: inline-block; width: 16px; height: 16px; border: 2px solid var(--vscode-progressBar-background); border-top-color: transparent; border-radius: 50%; animation: spin 0.8s linear infinite; margin-right: 8px; vertical-align: middle; }
@keyframes spin { to { transform: rotate(360deg); } }
.error-state { color: var(--vscode-editorError-foreground); }

.timeline-container::-webkit-scrollbar { width: 10px; }
.timeline-container::-webkit-scrollbar-track { background: var(--vscode-scrollbarSlider-background); }
.timeline-container::-webkit-scrollbar-thumb { background: var(--vscode-scrollbarSlider-hoverBackground); border-radius: 5px; }
.timeline-container::-webkit-scrollbar-thumb:hover { background: var(--vscode-scrollbarSlider-activeBackground); }
`;
}
function getTimelineStyles() { return getUnifiedTimelineStyles(); }
//# sourceMappingURL=timeline-panel-styles.js.map
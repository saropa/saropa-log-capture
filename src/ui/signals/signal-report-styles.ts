/** CSS for the signal report webview panel. */

import { getEcosystemStyles } from './signal-report-ecosystem-styles';

export function getSignalReportStyles(): string {
  return /* css */ `
body {
    font-family: var(--vscode-font-family, system-ui, sans-serif);
    font-size: 13px;
    line-height: 1.5;
    color: var(--vscode-foreground);
    background: var(--vscode-editor-background);
    padding: 12px 16px;
    margin: 0;
}
h1 {
    font-size: 16px;
    font-weight: 600;
    margin: 0 0 4px;
}
.signal-summary {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    margin: 0 0 12px;
}
h2 {
    font-size: 14px;
    font-weight: 600;
    margin: 16px 0 8px;
    color: var(--vscode-foreground);
    border-bottom: 1px solid var(--vscode-widget-border, var(--vscode-panel-border));
    padding-bottom: 4px;
}
.conf-badge {
    display: inline-block;
    font-size: 12px;
    padding: 1px 6px;
    border-radius: 3px;
    font-weight: 600;
    border: 1px solid;
}
.conf-badge--high {
    background: rgba(255, 80, 80, 0.18);
    color: #f14c4c;
    border-color: #f14c4c;
}
.conf-badge--medium {
    background: rgba(255, 200, 0, 0.18);
    color: #cca700;
    border-color: #cca700;
}
.conf-badge--low {
    background: rgba(128, 128, 128, 0.18);
    color: var(--vscode-foreground);
    border-color: var(--vscode-widget-border, rgba(128, 128, 128, 0.5));
}
.section-slot {
    margin: 8px 0;
    min-height: 24px;
}
.section-loading {
    color: var(--vscode-descriptionForeground);
    font-style: italic;
    font-size: 12px;
}
.evidence-block {
    margin: 8px 0;
    border: 1px solid var(--vscode-widget-border, var(--vscode-panel-border));
    border-radius: 4px;
    overflow: hidden;
}
.evidence-header {
    background: var(--vscode-editorWidget-background, var(--vscode-sideBar-background));
    padding: 4px 8px;
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
    border-bottom: 1px solid var(--vscode-widget-border, var(--vscode-panel-border));
}
.evidence-lines {
    font-family: var(--vscode-editor-font-family, 'Consolas', monospace);
    font-size: var(--vscode-editor-font-size, 12px);
    line-height: 1.4;
    padding: 0;
    margin: 0;
}
.evidence-line {
    padding: 1px 8px;
    white-space: pre-wrap;
    word-break: break-all;
}
.evidence-line--target {
    background: var(--vscode-editor-findMatchHighlightBackground, rgba(234, 92, 0, 0.25));
    font-weight: 600;
}
.evidence-line-num {
    display: inline-block;
    min-width: 4ch;
    text-align: right;
    margin-right: 8px;
    color: var(--vscode-editorLineNumber-foreground);
    user-select: none;
}
.no-data {
    color: var(--vscode-descriptionForeground);
    font-style: italic;
    font-size: 12px;
    padding: 8px 0;
}
details {
    margin: 4px 0;
}
details summary {
    cursor: pointer;
    font-weight: 500;
    padding: 4px 0;
    user-select: none;
}
details summary:hover {
    color: var(--vscode-textLink-foreground);
}
.recommendation {
    padding: 8px 12px;
    margin: 8px 0;
    border-left: 3px solid var(--vscode-textLink-foreground, #3794ff);
    background: var(--vscode-editorWidget-background, var(--vscode-sideBar-background));
    border-radius: 0 4px 4px 0;
    font-size: 12px;
}
.copy-btn {
    border: 1px solid var(--vscode-button-secondaryBorder, var(--vscode-widget-border));
    border-radius: 2px;
    background: var(--vscode-button-secondaryBackground, rgba(90, 93, 94, 0.31));
    color: var(--vscode-button-secondaryForeground, var(--vscode-foreground));
    font-size: 11px;
    padding: 4px 10px;
    cursor: pointer;
    margin: 8px 0;
}
.copy-btn:hover {
    background: var(--vscode-button-secondaryHoverBackground, rgba(90, 93, 94, 0.5));
}
.btn-row {
    display: flex;
    gap: 8px;
    margin: 8px 0;
}
.related-summary {
    font-weight: 500;
    margin: 8px 0 4px;
}
.related-list {
    border: 1px solid var(--vscode-widget-border, var(--vscode-panel-border));
    border-radius: 4px;
    overflow: hidden;
    margin: 4px 0 8px;
    max-height: 400px;
    overflow-y: auto;
}
.related-item {
    display: flex;
    align-items: baseline;
    gap: 8px;
    padding: 3px 8px;
    font-family: var(--vscode-editor-font-family, 'Consolas', monospace);
    font-size: var(--vscode-editor-font-size, 12px);
    border-bottom: 1px solid var(--vscode-widget-border, rgba(128, 128, 128, 0.15));
}
.related-item:last-child {
    border-bottom: none;
}
.related-line-num {
    flex-shrink: 0;
    min-width: 7ch;
    color: var(--vscode-editorLineNumber-foreground);
    user-select: none;
}
.related-badge {
    flex-shrink: 0;
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
    font-weight: 500;
}
.related-excerpt {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
}
.related-overflow {
    padding: 4px 8px;
    color: var(--vscode-descriptionForeground);
    font-style: italic;
    font-size: 12px;
}
.overview-row {
    display: flex;
    gap: 8px;
    padding: 2px 0;
    font-size: 12px;
}
.overview-label {
    flex-shrink: 0;
    min-width: 8ch;
    color: var(--vscode-descriptionForeground);
}
.overview-value {
    word-break: break-all;
}
.overview-stats {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin: 8px 0;
}
.overview-stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    min-width: 60px;
    padding: 6px 10px;
    border: 1px solid var(--vscode-widget-border, rgba(128, 128, 128, 0.3));
    border-radius: 4px;
    background: var(--vscode-editorWidget-background, var(--vscode-sideBar-background));
}
.stat-count {
    font-size: 18px;
    font-weight: 700;
    color: var(--vscode-foreground);
}
.stat-label {
    font-size: 10px;
    color: var(--vscode-descriptionForeground);
    text-align: center;
}
.detail-grid {
    margin: 8px 0;
}
.detail-row {
    display: flex;
    gap: 8px;
    padding: 2px 0;
    font-size: 12px;
}
.detail-label {
    flex-shrink: 0;
    min-width: 14ch;
    color: var(--vscode-descriptionForeground);
    font-weight: 500;
}
.detail-value {
    word-break: break-all;
}
.detail-subheading {
    font-weight: 500;
    margin: 6px 0 2px;
    font-size: 12px;
}
.detail-factor {
    padding: 1px 0 1px 12px;
    font-size: 12px;
    color: var(--vscode-foreground);
}
.other-signal {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 0;
    font-size: 12px;
}
.other-signal-text {
    flex: 1;
    word-break: break-word;
}
/* Cross-session history section */
.history-summary { margin-bottom: 8px; color: var(--vscode-descriptionForeground); font-size: 13px; }
.history-session-list { max-height: 300px; overflow-y: auto; }
.history-session-row { display: flex; justify-content: space-between; align-items: center; padding: 4px 8px; cursor: pointer; border-radius: 3px; font-size: 12px; }
.history-session-row:hover { background: var(--vscode-list-hoverBackground); }
.history-session-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.history-session-date { flex-shrink: 0; color: var(--vscode-descriptionForeground); margin-left: 12px; }
` + getEcosystemStyles();
}

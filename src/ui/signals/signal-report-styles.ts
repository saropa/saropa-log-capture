/** CSS for the signal report webview panel. */

import { getEcosystemStyles } from './signal-report-ecosystem-styles';
import { getFeedbackStyles } from './signal-report-feedback-styles';
import { getLayoutStyles } from './signal-report-layout-styles';
import { getOverviewStyles } from './signal-report-overview-styles';

export function getSignalReportStyles(): string {
  return /* css */ `
body {
    font-family: var(--vscode-font-family, system-ui, sans-serif);
    font-size: var(--text-body);
    line-height: 1.5;
    color: var(--text);
    background: var(--surface-1);
    padding: var(--space-3) var(--space-4);
    margin: 0;
}
h1 {
    font-size: var(--text-h3);
    font-weight: 600;
    margin: 0 0 var(--space-1);
}
h2 {
    /* Section heading: no exact 14px token on the scale; --text-h3 (15px) is the
       nearest heading-role step above body, keeping h2 visibly larger than body text. */
    font-size: var(--text-h3);
    font-weight: 600;
    margin: var(--space-4) 0 var(--space-2);
    color: var(--text);
    border-bottom: 1px solid var(--border);
    padding-bottom: var(--space-1);
}
.conf-badge {
    display: inline-block;
    font-size: var(--text-caption);
    padding: 1px 6px;
    border-radius: var(--radius-sm);
    font-weight: 600;
    border: 1px solid;
}
/* Confidence tiers map to severity: high=critical (host error), medium=warning, low=neutral muted — tints track the host theme via color-mix. */
.conf-badge--high {
    background: color-mix(in srgb, var(--accent-critical) 18%, transparent);
    color: var(--accent-critical);
    border-color: var(--accent-critical);
    box-shadow: 0 0 6px color-mix(in srgb, var(--accent-critical) 25%, transparent);
}
.conf-badge--medium {
    background: color-mix(in srgb, var(--accent-warning) 18%, transparent);
    color: var(--accent-warning);
    border-color: var(--accent-warning);
    box-shadow: 0 0 6px color-mix(in srgb, var(--accent-warning) 20%, transparent);
}
.conf-badge--low {
    background: color-mix(in srgb, var(--muted) 18%, transparent);
    color: var(--text);
    border-color: var(--border);
}
/* .section-slot and .section-loading styles live in layout and feedback style modules */
.evidence-block {
    margin: var(--space-2) 0;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    overflow: hidden;
    /* Subtle warm glow on the block that contains the actual evidence */
    box-shadow: var(--shadow);
}
.evidence-header {
    background: var(--surface-2);
    padding: var(--space-1) var(--space-2);
    font-size: var(--text-caption);
    color: var(--muted);
    border-bottom: 1px solid var(--border);
}
.evidence-meta {
    padding: var(--space-1) var(--space-2);
    font-size: var(--text-caption);
    color: var(--muted);
    background: var(--surface-2);
    border-bottom: 1px solid var(--border);
}
.evidence-lines {
    font-family: var(--vscode-editor-font-family, 'Consolas', monospace);
    font-size: var(--vscode-editor-font-size, 12px);
    line-height: 1.4;
    padding: 0;
    margin: 0;
}
.evidence-line {
    padding: 1px var(--space-2);
    white-space: pre-wrap;
    word-break: break-all;
}
.evidence-line--target {
    /* Fall back to a brand-tinted highlight when the host find-match color is absent. */
    background: var(--vscode-editor-findMatchHighlightBackground, color-mix(in srgb, var(--brand-2) 25%, transparent));
    font-weight: 600;
    /* Left accent makes the target scannable without reading background colors. */
    border-left: 3px solid var(--accent-critical);
    padding-left: calc(var(--space-2) - 3px);
}
/* Context fade: lines far from the target get progressively lower opacity,
   drawing the eye to the center evidence line. */
.evidence-line { opacity: 0.55; transition: opacity 0.15s ease; }
.evidence-line--target { opacity: 1; }
/* Lines adjacent to the target stay mostly visible. */
.evidence-line--target + .evidence-line { opacity: 0.8; }
.evidence-line:has(+ .evidence-line--target) { opacity: 0.8; }
.evidence-line-num {
    display: inline-block;
    min-width: 4ch;
    text-align: right;
    margin-right: 8px;
    color: var(--vscode-editorLineNumber-foreground);
    user-select: none;
}
.no-data {
    color: var(--muted);
    font-style: italic;
    font-size: var(--text-caption);
    padding: var(--space-2) 0;
}
details {
    margin: var(--space-1) 0;
}
details summary {
    cursor: pointer;
    font-weight: 500;
    padding: var(--space-1) 0;
    user-select: none;
}
details summary:hover {
    color: var(--link);
}
.recommendation {
    padding: var(--space-2) var(--space-3);
    margin: var(--space-2) 0;
    border-left: 3px solid var(--link);
    background: var(--surface-2);
    border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
    font-size: var(--text-caption);
}
.copy-btn {
    border: 1px solid var(--vscode-button-secondaryBorder, var(--border));
    border-radius: var(--radius-sm);
    background: var(--vscode-button-secondaryBackground, color-mix(in srgb, var(--muted) 31%, transparent));
    color: var(--vscode-button-secondaryForeground, var(--text));
    font-size: var(--text-caption);
    padding: var(--space-1) 10px;
    cursor: pointer;
    margin: var(--space-2) 0;
}
.copy-btn:hover {
    background: var(--vscode-button-secondaryHoverBackground, color-mix(in srgb, var(--muted) 50%, transparent));
}
.btn-row {
    display: flex;
    gap: var(--space-2);
    margin: var(--space-2) 0;
}
.related-summary {
    font-weight: 500;
    margin: var(--space-2) 0 var(--space-1);
}
.related-list {
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    overflow: hidden;
    margin: var(--space-1) 0 var(--space-2);
    max-height: 400px;
    overflow-y: auto;
}
.related-item {
    display: flex;
    align-items: baseline;
    gap: var(--space-2);
    padding: 3px var(--space-2);
    font-family: var(--vscode-editor-font-family, 'Consolas', monospace);
    font-size: var(--vscode-editor-font-size, 12px);
    border-bottom: 1px solid var(--border);
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
    font-size: var(--text-caption);
    color: var(--muted);
    font-weight: 500;
}
.related-excerpt {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
}
.related-overflow {
    padding: var(--space-1) var(--space-2);
    color: var(--muted);
    font-style: italic;
    font-size: var(--text-caption);
}
.detail-grid {
    margin: var(--space-2) 0;
}
.detail-row {
    display: flex;
    gap: var(--space-2);
    padding: 2px 0;
    font-size: var(--text-caption);
}
.detail-label {
    flex-shrink: 0;
    min-width: 14ch;
    color: var(--muted);
    font-weight: 500;
}
.detail-value {
    word-break: break-all;
}
.detail-subheading {
    font-weight: 500;
    margin: 6px 0 2px;
    font-size: var(--text-caption);
}
.detail-factor {
    padding: 1px 0 1px var(--space-3);
    font-size: var(--text-caption);
    color: var(--text);
}
.other-signal {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-1) 0;
    font-size: var(--text-caption);
}
.other-signal-text {
    flex: 1;
    word-break: break-word;
}
/* Cross-session history section */
.history-summary { margin-bottom: var(--space-2); color: var(--muted); font-size: var(--text-body); }
.history-session-list { max-height: 300px; overflow-y: auto; }
.history-session-row { display: flex; justify-content: space-between; align-items: center; padding: var(--space-1) var(--space-2); cursor: pointer; border-radius: var(--radius-sm); font-size: var(--text-caption); }
.history-session-row:hover { background: var(--vscode-list-hoverBackground); }
.history-session-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.history-session-date { flex-shrink: 0; color: var(--muted); margin-left: var(--space-3); }
/* Screenshot evidence strip (plan 114) */
.screenshot-strip { display: flex; gap: var(--space-2); flex-wrap: wrap; }
/* Before/after pixel-diff block: three equal cells, wraps on narrow columns. */
.screenshot-diff { display: flex; gap: var(--space-2); flex-wrap: wrap; margin-bottom: var(--space-2); }
.diff-cell { flex: 1 1 140px; min-width: 120px; margin: 0; }
.diff-img, .diff-canvas { display: block; width: 100%; border-radius: var(--radius-sm); border: 1px solid var(--vscode-editorWidget-border); }
.diff-cell figcaption { margin-top: var(--space-1); color: var(--muted); font-size: var(--text-caption); }
.screenshot-card { display: block; max-width: 300px; text-decoration: none; }
.screenshot-thumb { display: block; max-width: 100%; max-height: 200px; border-radius: var(--radius-sm); border: 1px solid var(--vscode-editorWidget-border); }
.screenshot-caption { display: block; margin-top: var(--space-1); color: var(--muted); font-size: var(--text-caption); }
` + getOverviewStyles() + getLayoutStyles() + getFeedbackStyles() + getEcosystemStyles();
}

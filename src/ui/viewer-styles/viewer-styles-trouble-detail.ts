/**
 * Styles for the Trouble Mode detail pane (plan Trouble Mode dashboard, Stage 4).
 *
 * The pane is an absolute overlay inside #log-content-wrapper, so it covers only
 * the feed while the severity chart and toolbar stay visible. Content is built
 * host-side (trouble-detail-builder.ts) and reuses the signal-report evidence
 * renderer, so the `.evidence-*` classes it emits are styled here for the viewer
 * (the signal report's own stylesheet lives in its separate webview, not here).
 *
 * All colors come from the design tokens (viewer-styles-tokens.ts) so the pane
 * stays theme-aware; severity accents match the feed and the chart.
 */
export function getTroubleDetailStyles(): string {
    return /* css */ `
/* ===================================================================
   Trouble Mode — detail pane (feed overlay)
   =================================================================== */
.trouble-detail {
    position: absolute;
    inset: 0;
    z-index: 150;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: var(--surface-1);
}
.trouble-detail.u-hidden { display: none; }

.trouble-detail-head {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    background: var(--surface-2);
    border-bottom: 1px solid var(--border);
}
.trouble-detail-title {
    flex: 1;
    min-width: 0;
    font-size: var(--text-label);
    font-weight: 600;
    color: var(--text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.trouble-detail-close {
    flex-shrink: 0;
    background: none;
    border: none;
    color: var(--muted);
    font-size: 18px;
    line-height: 1;
    cursor: pointer;
    padding: 0 var(--space-1);
    border-radius: var(--radius-sm);
}
.trouble-detail-close:hover { color: var(--text); background: var(--vscode-toolbar-hoverBackground, rgba(128,128,128,0.2)); }

.trouble-detail-body {
    flex: 1;
    min-height: 0;
    overflow: auto;
    padding: var(--space-3);
    font-family: var(--vscode-font-family);
    font-size: var(--text-body);
    color: var(--text);
}

/* Host-built detail sections. */
.trouble-detail-body .td-section { margin-bottom: var(--space-4); }
.trouble-detail-body .td-section-title {
    font-size: var(--text-eyebrow);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--muted);
    margin-bottom: var(--space-2);
}
.trouble-detail-body .td-fault {
    font-family: var(--vscode-editor-font-family, monospace);
    font-size: var(--text-caption);
    background: var(--inset);
    border: 1px solid var(--border);
    border-left: 3px solid var(--accent-critical);
    border-radius: var(--radius-sm);
    padding: var(--space-2);
    white-space: pre-wrap;
    word-break: break-word;
}
.trouble-detail-body .td-fault.td-fault-warning { border-left-color: var(--accent-warning); }
.trouble-detail-body .td-fault.td-fault-performance { border-left-color: var(--accent-info); }
.trouble-detail-body .td-meta { color: var(--muted); margin-bottom: var(--space-1); }
.trouble-detail-body .td-kv { display: flex; gap: var(--space-2); margin-bottom: var(--space-1); }
.trouble-detail-body .td-kv .td-k { color: var(--muted); min-width: 120px; }
.trouble-detail-body .no-data { color: var(--muted); font-style: italic; }

/* Evidence block reused from the signal-report renderer (renderEvidenceSection). */
.trouble-detail-body .evidence-block { margin-bottom: var(--space-3); }
.trouble-detail-body .evidence-meta { color: var(--muted); font-size: var(--text-caption); margin-bottom: var(--space-1); }
.trouble-detail-body .evidence-lines {
    font-family: var(--vscode-editor-font-family, monospace);
    font-size: var(--text-caption);
    background: var(--inset);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    overflow-x: auto;
}
.trouble-detail-body .evidence-line { display: flex; gap: var(--space-2); padding: 1px var(--space-2); white-space: pre; }
.trouble-detail-body .evidence-line-num { color: var(--muted); text-align: right; min-width: 44px; user-select: none; }
.trouble-detail-body .evidence-line--target { background: var(--brand-glow); }
`;
}

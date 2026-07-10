/**
 * Styles for the Trouble Mode side rail (plan 110, Stage 1; originally the Stage 4
 * detail overlay of the Trouble Mode dashboard plan).
 *
 * The rail lives inside #log-content-wrapper, which is already a flex ROW whose
 * .log-content-clip child is `flex: 1 1 0%; min-width: 0`. So the wide layout needs
 * no new container: the rail simply becomes a static flex item and the feed shrinks
 * beside it. That is the whole fix for the v1 defect — the rail shipped as
 * `position: absolute; inset: 0`, which covered the feed at EVERY width, and triage
 * means reading the report against the log.
 *
 * The overlay remains as the NARROW fallback: below the rail breakpoint the sidebar
 * cannot afford two columns, so `body.slc-trouble-rail-wide` is absent and the
 * default absolute rules apply. The class is set from JS (viewer-trouble-detail.ts)
 * rather than a container query because #log-content-wrapper hosts absolutely
 * positioned children (minimap, jump buttons, goto-line) whose containing block a
 * `container-type: inline-size` would silently change.
 *
 * Content is built host-side (trouble-detail-handler.ts) and reuses the signal-report
 * evidence renderer, so the `.evidence-*` classes it emits are styled here for the
 * viewer (the signal report's own stylesheet lives in its separate webview, not here).
 *
 * All colors come from the design tokens (viewer-styles-tokens.ts) so the rail stays
 * theme-aware; severity accents match the feed and the chart.
 */
export function getTroubleDetailStyles(): string {
    return /* css */ `
/* ===================================================================
   Trouble Mode — side rail (narrow fallback: full-feed overlay)
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

/* Wide layout: a static right column. The clamped width keeps the rail from ever being
   too narrow to read a stack frame (320px) or wide enough to starve the feed (560px),
   and tracks the wrapper in between. The feed reflows through the existing
   ResizeObserver on #log-content, so word-wrap row heights recalc on open/close. */
body.slc-trouble-rail-wide .trouble-detail {
    position: relative;
    inset: auto;
    z-index: auto;
    flex: 0 0 auto;
    width: clamp(320px, 40%, 560px);
    height: 100%;
    border-left: 1px solid var(--border);
}

/* Severity identity: a colored cap on the rail head so a report never reads as
   "the log jumped". The level class is set by renderTroubleDetail from the same
   item.level the feed filters on — it can never disagree with the row's badge. */
.trouble-detail-head {
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    background: var(--surface-2);
    border-top: 3px solid var(--accent-critical);
    border-bottom: 1px solid var(--border);
}
.trouble-detail.td-sev-warning .trouble-detail-head { border-top-color: var(--accent-warning); }
.trouble-detail.td-sev-performance .trouble-detail-head { border-top-color: var(--accent-info); }

.trouble-detail-head-top {
    display: flex;
    align-items: flex-start;
    gap: var(--space-2);
}
/* Two-line clamp rather than a single ellipsized line: an exception message is the
   most useful text in the report, and at rail width one line truncates all of it. */
.trouble-detail-title {
    flex: 1;
    min-width: 0;
    font-size: var(--text-label);
    font-weight: 600;
    color: var(--text);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    overflow-wrap: anywhere;
}
.trouble-detail-actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
}
.trouble-detail-btn {
    flex-shrink: 0;
    background: var(--surface-3);
    border: 1px solid var(--border);
    color: var(--text);
    font-size: var(--text-caption);
    line-height: 1;
    cursor: pointer;
    padding: var(--space-1) var(--space-2);
    border-radius: var(--radius-sm);
}
.trouble-detail-btn:hover { border-color: var(--border-strong); }
.trouble-detail-btn:disabled { opacity: 0.5; cursor: default; }
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

/* Crashlytics slot (plan 110, Stage 2). Hidden unless the rail is in .td-mode-cd,
   where it replaces BOTH the trouble head and the trouble body — the Crashlytics
   detail brings its own .cd-header with Back / Copy / Create issue. Deliberately
   NOT reusing .crashlytics-detail: that class is position:absolute + inset:0 for
   the full-area panel flow and would re-cover the feed. */
.trouble-detail-cd {
    display: none;
    flex: 1;
    min-height: 0;
    flex-direction: column;
    overflow: hidden;
}
.trouble-detail.td-mode-cd .trouble-detail-head,
.trouble-detail.td-mode-cd .trouble-detail-body { display: none; }
.trouble-detail.td-mode-cd .trouble-detail-cd { display: flex; }

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

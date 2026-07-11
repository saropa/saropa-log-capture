/**
 * Styles for the Trouble Mode Signals band.
 *
 * A compact band of the current log's top recurring signals, between the severity chart and the
 * feed. Hidden outside Trouble Mode (CSS gate on body.slc-trouble-active) and hidden by the band
 * script when the log has no signals, so it only appears when it has content. Mirrors the head +
 * collapse chrome the severity chart uses so the two read as one dashboard.
 */
export function getTroubleSignalsStyles(): string {
    return /* css */ `
/* ===================================================================
   Trouble Mode — Signals band (current log's top signals, above the feed)
   =================================================================== */
.trouble-signals {
    flex-shrink: 0;
    padding: var(--space-2) var(--space-3);
    background: var(--surface-2);
    border-bottom: 1px solid var(--border);
}
body:not(.slc-trouble-active) .trouble-signals { display: none !important; }
.trouble-signals.u-hidden { display: none !important; }

/* Caret + title left, signal count right. align-items:center so the caret sits on the title's line. */
.trouble-signals-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    font-size: var(--text-eyebrow);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--muted);
    margin-bottom: var(--space-1);
}
.trouble-signals-head .tsg-head-left { display: flex; align-items: center; gap: var(--space-2); min-width: 0; }
.trouble-signals .tsg-count { font-variant-numeric: tabular-nums; text-transform: none; }

/* Collapse control — mirror of the severity chart's caret: one glyph rotated by CSS, sized off
   the type scale so it reads as a control. Letter-spacing cancelled so the glyph stays centered. */
.trouble-signals .tsg-toggle {
    background: none;
    border: none;
    padding: 0 2px;
    margin: 0;
    color: var(--muted);
    cursor: pointer;
    line-height: 1;
    font-size: var(--text-h2);
    letter-spacing: normal;
    transition: transform 0.15s ease;
}
.trouble-signals .tsg-toggle:hover { color: var(--fg); }
.trouble-signals.tsg-collapsed .tsg-toggle { transform: rotate(-90deg); }
.trouble-signals .tsg-head-title { cursor: pointer; user-select: none; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.trouble-signals .tsg-head-title:hover { color: var(--fg); }
/* Collapsed keeps the head (the count is the point of a collapsed band); only the rows drop. */
.trouble-signals.tsg-collapsed .trouble-signals-rows,
.trouble-signals.tsg-collapsed .trouble-signals-more { display: none; }
.trouble-signals.tsg-collapsed .trouble-signals-head { margin-bottom: 0; }

.trouble-signals-rows { display: flex; flex-direction: column; gap: 2px; }
.trouble-signals-more { margin-top: var(--space-1); }
.trouble-signals-more.u-hidden { display: none; }
.tsg-more-btn {
    background: none;
    border: none;
    color: var(--vscode-textLink-foreground);
    cursor: pointer;
    font-family: var(--vscode-font-family);
    font-size: var(--text-caption);
    padding: var(--space-1) var(--space-2);
}
.tsg-more-btn:hover { text-decoration: underline; }

.tsg-row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    width: 100%;
    text-align: left;
    background: none;
    border: none;
    color: var(--text);
    font-family: var(--vscode-font-family);
    font-size: var(--text-caption);
    padding: var(--space-1) var(--space-2);
    border-radius: var(--radius-sm);
}
/* Only jumpable rows are clickable (they point at a log line); the rest are inert cues. */
.tsg-row.tsg-jumpable { cursor: pointer; }
.tsg-row.tsg-jumpable:hover { background: var(--vscode-list-hoverBackground, var(--surface-3)); }
.tsg-label { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tsg-row .tsg-count { flex-shrink: 0; color: var(--muted); font-variant-numeric: tabular-nums; }
`;
}

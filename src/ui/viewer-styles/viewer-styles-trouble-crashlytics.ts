/**
 * Styles for the Trouble Mode Crashlytics band (plan Trouble Mode dashboard, Stage 5).
 *
 * A compact band of the top cached crash issues, between the severity chart and the
 * feed. Hidden outside Trouble Mode (CSS gate on body.slc-trouble-active) and hidden
 * by the band script when the cache is cold, so it only appears when it has content.
 * Colors come from the design tokens; the severity dot matches the feed/chart accents.
 */
export function getTroubleCrashlyticsStyles(): string {
    return /* css */ `
/* ===================================================================
   Trouble Mode — Crashlytics band (top cached issues, above the feed)
   =================================================================== */
.trouble-crashlytics {
    flex-shrink: 0;
    padding: var(--space-2) var(--space-3);
    background: var(--surface-2);
    border-bottom: 1px solid var(--border);
}
/* Never show outside Trouble Mode, regardless of the script's row state. */
body:not(.slc-trouble-active) .trouble-crashlytics { display: none !important; }
.trouble-crashlytics.u-hidden { display: none !important; }

/* Collapse caret + title left, cache age right (plan 110, Stage 5). The rows are read from
   disk and never refetched here, so an unlabeled list would imply a liveness the band does
   not have. align-items:center (not baseline) so the caret button sits on the title's line. */
.trouble-crashlytics-head {
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
/* Caret + title travel together on the left; space-between keeps the age on the right. */
.trouble-crashlytics-head .tcx-head-left {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-width: 0;
}
.trouble-crashlytics .tcx-fresh { font-variant-numeric: tabular-nums; text-transform: none; }

/* Collapse control — mirror of the severity chart's .tc-toggle: one caret glyph rotated by
   CSS (no script-swapped text a translator would own), sized off the type scale so it reads
   as a control rather than a stray pixel. Letter-spacing cancelled so the glyph centers. */
.trouble-crashlytics .tcx-toggle {
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
.trouble-crashlytics .tcx-toggle:hover { color: var(--fg); }
.trouble-crashlytics.tcx-collapsed .tcx-toggle { transform: rotate(-90deg); }
/* The title doubles as a larger collapse target; it takes the caret's pointer + hover. */
.trouble-crashlytics .tcx-head-title { cursor: pointer; user-select: none; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.trouble-crashlytics .tcx-head-title:hover { color: var(--fg); }
/* Collapsed keeps the head (the title + cache age are the point of a collapsed band, and a
   band that vanished would leave nothing to click to bring it back) and drops only the rows. */
.trouble-crashlytics.tcx-collapsed .trouble-crashlytics-rows,
.trouble-crashlytics.tcx-collapsed .trouble-crashlytics-more { display: none; }
.trouble-crashlytics.tcx-collapsed .trouble-crashlytics-head { margin-bottom: 0; }

/* Five rows, no scroller: the band is a triage cue, and the height it used to reclaim
   from the feed bought a list the user could not scan anyway. Overflow goes to the
   "All N issues" link, which opens the real Crashlytics panel. */
.trouble-crashlytics-rows {
    display: flex;
    flex-direction: column;
    gap: 2px;
}
.trouble-crashlytics-more { margin-top: var(--space-1); }
.trouble-crashlytics-more.u-hidden { display: none; }
.tcx-more-btn {
    background: none;
    border: none;
    color: var(--vscode-textLink-foreground);
    cursor: pointer;
    font-family: var(--vscode-font-family);
    font-size: var(--text-caption);
    padding: var(--space-1) var(--space-2);
}
.tcx-more-btn:hover { text-decoration: underline; }

.tcx-row {
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
    cursor: pointer;
}
.tcx-row:hover { background: var(--vscode-list-hoverBackground, var(--surface-3)); }
/* Wayfinding: the issue whose detail is open in the side rail. Cleared on rail close. */
.tcx-row.tcx-selected {
    background: var(--vscode-list-activeSelectionBackground, var(--surface-3));
    color: var(--vscode-list-activeSelectionForeground, var(--text));
}

.tcx-sev {
    flex-shrink: 0;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--accent-info);
}
.tcx-sev.tcx-crash { background: var(--accent-critical); }
.tcx-sev.tcx-anr { background: var(--accent-high); }
.tcx-sev.tcx-nonfatal { background: var(--accent-warning); }

.tcx-title {
    flex: 1;
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.tcx-counts {
    flex-shrink: 0;
    color: var(--muted);
    font-variant-numeric: tabular-nums;
}
`;
}

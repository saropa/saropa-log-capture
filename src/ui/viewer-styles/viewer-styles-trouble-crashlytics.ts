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

.trouble-crashlytics-head {
    font-size: var(--text-eyebrow);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--muted);
    margin-bottom: var(--space-1);
}
.trouble-crashlytics-rows {
    display: flex;
    flex-direction: column;
    gap: 2px;
    max-height: 132px;
    overflow-y: auto;
}

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

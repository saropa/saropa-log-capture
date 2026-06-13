/**
 * Signal panel CSS — list-row interactivity and the secondary controls that sit around the lists:
 * severity stripes, trend arrows, jump/detail affordances, time-window & sort chips, inline evidence
 * preview, the scroll-lock pulse, and the filter-suggestions rows.
 *
 * Split out of viewer-styles-signal-sections.ts to keep each file under the 300-line limit; the row
 * layout, hero, and section scaffolding stay in viewer-styles-signal-sections.ts. Concatenated after
 * it by getSignalPanelStyles() so cascade order is unchanged.
 */

/** Return CSS for signal-list interactivity, chips, evidence/detail, pulse, and suggestions. */
export function getSignalListStyles(): string {
    return /* css */ `

/* Signal trend rows — clickable to open the most recent matching session */
.signal-signal-trend-row { cursor: pointer; border-radius: 3px; }
.signal-signal-trend-row:hover { background: var(--vscode-list-hoverBackground); }
/* Severity indicators: critical gets a red left border, high gets orange */
.signal-sev-critical { border-left: 3px solid var(--vscode-errorForeground, #f44); }
.signal-sev-high { border-left: 3px solid var(--vscode-editorWarning-foreground, #fa4); }
/* Recurring badge — small ↻ marker next to the icon */
.signal-recurring-badge { font-size: 10px; opacity: 0.7; margin: 0 1px; }
/* Trend arrows — ↑ increasing (red), ↓ decreasing (green), — stable (muted) */
.signal-trend-up { font-size: 10px; color: var(--vscode-editorError-foreground, #f44); margin: 0 1px; }
.signal-trend-down { font-size: 10px; color: var(--vscode-testing-iconPassed, #4a4); margin: 0 1px; }
.signal-trend-stable { font-size: 10px; opacity: 0.5; margin: 0 1px; }
/* Jumpable signal rows — cursor pointer and hover highlight to indicate clickability */
.signal-jumpable { cursor: pointer; }
.signal-jumpable:hover { background: var(--vscode-list-hoverBackground, rgba(255,255,255,0.04)); }

/* Fu7: time-window filter chips. Compact row of buttons above the signals list — the active
   chip gets the editor-foreground border so it reads as pressed without needing a fill change. */
.signal-tw-filter {
    display: flex;
    gap: 4px;
    margin: 4px 0 6px;
    flex-wrap: wrap;
}
/* Fu5 sort toggle sits just under the time-window chips, sharing the chip style. */
.signal-sort-toggle {
    display: flex;
    gap: 4px;
    margin: 0 0 6px;
}
.signal-tw-chip {
    background: transparent;
    color: var(--vscode-foreground);
    border: 1px solid var(--vscode-panel-border);
    border-radius: 10px;
    padding: 2px 8px;
    font-size: 11px;
    cursor: pointer;
    line-height: 1.4;
}
.signal-tw-chip:hover {
    background: var(--vscode-list-hoverBackground, rgba(255,255,255,0.04));
}
.signal-tw-chip-active {
    border-color: var(--vscode-focusBorder, var(--vscode-textLink-foreground, #3794ff));
    background: var(--vscode-list-activeSelectionBackground, transparent);
    color: var(--vscode-list-activeSelectionForeground, var(--vscode-foreground));
}

/* Fu3: inline evidence preview under a signal title. Three compact lines of raw log text so the
   user can verify what the signal is pointing at without clicking through. Width is constrained
   so long lines truncate rather than push the meta column out of the row. */
.signal-evidence-preview { width: 100%; margin-top: 3px; padding-left: 18px; font-size: 11px; opacity: 0.75; line-height: 1.35; }
.signal-evidence-line { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--vscode-descriptionForeground, var(--vscode-foreground)); }
/* Force the row to wrap so the preview drops below the icon/meta cells instead of breaking flex. */
.signal-in-log-row { flex-wrap: wrap; }

/* Non-jumpable in-log signal rows that carry a detail (e.g. "Drift Advisor issues") are clickable
   to reveal that detail inline — same pointer/hover affordance as jumpable rows so the row reads as
   interactive even though there is no log line to scroll to. */
.signal-detail-toggle { cursor: pointer; }
.signal-detail-toggle:hover { background: var(--vscode-list-hoverBackground, rgba(255,255,255,0.04)); }
/* Inline detail body, full-width so it drops below the wrapped row rather than squeezing the meta
   column. pre-wrap keeps multi-part summaries (e.g. "1 error, 2 warnings") readable. */
.signal-detail-body { width: 100%; margin-top: 3px; padding-left: 18px; font-size: 11px; opacity: 0.85; line-height: 1.4; white-space: pre-wrap; color: var(--vscode-descriptionForeground, var(--vscode-foreground)); }

/* Fu2: scroll-lock pulse. Brief highlight on lines around the jump target so the eye lands on
   the right place. Keyframes fade in then out so the cue is clearly transient — no leftover
   visual debt. Cleanup is by JS class-remove on animationend (see part-d). */
@keyframes saropaLinePulse {
    0%   { background-color: transparent; }
    25%  { background-color: var(--vscode-editor-findMatchHighlightBackground, rgba(234, 179, 8, 0.3)); }
    100% { background-color: transparent; }
}
.line-pulse {
    animation: saropaLinePulse 900ms ease-in-out 1;
}

/* Plan 053-A: filter-suggestions section inside Insights panel. Rows stack the pattern + impact,
   sample line, and Accept/Reject buttons. Compact size matches the existing signal-env-row
   density so the section doesn't dominate the panel even when several suggestions are pending. */
.signal-suggestions-list { font-size: 12px; }
.signal-suggestion-row {
    border: 1px solid var(--vscode-panel-border);
    border-radius: 4px;
    padding: 6px 8px;
    margin-bottom: 6px;
    background: var(--vscode-editor-background, transparent);
}
.signal-suggestion-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 6px;
    margin-bottom: 2px;
}
.signal-suggestion-pattern {
    font-family: var(--vscode-editor-font-family, monospace);
    font-size: 11px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
    flex: 1;
}
.signal-suggestion-impact {
    color: var(--vscode-descriptionForeground);
    white-space: nowrap;
    font-size: 11px;
}
.signal-suggestion-sample {
    color: var(--vscode-descriptionForeground);
    font-size: 11px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    margin-bottom: 4px;
    opacity: 0.85;
}
.signal-suggestion-actions {
    display: flex;
    gap: 6px;
}
.signal-suggestion-accept,
.signal-suggestion-reject {
    background: transparent;
    color: var(--vscode-foreground);
    border: 1px solid var(--vscode-panel-border);
    border-radius: 3px;
    padding: 2px 10px;
    font-size: 11px;
    cursor: pointer;
}
.signal-suggestion-accept:hover {
    background: var(--vscode-button-secondaryHoverBackground, var(--vscode-list-hoverBackground, rgba(255,255,255,0.04)));
    border-color: var(--vscode-focusBorder, var(--vscode-textLink-foreground, #3794ff));
}
.signal-suggestion-reject:hover {
    background: var(--vscode-list-hoverBackground, rgba(255,255,255,0.04));
}
`;
}

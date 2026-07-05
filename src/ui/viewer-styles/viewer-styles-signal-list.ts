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
.signal-signal-trend-row { cursor: pointer; border-radius: var(--radius-sm); }
.signal-signal-trend-row:hover { background: var(--vscode-list-hoverBackground); }
/* Severity indicators: critical gets a red accent, high gets orange. Painted as an INSET shadow
   inside the row's left padding (not a border) so the accent takes zero layout width — a critical
   row and a plain row keep their label text at the exact same x. A real border-left widened only the
   severity rows and jogged their text right, which read as the "inconsistent indenting" the panel had. */
.signal-sev-critical { box-shadow: inset 3px 0 0 0 var(--vscode-errorForeground, var(--accent-critical)); }
.signal-sev-high { box-shadow: inset 3px 0 0 0 var(--vscode-editorWarning-foreground, var(--accent-high)); }
/* Recurring badge — small ↻ marker next to the icon */
.signal-recurring-badge { font-size: 10px; opacity: 0.7; margin: 0 1px; }
/* Trend arrows — ↑ increasing (red), ↓ decreasing (green), — stable (muted) */
.signal-trend-up { font-size: 10px; color: var(--vscode-editorError-foreground, var(--accent-critical)); margin: 0 1px; }
.signal-trend-down { font-size: 10px; color: var(--vscode-testing-iconPassed, var(--status-good)); margin: 0 1px; }
.signal-trend-stable { font-size: 10px; opacity: 0.5; margin: 0 1px; }
/* Jumpable signal rows — cursor pointer and hover highlight to indicate clickability */
.signal-jumpable { cursor: pointer; }
.signal-jumpable:hover { background: var(--vscode-list-hoverBackground, color-mix(in srgb, var(--text) 4%, transparent)); }

/* Fu7: time-window filter chips. Compact row of buttons above the signals list — the active
   chip gets the editor-foreground border so it reads as pressed without needing a fill change. */
.signal-tw-filter {
    display: flex;
    gap: var(--space-1);
    margin: var(--space-1) 0 6px;
    flex-wrap: wrap;
}
/* Fu5 sort toggle sits just under the time-window chips, sharing the chip style. */
.signal-sort-toggle {
    display: flex;
    gap: var(--space-1);
    margin: 0 0 6px;
}
.signal-tw-chip {
    background: transparent;
    color: var(--vscode-foreground);
    border: 1px solid var(--vscode-panel-border);
    border-radius: 10px;
    padding: 2px var(--space-2);
    font-size: var(--text-caption);
    cursor: pointer;
    line-height: 1.4;
}
.signal-tw-chip:hover {
    background: var(--vscode-list-hoverBackground, color-mix(in srgb, var(--text) 4%, transparent));
}
.signal-tw-chip-active {
    border-color: var(--vscode-focusBorder, var(--vscode-textLink-foreground, var(--link)));
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
.signal-detail-toggle:hover { background: var(--vscode-list-hoverBackground, color-mix(in srgb, var(--text) 4%, transparent)); }
/* Inline detail body, full-width so it drops below the wrapped row rather than squeezing the meta
   column. pre-wrap keeps multi-part summaries (e.g. "1 error, 2 warnings") readable. */
.signal-detail-body { width: 100%; margin-top: 3px; padding-left: 18px; font-size: 11px; opacity: 0.85; line-height: 1.4; white-space: pre-wrap; color: var(--vscode-descriptionForeground, var(--vscode-foreground)); }

/* Fu2: scroll-lock pulse. Brief highlight on lines around the jump target so the eye lands on
   the right place. Keyframes fade in then out so the cue is clearly transient — no leftover
   visual debt. Cleanup is by JS class-remove on animationend (see part-d). */
@keyframes saropaLinePulse {
    0%   { background-color: transparent; }
    25%  { background-color: var(--vscode-editor-findMatchHighlightBackground, color-mix(in srgb, var(--accent-warning) 30%, transparent)); }
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
    border-radius: var(--radius-sm);
    padding: 6px var(--space-2);
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
    font-size: var(--text-caption);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
    flex: 1;
}
.signal-suggestion-impact {
    color: var(--vscode-descriptionForeground);
    white-space: nowrap;
    font-size: var(--text-caption);
}
.signal-suggestion-sample {
    color: var(--vscode-descriptionForeground);
    font-size: var(--text-caption);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    margin-bottom: var(--space-1);
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
    border-radius: var(--radius-sm);
    padding: 2px 10px;
    font-size: var(--text-caption);
    cursor: pointer;
}
.signal-suggestion-accept:hover {
    background: var(--vscode-button-secondaryHoverBackground, var(--vscode-list-hoverBackground, color-mix(in srgb, var(--text) 4%, transparent)));
    border-color: var(--vscode-focusBorder, var(--vscode-textLink-foreground, var(--link)));
}
.signal-suggestion-reject:hover {
    background: var(--vscode-list-hoverBackground, color-mix(in srgb, var(--text) 4%, transparent));
}

/* ============================================================================
   Row formatting: one shared indent rail, real-width ellipsis, click affordance.
   ============================================================================ */

/* Single left rail. Every signal row, narrative subtitle, and empty state starts its emoji/icon at
   the same x (var(--space-2)); the severity accent is drawn INSIDE this padding as an inset shadow
   (see .signal-sev-*) so nothing shifts. .signal-margin-emoji is a fixed-width cell so the label text
   after the emoji also aligns column-to-column instead of drifting with each emoji's glyph width. */
.signal-trend-row,
.signal-in-log-row {
    padding-left: var(--space-2);
    padding-right: var(--space-1);
    border-radius: var(--radius-sm);
}
.signal-narrative-subtitle,
.signal-hotfiles-empty {
    padding-left: var(--space-2);
}
.signal-margin-emoji {
    display: inline-block;
    width: 1.3em;
    margin-right: 4px;
    text-align: center;
    flex-shrink: 0;
}

/* Real-width truncation: the label cell truncates with an ellipsis at the actual column edge rather
   than at a fixed character count. The row scripts used to slice labels at 50–60 chars, which cut
   text off well before the panel's real width (and left "..." mid-column on a wide panel). min-width:0
   (set in viewer-styles-signal-sections.ts) lets the flex item shrink so the ellipsis can trigger. */
.signal-trend-row > span:first-child,
.signal-in-log-row > span:first-child {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

/* Click affordance: a trailing chevron marks a row as openable. Trend rows always open a session;
   in-log rows open only when jumpable (a log line to scroll to) or a detail-toggle (inline detail).
   Rows with neither get NO chevron and keep the default cursor, so "which rows do something" reads
   at a glance instead of by trial-and-error clicking. The chevron rests dim and brightens on hover. */
.signal-trend-row::after,
.signal-in-log-row.signal-jumpable::after,
.signal-in-log-row.signal-detail-toggle::after {
    content: "\\203A";
    flex: 0 0 auto;
    align-self: center;
    margin-left: var(--space-1);
    font-size: 13px;
    line-height: 1;
    opacity: 0.3;
    color: var(--vscode-descriptionForeground);
    transition: opacity 0.12s ease, transform 0.12s ease;
}
.signal-trend-row:hover::after,
.signal-in-log-row.signal-jumpable:hover::after,
.signal-in-log-row.signal-detail-toggle:hover::after { opacity: 0.85; }
/* Detail-toggle rows rotate the chevron down while their inline detail is open. */
.signal-in-log-row.signal-detail-toggle.signal-detail-open::after { transform: rotate(90deg); opacity: 0.85; }

/* Slow-open feedback. Opening a cross-session signal loads that session's log file on the host, which
   can take a moment; without a cue the click looks dead. The clicked row shimmers and a slim
   indeterminate bar shows under the panel header until the host posts scrollToSignal (or a safety
   timeout clears it). No new async surface — just an acknowledgement that the click registered. */
@keyframes signalRowShimmer {
    0%   { background-position: -180px 0; }
    100% { background-position: calc(180px + 100%) 0; }
}
.signal-row-loading {
    background-image: linear-gradient(90deg, transparent 0%, var(--vscode-list-hoverBackground, color-mix(in srgb, var(--text) 8%, transparent)) 50%, transparent 100%);
    background-size: 180px 100%;
    background-repeat: no-repeat;
    animation: signalRowShimmer 1.1s linear infinite;
}
.signal-loading-bar {
    height: 2px;
    flex-shrink: 0;
    overflow: hidden;
    background: transparent;
}
.signal-loading-bar > span {
    display: block;
    height: 100%;
    width: 40%;
    background: var(--vscode-progressBar-background, var(--vscode-textLink-foreground, var(--link)));
    animation: signalLoadingSlide 1.1s ease-in-out infinite;
}
@keyframes signalLoadingSlide {
    0%   { margin-left: -40%; }
    100% { margin-left: 100%; }
}
`;
}

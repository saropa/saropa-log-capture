/**
 * DB_14: CSS for the Signals (root-cause hypotheses) strip in the log viewer webview.
 *
 * Visibility is controlled by the toolbar signals icon; the strip is a clickable index
 * of detected signals. Clicking a signal opens a report webview panel with full details.
 */
export function getRootCauseHypothesesStyles(): string {
    return /* css */ `
.root-cause-hypotheses {
    flex-shrink: 0;
    margin: 0 0 var(--space-1) 0;
    padding: 6px 10px 8px;
    border-radius: 4px;
    border: 1px solid var(--vscode-widget-border, var(--vscode-panel-border));
    background: var(--vscode-editorWidget-background, var(--vscode-sideBar-background));
    color: var(--vscode-editorWidget-foreground, var(--vscode-foreground));
    font-size: 12px;
    line-height: 1.35;
    max-height: 42vh;
    overflow: auto;
    transition: max-height 0.25s ease-out, opacity 0.25s ease-out,
                padding 0.25s ease-out, margin 0.25s ease-out,
                border-color 0.25s ease-out;
}
/* Collapsed by filter drawer mutual exclusion */
.root-cause-hypotheses.signals-drawer-hidden {
    max-height: 0 !important;
    opacity: 0;
    overflow: hidden;
    padding-top: 0;
    padding-bottom: 0;
    margin: 0;
    border-color: transparent;
}
.root-cause-hypotheses-list {
    margin: 0;
    /* Numbered via a CSS counter rather than <ol> bullets: each row is a flex container with optional
       emoji/badge children, so a counter ::before sits as the first flex item and stays column-aligned. */
    counter-reset: rch-item;
    list-style: none;
    padding-left: 0;
}
.root-cause-hypotheses-list li {
    margin: var(--space-1) 0;
    display: flex;
    align-items: baseline;
    gap: var(--space-1);
}
/* Leading number. Fixed min-width + right-align keeps 1..9..10 in a tidy column. */
.root-cause-hypotheses-list li::before {
    counter-increment: rch-item;
    content: counter(rch-item) ".";
    flex-shrink: 0;
    min-width: 1.4em;
    text-align: right;
    opacity: 0.7;
    color: var(--vscode-descriptionForeground);
    font-variant-numeric: tabular-nums;
}
/* Hypothesis text. Truncates to one line with an ellipsis by default so long hints keep the strip
   compact; clicking toggles .rch-expanded on the row to wrap the full text (handler in the embed
   script). flex:1 + min-width:0 lets the ellipsis trigger at the real column edge. */
.rch-hyp-text {
    border: none;
    background: transparent;
    font: inherit;
    color: inherit;
    cursor: pointer;
    padding: 0;
    text-align: left;
    appearance: none;
    flex: 1;
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.rch-hyp-text:hover {
    color: var(--link);
    text-decoration: underline;
}
.root-cause-hypotheses-list li.rch-expanded .rch-hyp-text {
    white-space: normal;
    word-break: break-word;
    overflow: visible;
    text-overflow: clip;
}
/* Open-report affordance, split off the text so clicking the text expands instead of navigating.
   Hover-reveal like dismiss so the strip stays clean; icon-only with a title/aria-label. */
.rch-report-btn {
    border: none;
    background: transparent;
    color: var(--vscode-descriptionForeground);
    cursor: pointer;
    font-size: 12px;
    padding: 1px 4px;
    border-radius: 2px;
    flex-shrink: 0;
    align-self: flex-start;
    opacity: 0;
    transition: opacity 0.15s;
}
/* Reveal on row hover OR keyboard focus — opacity:0 alone leaves the button focusable but invisible,
   so a keyboard/touch user could tab to an unseen control. focus-within covers the button itself. */
.root-cause-hypotheses-list li:hover .rch-report-btn,
.root-cause-hypotheses-list li:focus-within .rch-report-btn,
.rch-report-btn:focus {
    opacity: 1;
}
.rch-report-btn:hover {
    color: var(--link);
    background: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31));
}
.rch-dismiss-btn {
    border: none;
    background: transparent;
    color: var(--vscode-descriptionForeground);
    cursor: pointer;
    font-size: 12px;
    padding: 1px 4px;
    margin-left: 2px;
    border-radius: 2px;
    flex-shrink: 0;
    align-self: flex-start;
    opacity: 0;
    transition: opacity 0.15s;
}
/* Same hover-or-focus reveal as the report icon so the dismiss control is reachable without a mouse. */
.root-cause-hypotheses-list li:hover .rch-dismiss-btn,
.root-cause-hypotheses-list li:focus-within .rch-dismiss-btn,
.rch-dismiss-btn:focus {
    opacity: 1;
}
.rch-dismiss-btn:hover {
    /* Destructive dismiss = fail/red role; same token as every panel's close button. */
    color: var(--status-bad);
    background: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31));
}
.rch-restore-btn {
    display: block;
    margin: 6px 0 0;
    padding: 0;
    border: none;
    background: transparent;
    color: var(--vscode-descriptionForeground);
    font-size: 11px;
    cursor: pointer;
    appearance: none;
}
.rch-restore-btn:hover {
    color: var(--link);
    text-decoration: underline;
}
.root-cause-hyp-conf {
    display: inline-block;
    flex-shrink: 0;
    font-size: 12px;
    line-height: 1;
    opacity: 0.92;
    cursor: help;
}
/* Brief toast shown after dismiss */
.rch-toast {
    display: inline-block;
    margin-left: var(--space-2);
    font-size: 11px;
    /* Dismiss confirmation reads as a success signal — bind to the status-good
       token so it tracks the host's pass/success color, not a baked green. */
    color: var(--status-good);
    animation: rch-toast-fade 1.5s ease-out forwards;
}
/* Cross-session trend badge: small ↻N indicator between confidence emoji and signal text */
.rch-trend-badge {
    font-size: 10px;
    color: var(--vscode-descriptionForeground);
    opacity: 0.75;
    white-space: nowrap;
    flex-shrink: 0;
    font-variant-numeric: tabular-nums;
}
@keyframes rch-toast-fade {
    0%, 60% { opacity: 1; }
    100% { opacity: 0; }
}
@media (prefers-reduced-motion: reduce) {
    .root-cause-hypotheses { transition: none !important; }
    .rch-dismiss-btn, .rch-report-btn { transition: none !important; }
    .rch-toast { animation: none !important; }
}
`;
}

/**
 * Styles for the SQL query history dashboard strip (plan **DB_18 Phase 2**): stat cards + bar chart.
 * Separate module so `viewer-styles-sql-query-history.ts` stays under the file-length limit.
 *
 * This is a dashboard-class surface, so it follows the Saropa Dashboard Style Guide: the shared
 * design tokens (viewer-styles-tokens.ts), a 3px brand strip on the strip header, carded KPI
 * stats, a brand-anchored bar chart, and severity-token left borders on findings. The monospace
 * log console is exempt from that guide; this panel is not — it is a true dashboard.
 */

export function getSqlQueryHistoryDashboardStyles(): string {
    return /* css */ `

/* ===================================================================
   SQL Query History Dashboard (KPI cards + top-queries bar chart)
   The signature 3px brand strip marks the surface as Saropa; the rest
   stays host-theme-bound through the design tokens.
   =================================================================== */
.sql-qh-dashboard {
    position: relative;
    padding: var(--space-3) var(--space-3) var(--space-2);
    border-bottom: 1px solid var(--border);
}
/* Brand strip: the one fixed-color accent on the surface (guide §5.1). Fades from brand into
   the host foreground so it reads as Saropa without fighting the active theme. */
.sql-qh-dashboard::before {
    content: "";
    position: absolute;
    inset: 0 0 auto 0;
    height: 3px;
    background: linear-gradient(90deg, var(--brand), var(--brand-2) 55%, transparent 100%);
}

.sql-qh-stats {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
}

/* KPI card (guide §5.2): raised surface, hairline border, large tabular number over an
   uppercase muted label. Equal-share columns so 2-4 cards fill the strip without scroll. */
.sql-qh-stat {
    flex: 1 1 64px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    background: var(--surface-2);
    box-shadow: var(--shadow);
}

.sql-qh-stat-val {
    font-size: var(--text-h2);
    line-height: 1.1;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    color: var(--text);
}

.sql-qh-stat-label {
    font-size: var(--text-eyebrow);
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--muted);
    text-align: center;
}

.sql-qh-chart {
    margin-top: var(--space-3);
}

/* Shared eyebrow style for the chart / issues / lint section headers. */
.sql-qh-chart-title,
.sql-qh-issues-title,
.sql-qh-lint-title {
    font-size: var(--text-eyebrow);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--muted);
    margin-bottom: var(--space-1);
}

/* label | bar track | count — the track flexes so bars share a common right-aligned scale. */
.sql-qh-chart-row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin-bottom: 3px;
}

.sql-qh-chart-label {
    flex: 0 0 40%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: var(--text-caption);
    font-family: var(--vscode-editor-font-family, monospace);
    color: var(--text);
}

.sql-qh-chart-track {
    flex: 1 1 auto;
    height: 10px;
    background: var(--surface-3);
    border-radius: var(--radius-pill);
    overflow: hidden;
}

/* Bars anchor on the brand accent so the chart reads as one branded series (guide §3.10/§5.10),
   not a raw host chart color. */
.sql-qh-chart-bar {
    display: block;
    height: 100%;
    background: linear-gradient(90deg, var(--brand-2), var(--brand));
    border-radius: var(--radius-pill);
}

.sql-qh-chart-num {
    flex: 0 0 auto;
    min-width: 32px;
    text-align: right;
    font-size: var(--text-caption);
    font-variant-numeric: tabular-nums;
    color: var(--muted);
}

/* --- Drift Advisor issues sub-section (index suggestions + anomalies) --- */
.sql-qh-issues {
    margin-top: var(--space-3);
}

/* A colored left border carries severity at a glance, bound to the host's diagnostic tokens
   (guide §3.5) so it matches the editor's own squiggle colors. */
.sql-qh-issue {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-1) var(--space-2);
    margin-bottom: 2px;
    border-left: 2px solid var(--accent-info);
    border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
    font-size: var(--text-caption);
}

.sql-qh-issue-warning {
    border-left-color: var(--accent-warning);
}

.sql-qh-issue-info {
    border-left-color: var(--accent-info);
}

/* Source attribution chip: the active-brand chip treatment (guide §5.6) so a row reads as the
   sibling tool's finding (Drift Advisor / Saropa Lints), tinted with the brand glow. */
.sql-qh-src-badge {
    flex: 0 0 auto;
    font-size: var(--text-eyebrow);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    padding: 0 6px;
    border-radius: var(--radius-pill);
    line-height: 16px;
    background: var(--brand-glow);
    color: var(--brand-2);
}

.sql-qh-issue-loc {
    flex: 0 0 auto;
    font-family: var(--vscode-editor-font-family, monospace);
    color: var(--text);
    font-weight: 600;
}

.sql-qh-issue-msg {
    flex: 1 1 auto;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--muted);
}

.sql-qh-issue-fix {
    flex: 0 0 auto;
    background: none;
    border: none;
    color: var(--link);
    cursor: pointer;
    padding: 0 2px;
}

.sql-qh-issue-fix:hover {
    color: var(--vscode-textLink-activeForeground, var(--brand));
}

/* --- Async loading / error states for the Drift enrichment fetches (issues + lint) --- */
/* Caption tier matches the issue rows; loading pulses to read as in-progress, error uses the
   critical token so a failed fetch is visibly distinct from an empty (hidden) section. */
.sql-qh-async {
    font-size: var(--text-caption);
    padding: var(--space-1) var(--space-2);
}

.sql-qh-async-loading {
    color: var(--muted);
    animation: sql-qh-async-pulse 1.5s ease-in-out infinite;
}

.sql-qh-async-error {
    color: var(--accent-critical);
}

.sql-qh-async-detail {
    opacity: 0.7;
}

@keyframes sql-qh-async-pulse { 0%, 100% { opacity: 0.7; } 50% { opacity: 0.3; } }

/* --- Saropa Lints static-code section (Drift-rule violations + enable-pack advice) --- */
.sql-qh-lint {
    margin-top: var(--space-3);
}

/* The advice is a call-to-action, so it gets a brand-tinted notification card rather than a row. */
.sql-qh-lint-advice {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2);
    margin-bottom: var(--space-1);
    border-radius: var(--radius);
    background: var(--brand-glow);
    border: 1px solid var(--border-strong);
}

.sql-qh-lint-advice-msg {
    flex: 1 1 auto;
    font-size: var(--text-caption);
    color: var(--text);
}

/* Primary action (guide §5.4): the single brand-filled button on the surface. */
.sql-qh-lint-enable {
    flex: 0 0 auto;
    background: var(--brand);
    color: #ffffff;
    border: none;
    border-radius: var(--radius);
    padding: var(--space-1) var(--space-3);
    font-size: var(--text-caption);
    font-weight: 600;
    cursor: pointer;
    transition: filter var(--dur-fast) var(--ease);
}

.sql-qh-lint-enable:hover {
    filter: brightness(1.08);
}
`;
}

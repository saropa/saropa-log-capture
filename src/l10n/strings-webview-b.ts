/**
 * English strings for the WEBVIEW (log viewer) — part B (continuation of
 * strings-webview.ts; split to stay under the 300-line file limit). Same
 * two-step path: the host resolves these via getWebviewL10nMap() into the `__VT`
 * map, and the client-side `vt(key, ...args)` helper substitutes `{0}`, `{1}`, …
 * at render time. Keep templates as FULL sentences with `{n}` placeholders.
 *
 * Added by the plan 053 webview-localization sweep (decoration tooltips,
 * context menus / modals / popovers, and secondary panels). Translation is
 * automated at publish (scripts/translate_l10n.py); until then vt() falls back
 * to English, identical to prior behavior.
 */
export const stringsWebviewB: Record<string, string> = {
    // Error-classification badge tooltips (viewer-error-classification.ts).
    'viewer.deco.critical.tooltip': 'Critical Error — hover for details',
    'viewer.deco.critical.label': 'Critical Error',
    'viewer.deco.transient.tooltip': 'Transient Error — hover for details',
    'viewer.deco.transient.label': 'Transient Error',
    'viewer.deco.bug.tooltip': 'Likely Bug — hover for details',
    'viewer.deco.bug.label': 'Likely Bug',

    // Inline render tooltips / labels (viewer-data-helpers-render.ts).
    'viewer.deco.outputChannel': 'Output channel: {0}',
    'viewer.marker.collapsed': '{0} adjacent identical markers collapsed into this one',
    'viewer.deco.identicalLines': '{0} identical lines',
    'viewer.deco.contExpand': 'Click to expand {0} continuation lines',
    'viewer.deco.contCollapse': 'Click to collapse {0} continuation lines',
    'viewer.art.expand': 'Click to expand this ASCII art block ({0} lines)',
    'viewer.art.collapse': 'Click to collapse this ASCII art block',
    'viewer.deco.anr': 'ANR Pattern Detected',
    'viewer.deco.recentErrorContext': 'Recent-error context: not the primary faulting line; tinted because a real error or stack line occurred within 2 seconds above.',

    // Files dialog + footer counter — cumulative cross-session feed (plan 057).
    'viewer.files.counterTooltip': '{0} files in this view — click to list',
    'viewer.files.lineCount': '{0} lines',

    // Meta-filter tooltips (viewer-decorations.ts).
    'viewer.deco.filterByPid': 'Filter by PID {0}',
    'viewer.deco.filterByTid': 'Filter by TID {0}',
    'viewer.deco.filterByTag': 'Filter by tag: {0}',

    // Run separator snip labels (viewer-data-helpers-render-run-separator-snip.ts).
    'viewer.runSeparator.errors': 'Errors',
    'viewer.runSeparator.warnings': 'Warnings',
    'viewer.runSeparator.perf': 'Perf',
    'viewer.runSeparator.info': 'Info',
    'viewer.runSeparator.runLabel': 'Run {0}',

    // N+1 query signal (viewer-data-add-db-detectors.ts).
    'viewer.n1Signal.title': 'Potential N+1 query',
    'viewer.n1Signal.summary': '{0} repeats / {1} arg variants in {2}s',
    'viewer.n1Signal.focusDb': 'Focus DB',
    'viewer.n1Signal.focusDbTitle': 'Show only database-tagged lines',
    'viewer.n1Signal.findFingerprint': 'Find fingerprint',
    'viewer.n1Signal.findFingerprintTitle': 'Search this SQL fingerprint',
    'viewer.n1Signal.staticSources': 'Static sources',
    'viewer.n1Signal.staticSourcesTitle': 'Possible Dart sources (project index; not stack trace)',

    // SQL repeat drilldown (viewer-data-sql-drilldown-ui.ts).
    'viewer.sqlDrilldown.repeatLabel': '{0} × SQL repeated:',
    'viewer.sqlDrilldown.detailsAria': 'SQL repeat details: {0}',
    'viewer.sqlDrilldown.samplesAria': 'SQL repeat samples',
    'viewer.sqlDrilldown.fingerprintLabel': 'Fingerprint',
    'viewer.sqlDrilldown.timeLabel': 'Time',
    'viewer.sqlDrilldown.variantTitle': 'Argument variants (first-seen order, capped)',
    'viewer.sqlDrilldown.moreVariants': '+{0} more distinct arg variant(s)',
    'viewer.sqlDrilldown.staticSources': 'Possible Dart sources (static index, not stack)',

    // DB slow-query burst marker (viewer-data-add-db-marker-apply.ts).
    'viewer.dbMarker.slowQueryBurst': 'Slow query burst',
    'viewer.dbMarker.jumpToLastInBurst': 'Jump to last query in this burst',
    'viewer.dbMarker.jumpToCompletingSlow': 'Jump to completing slow query',

    // Divider / collapse affordances (viewer-data-divider.ts). Leading/trailing
    // spaces and middot separators are load-bearing — they join localized fragments.
    'viewer.affordance.identicalRows.one': '{0} identical row',
    'viewer.affordance.identicalRows.many': '{0} identical rows',
    'viewer.affordance.dedupCollapsedAction': ' collapsed here · click to show',
    'viewer.affordance.dedupExpandedAction': ' revealed · click to hide',
    'viewer.affordance.stackTrace.one': 'stack trace · {0} frame · ',
    'viewer.affordance.stackTrace.many': 'stack trace · {0} frames · ',
    'viewer.affordance.stackCollapseAction': 'click to collapse',
    'viewer.affordance.stackExpandAction': 'click to expand',
    'viewer.affordance.hiddenCount': '{0} hidden',
    'viewer.affordance.gapShowAction': ' · click to show',
    'viewer.affordance.peekRecollapse': 'revealed lines below · click to re-collapse',

    // Async-suspension stack glyph (viewer-data-add-stack-ingest.ts). Keeps the
    // &mdash; HTML entity — it is inserted into the title attribute verbatim.
    'viewer.stackIngest.asyncGapTitle': 'Async suspension &mdash; the call stack jumped microtasks across an await. Click to reveal the original marker.',

    // Highlight / lint / quality badges (viewer-highlight.ts, viewer-lint-badge.ts, viewer-quality-badge.ts).
    'viewer.highlight.tooltip': 'Highlights: {0}',
    'viewer.lintBadge.errors.one': '{0} error',
    'viewer.lintBadge.errors.many': '{0} errors',
    'viewer.lintBadge.warnings.one': '{0} warning',
    'viewer.lintBadge.warnings.many': '{0} warnings',
    'viewer.lintBadge.tooltip': 'Diagnostics: {0}',
    'viewer.qualityBadge.tooltip': '{0}% line coverage',

    // Root-cause hint narrative + controls (viewer-root-cause-hints-script.ts).
    'viewer.rch.explainHeader': 'Log viewer root-cause hypotheses (deterministic heuristics, not verified facts):',
    'viewer.rch.explainSessionId': 'Session id: {0}',
    'viewer.rch.trendBadge.title.one': 'Detected in {0} session',
    'viewer.rch.trendBadge.title.many': 'Detected in {0} sessions',
    'viewer.rch.openReport': 'Open signal report',
    'viewer.rch.dismiss': 'Dismiss signal',
    'viewer.rch.restoreAll': '{0} dismissed — restore all',
    'viewer.rch.signalHidden': 'Signal hidden for this session',

    // Source-tag + SQL-pattern chips (viewer-source-tags-ui.ts, viewer-sql-pattern-tags.ts).
    'viewer.tags.all': 'All',
    'viewer.tags.none': 'None',
    'viewer.tags.showLess': 'Show less',
    'viewer.tags.showAll': 'Show all ({0})',
    'viewer.tags.clickToFilter': 'Click to filter: {0}',
    'viewer.sqlPatterns.commandTypes.one': '{0} command type',
    'viewer.sqlPatterns.commandTypes.many': '{0} command types',
    'viewer.sqlPatterns.hiddenSuffix': ' ({0} hidden)',
    'viewer.sqlPatterns.accordionHidden': '{0} of {1} hidden',
    'viewer.sqlPatterns.accordionTypes.one': '{0} type',
    'viewer.sqlPatterns.accordionTypes.many': '{0} types',

    // Exclusions chip (viewer-exclusions.ts).
    'viewer.exclusions.hiddenCount': '({0} hidden)',
    'viewer.exclusions.labelWithCount': 'Exclusions ({0})',
    'viewer.exclusions.label': 'Exclusions',
    'viewer.exclusions.patternCount.one': '{0} pattern',
    'viewer.exclusions.patternCount.many': '{0} patterns',
    'viewer.exclusions.remove': 'Remove',

    // Context popover — integration sections (viewer-context-popover-integration-sections.ts).
    'viewer.popover.queries': 'Queries ({0})',
    'viewer.contextMenu.copyQuery': 'Copy query',
    'viewer.relatedQueries.title': 'Related Queries ({0})',
    'viewer.popover.close': 'Close',
    'viewer.relatedQueries.empty': 'No related queries found',
    'viewer.relatedQueries.copyAll': 'Copy All',
    'viewer.relatedQueries.copiedToast': 'Copied {0} queries',
    'viewer.relatedRequests.title': 'Related Requests ({0})',
    'viewer.relatedRequests.empty': 'No related requests found',
    'viewer.relatedRequests.copyAll': 'Copy All',
    'viewer.relatedRequests.copiedToast': 'Copied {0} requests',
    'viewer.popover.noLineSelected': 'No line selected',
    'viewer.popover.securityAudit': 'Security / Audit',
    'viewer.popover.securityNote': 'Security events are not shown inline.',
    'viewer.popover.openEventsFile': 'Open events file',
    'viewer.popover.openAuditFile': 'Open audit file',
    'viewer.popover.unknownTime': 'unknown',
    'viewer.popover.contextAt': 'Context at {0} (±{1}s)',
    'viewer.popover.performance': 'Performance',
    'viewer.popover.memoryDelta': 'Memory: {0}MB → {1}MB ({2}MB)',
    'viewer.popover.cpuLoadDelta': 'CPU load: {0} → {1}',
    'viewer.popover.memoryFree': 'Memory: {0}MB free',
    'viewer.popover.cpuLoad': 'CPU load: {0}',
    'viewer.popover.httpHeader.one': 'HTTP ({0} request)',
    'viewer.popover.httpHeader.many': 'HTTP ({0} requests)',
    'viewer.popover.andMore': '... and {0} more',
    'viewer.popover.terminal': 'Terminal',
    'viewer.popover.andMoreLines': '... and {0} more lines',
    'viewer.popover.docker': 'Docker',
    'viewer.popover.events': 'Events',
    'viewer.popover.noIntegrationData': 'No integration data in this time window',
    'viewer.popover.viewFullContext': 'View Full Context',
    'viewer.popover.copy': 'Copy',

    // Context popover — Drift Advisor section (viewer-context-popover-script.ts).
    'viewer.drift.advisor': 'Drift Advisor',
    'viewer.drift.queriesAvg': 'Queries: {0}, avg {1} ms',
    'viewer.drift.slowSuffix': ', {0} slow',
    'viewer.drift.health': 'Health: {0}',
    'viewer.drift.healthOk': 'OK',
    'viewer.drift.healthIssues': 'Issues',
    'viewer.drift.openIn': 'Open in Drift Advisor',

    // Context popover — DB signal (viewer-context-popover-db-signal.ts).
    'viewer.dbSignal.header': 'Database signal',
    'viewer.dbSignal.fingerprint': 'Fingerprint',
    'viewer.dbSignal.seenInSession': 'Seen in session: ×{0}',
    'viewer.dbSignal.avgDuration': 'Avg duration: {0} ms',
    'viewer.dbSignal.maxDuration': 'Max duration: {0} ms',
    'viewer.dbSignal.staticNote': 'Possible sources use the project index (static), not your stack trace.',
    'viewer.dbSignal.findSources': 'Find possible Dart sources…',

    // Edit-line modal (viewer-edit-modal.ts).
    'viewer.editModal.sessionActiveWarning': 'Warning: Debug session is active. Saving may conflict with ongoing writes.',
    'viewer.editModal.title': 'Edit Line {0}',
    'viewer.editModal.closeNoSave': 'Close without saving changes',
    'viewer.editModal.saveTitle': 'Save changes to the log file',
    'viewer.editModal.save': 'Save',
    'viewer.editModal.cancelTitle': 'Discard changes and close',
    'viewer.editModal.cancel': 'Cancel',

    // Context peek modal (viewer-context-modal.ts).
    'viewer.peek.header': 'Context: line {0} ({1} before/after)',
    'viewer.peek.close': 'Close',

    // Quality popover (viewer-quality-popover-script.ts).
    'viewer.quality.title': 'Code Quality',
    'viewer.quality.coverage': 'Coverage',
    'viewer.quality.lines': 'lines',
    'viewer.quality.lint': 'Lint',
    'viewer.quality.lintCounts': '{0} warning(s), {1} error(s)',
    'viewer.quality.lintClean': '0 warnings, 0 errors',
    'viewer.quality.docs': 'Docs',
    'viewer.quality.commentRatio': '{0}% comment ratio',
    'viewer.quality.exportsDocumented': '{0}/{1} exports documented',

    // Git-history popover (viewer-git-history-popover-script.ts).
    'viewer.gitHistory.title': 'Git History',
    'viewer.gitHistory.blameLabel': 'Last change to this line',
    'viewer.gitHistory.recentCommits': 'Recent commits',
    'viewer.gitHistory.none': 'No git history found for this file.',

    // Project state panel client states (viewer-project-state-panel.ts).
    'viewer.projectState.loading': 'Reading project state…',
    'viewer.projectState.empty': 'Nothing to show — no git repository or detectable app version.',

    // Auto-hide patterns (client badges/buttons in viewer-auto-hide-modal.ts).
    'viewer.autoHide.badgeAlways': 'always',
    'viewer.autoHide.badgeThisLog': 'this log',
    'viewer.autoHide.remove': 'Remove',

    // Go-to-line range hint (viewer-goto-line.ts client).
    'viewer.gotoLine.rangePlaceholder': '1 – {0}',

    // Pinned-lines panel (viewer-pin.ts).
    'viewer.pin.header': 'Pinned ({0})',
    'viewer.pin.unpin': 'Unpin',

    // Performance DB tab (viewer-performance-db-tab.ts). <strong> markup is
    // emitted into client HTML unescaped — translations must keep the tags.
    'viewer.perfDb.driftQueries': 'Queries: <strong>{0}</strong>',
    'viewer.perfDb.driftSlow': 'Slow: <strong>{0}</strong>',
    'viewer.perfDb.driftAvgMs': 'Avg ms: <strong>{0}</strong>',
    'viewer.perfDb.driftAnomalies': 'Anomalies: <strong>{0}</strong>',
    'viewer.perfDb.openPanel': 'Open panel',
    'viewer.perfDb.noRollup': 'No database line rollup in this session.',
    'viewer.perfDb.noFingerprints': 'No Drift SQL fingerprints recorded.',
    'viewer.perfDb.summaryQueries': 'Queries (Drift lines): <strong>{0}</strong>',
    'viewer.perfDb.summaryFingerprints': 'Fingerprints: <strong>{0}</strong>',
    'viewer.perfDb.summaryWithDuration': 'With duration metadata: <strong>{0}</strong>',
    'viewer.perfDb.summaryRollupAvg': 'Rollup avg ms (where known): <strong>{0}</strong>',
    'viewer.perfDb.summarySlowLines': 'Slow lines (≥{0}ms): <strong>{1}%</strong> of lines with duration',
    'viewer.perfDb.timeFilterActive': 'Time filter active',
    'viewer.perfDb.clearTimeFilter': 'Clear time filter',
    'viewer.perfDb.timelineLabel': 'DB activity over session time',
    'viewer.perfDb.timelineHint': '(drag to filter by time)',
    'viewer.perfDb.timelineTrackTitle': 'Drag horizontally to set a time range filter',
    'viewer.perfDb.barQueries': '{0} queries',
    'viewer.perfDb.noTimeRange': 'No time-range for a timeline (need database lines with timestamps).',
    'viewer.perfDb.histoLabel': 'Duration on DB lines:',
    'viewer.perfDb.topFingerprints': 'Top fingerprints by volume',
    'viewer.perfDb.colFingerprint': 'Fingerprint (truncated)',
    'viewer.perfDb.colCount': 'Count',
    'viewer.perfDb.colAvgMs': 'Avg ms',
    'viewer.perfDb.colStaticSources': 'Static sources',
    'viewer.perfDb.staticSourcesTitle': 'Possible Dart sources (project index; not stack trace)',
    'viewer.perfDb.sources': 'Sources',

    // Recurring-errors panel — client card actions (viewer-recurring-panel.ts).
    'viewer.recurring.sessionsOne': '1 session',
    'viewer.recurring.sessionsMany': '{0} sessions',
    'viewer.recurring.totalOccurrences': '{0} total',
    'viewer.recurring.actionClose': 'Close',
    'viewer.recurring.mute': 'Mute',
    'viewer.recurring.reopen': 'Re-open',

    // SQL query history rows (viewer-sql-query-history-panel-render.ts).
    'viewer.sqlHistory.openLogLine': 'Open log · line {0}',
    'viewer.sqlHistory.openLog': 'Open log',
    'viewer.sqlHistory.jumpLine': 'Line {0}',
    'viewer.sqlHistory.openLogTitle': 'Open the source log and jump to the first occurrence',
    'viewer.sqlHistory.jumpTitle': 'Jump to first occurrence',
    'viewer.sqlHistory.openInDrift': 'Open in Drift viewer (Run SQL tab)',
    'viewer.sqlHistory.copyFingerprint': 'Copy fingerprint',
    'viewer.sqlHistory.jumpedHidden': 'Jumped to line {0}. That line may be hidden until filters or layout change.',
    'viewer.sqlHistory.noSourceLog': 'No source log recorded for this fingerprint.',
    'viewer.sqlHistory.openingLog': 'Opening source log…',
    'viewer.sqlHistory.emptyFilter': 'No rows match your filter.',
    'viewer.sqlHistory.emptyCurrentSessionOnly': 'No parsed SQL fingerprints in the active log. Uncheck "Current session only" to see fingerprints aggregated across your other logs.',
    'viewer.sqlHistory.emptySession': 'No parsed SQL fingerprints in any captured log yet.',
    'viewer.sqlHistory.copiedRows.one': 'Copied {0} row to clipboard.',
    'viewer.sqlHistory.copiedRows.many': 'Copied {0} rows to clipboard.',
    'viewer.sqlHistory.copiedFingerprint': 'Copied fingerprint.',
    'viewer.sqlHistory.sortDisabled': 'No SQL queries captured yet — nothing to sort.',
    'viewer.sqlHistory.showingCapped': 'Showing {0} of {1} rows — refine your search to narrow.',
    'viewer.sqlHistory.showMore': 'Show {0} more',
    'viewer.sqlHistory.stat.queries': 'Distinct queries',
    'viewer.sqlHistory.stat.executions': 'Executions',
    'viewer.sqlHistory.stat.slowest': 'Slowest (ms)',
    'viewer.sqlHistory.stat.logs': 'Logs',
    'viewer.sqlHistory.chart.title': 'Top queries by count',
    'viewer.sqlHistory.issues.title': 'Database issues (Drift Advisor)',
    'viewer.sqlHistory.issues.openFix': 'Open the suggested SQL in the Drift viewer',
    'viewer.sqlHistory.lint.title': 'Static code issues (Saropa Lints)',
    'viewer.sqlHistory.lint.advice': 'Drift database linters look turned off. Turn them on to catch WHERE-less updates, enum-index reorders, and unclosed databases.',
    'viewer.sqlHistory.lint.enableBtn': 'Enable Drift linters',
    'viewer.sqlHistory.lint.enableTitle': 'Open a terminal with the Saropa Lints command that enables the Drift rule pack',
};

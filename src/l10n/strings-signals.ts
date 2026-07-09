/**
 * English strings for the host-built Signal Report panel HTML (src/ui/signals/*).
 * Merged into the host `strings` map in ../l10n.ts and looked up with `t()`.
 *
 * NOTE: only the on-screen PANEL is localized. The parallel markdown EXPORT (signal-report-markdown.ts)
 * is left English by design — those reports are pasted into GitHub/Slack for maintainers. Shared
 * helpers (e.g. gatherStats) therefore carry both an English `label` (for markdown) and a `labelKey`
 * (for the panel).
 */
export const stringsSignals: Record<string, string> = {
    // Overview section
    'signals.overview.logFile': 'Log file',
    'signals.overview.reportFile': 'Report file',
    'signals.overview.logLines': 'Log lines',
    'signals.overview.session': 'Session',
    'signals.overview.health': 'Health',
    'signals.overview.started': 'Started',
    'signals.overview.ended': 'Ended',
    'signals.overview.duration': 'Duration',
    'signals.overview.outcome': 'Outcome',
    'signals.overview.outcomeCleanStop': 'Clean stop',
    'signals.overview.outcomeCrash': 'No session footer (possible crash or force-quit)',
    'signals.overview.noOtherSignals': 'No other signals detected in this session',
    'signals.overview.allErrors': 'All errors in session',
    'signals.overview.line': 'Line {0}',
    'signals.overview.andMore': '...and {0} more',

    // Aggregate stat-card labels
    'signals.stat.errors': 'Errors',
    'signals.stat.warnings': 'Warnings',
    'signals.stat.networkFailures': 'Network failures',
    'signals.stat.memoryEvents': 'Memory events',
    'signals.stat.slowOperations': 'Slow operations',
    'signals.stat.permissionDenials': 'Permission denials',
    'signals.stat.classifiedErrors': 'Classified errors',
    'signals.stat.sqlBursts': 'SQL bursts',
    'signals.stat.nPlusOne': 'N+1 queries',
    'signals.stat.anrRisk': 'ANR risk ({0})',
    'signals.stat.driftIssues': 'Drift Advisor issues',

    // Report shell (panel chrome)
    'signals.shell.title': 'Saropa Signal Report',
    'signals.shell.copyReport': 'Copy Report',
    'signals.shell.saveReport': 'Save Report',
    'signals.conf.high': 'High confidence',
    'signals.conf.medium': 'Medium confidence',
    'signals.conf.low': 'Low confidence',

    // Section titles + their loading placeholders
    'signals.section.overview': 'Session Overview',
    'signals.section.evidence': 'Evidence',
    'signals.section.details': 'Signal Details',
    'signals.section.related': 'Related Lines',
    'signals.section.otherSignals': 'Other Signals',
    'signals.section.history': 'Cross-Session History',
    'signals.section.recommendations': 'Recommendations',
    'signals.section.ecosystem': 'Companion Extensions',
    'signals.loading.overview': 'Loading session data...',
    'signals.loading.evidence': 'Loading evidence lines...',
    'signals.loading.details': 'Analyzing signal...',
    'signals.loading.related': 'Scanning for related lines...',
    'signals.loading.otherSignals': 'Checking for other signals...',
    'signals.loading.history': 'Checking session history…',
    'signals.loading.recommendations': 'Generating recommendations...',
    'signals.loading.ecosystem': 'Checking installed extensions…',

    // Evidence + recommendations
    'signals.evidence.noData': 'No evidence lines found',
    'signals.evidence.precedingAction': 'Preceding action: {0}',
    'signals.rec.noData': 'No specific recommendations',
    'signals.rec.error-recent': 'Check the stack trace for the root cause. If the error repeats, consider adding error handling or fixing the underlying issue.',
    'signals.rec.warning-recurring': 'Recurring warnings often indicate deprecated APIs or configuration issues. Address them to prevent future breakage.',
    'signals.rec.network-failure': 'Check network connectivity, server availability, and timeout configuration. Consider adding retry logic with backoff.',
    'signals.rec.memory-pressure': 'Profile memory usage to find leaks. Check for large allocations, unclosed streams, or growing collections.',
    'signals.rec.slow-operation': 'Profile the slow path. Consider caching, pagination, or moving work off the main thread.',
    'signals.rec.permission-denial': 'Ensure the app requests required permissions before use. Check the manifest/Info.plist for missing declarations.',
    'signals.rec.anr-risk': 'Move long-running operations off the main thread. Check for blocking I/O, synchronous network calls, or heavy computation on UI thread.',
    'signals.rec.n-plus-one': 'Use eager loading (joins) or batch queries instead of issuing one query per item in a loop.',
    'signals.rec.sql-burst': 'Consider debouncing or batching these queries. Check if the same query is being called redundantly.',
    'signals.rec.fingerprint-leader': 'This query runs very frequently. Consider caching results or batching multiple calls.',
    'signals.rec.classified-critical': 'This is a critical error that likely causes crashes or data loss. Prioritize collection.',
    'signals.rec.classified-bug': 'This pattern typically indicates a programming error. Check for null/undefined handling and type safety.',
    'signals.recCat.fatal': 'This is a fatal/unhandled exception — the app likely crashed. Check the stack trace for the throw site and add a top-level error handler.',
    'signals.recCat.anr': 'This error is associated with an ANR (Application Not Responding). Move the blocking operation off the main thread.',
    'signals.recCat.oom': 'This is an out-of-memory error. Profile heap usage, check for retained references, and consider reducing allocation in hot paths.',
    'signals.recCat.native': 'This is a native crash (SIGSEGV/SIGABRT). Check for use-after-free, null pointer dereference, or incompatible native library versions.',
    'signals.recCat.non-fatal': 'This is a non-fatal error. Check for null/undefined values at the call site shown in the stack trace.',

    // Related Lines section
    'signals.related.line': 'Line {0}',
    'signals.related.andMore': '...and {0} more',
    'signals.related.none': 'No additional related lines found',
    'signals.related.noErrorDetails': 'No error details available',
    'signals.related.noWarningDetails': 'No warning details available',
    'signals.related.noWarningGroups': 'No matching warning groups found',
    'signals.related.noSlowDetails': 'No slow operation details available',
    'signals.related.noClassifiedDetails': 'No classified error details available',
    'signals.related.itemNoData': 'No {0} details available',
    'signals.related.errorSummary': '{0} error(s)',
    'signals.related.warningSummary': 'Warning repeated {0} time(s) across {1} location(s)',
    'signals.related.slowSummary': '{0} slow operation(s) detected',
    'signals.related.classifiedSummary': '{0} classified error(s)',
    'signals.related.itemSummary': '{0} {1}(s) detected',
    'signals.related.label.networkFailure': 'network failure',
    'signals.related.label.memoryEvent': 'memory event',
    'signals.related.label.permissionDenial': 'permission denial',

    // Panel toasts
    'signals.toast.copied': 'Report copied to clipboard',
    'signals.toast.copyFailed': 'Failed to copy report',
    'signals.toast.buildFailed': 'Failed to build report',
    'signals.toast.saved': 'Report saved to {0}',
    'signals.toast.saveFailed': 'Failed to save report',

    // Signal Details section (panel only; the markdown export uses its own English headings)
    'signals.details.queryFingerprint': 'Query fingerprint',
    'signals.details.repetitions': 'Repetitions',
    'signals.details.distinctArguments': 'Distinct arguments',
    'signals.details.windowSpan': 'Window span',
    'signals.details.confidence': 'Confidence',
    'signals.details.anrScore': 'ANR score',
    'signals.details.riskLevel': 'Risk level',
    'signals.details.issuesFound': 'Issues found',
    'signals.details.topRule': 'Top rule',
    'signals.details.regression': 'Regression',
    'signals.details.firstOccurrence': 'First occurrence',
    'signals.details.lastOccurrence': 'Last occurrence',
    'signals.details.span': 'Span',
    'signals.details.pattern': 'Pattern',
    'signals.details.contributingFactors': 'Contributing factors',
    'signals.details.nPlusOneSummary': '{0} repeats, {1} distinct args',
    'signals.details.lineValue': 'Line {0}',
    'signals.details.spanLines': '{0} lines',
    'signals.details.seconds': '{0}s',
    'signals.details.sqlQueries': '{0} queries{1}',
    'signals.details.inSeconds': ' in {0}s',
    'signals.details.fpOccurrences': '{0} occurrences (sample: line {1})',
    'signals.details.patternSameLine': 'All on the same line',
    'signals.details.patternClustered': 'Clustered ({0}% in one region)',
    'signals.details.patternSpread': 'Spread across the log',

    // Cross-Session History section
    'signals.history.noData': 'No cross-session history for this signal type. History appears after multiple sessions detect the same signal.',
    'signals.history.summary': 'Appeared in {0} of {1} session(s)',
    'signals.history.openTitle': 'Open this session in the viewer',
    'signals.history.whatChanged': 'What changed since last clean session',

    // Companion Extensions (ecosystem) section — Saropa product names stay literal in the values
    'signals.eco.notInstalled': '{0} is not installed.',
    'signals.eco.installLink': 'Install from Marketplace',
    'signals.eco.driftBenefit': 'Adds schema health, query stats, index suggestions, and anomaly detection to your signal reports.',
    'signals.eco.lintsBenefit': 'Adds lint violations, OWASP summaries, and health scores to bug reports generated from signal context.',
    'signals.eco.driftNoIssues': 'Drift Advisor connected — no issues detected this session.',
    'signals.eco.lintsInstalled': 'Saropa Lints installed.',
    'signals.eco.lintsNoViolations': 'Saropa Lints connected — no violations detected.',
    'signals.eco.issuesFound': 'Issues found',
    'signals.eco.topRule': 'Top rule',
    'signals.eco.totalViolations': 'Total violations',
    'signals.eco.analysisTier': 'Analysis tier',
    'signals.eco.criticalHigh': 'Critical + High',

    // Panel section fallbacks
    'signals.panel.noDetails': 'No additional details for this signal type',
    'signals.panel.noEvidence': 'No evidence lines to display',
    'signals.panel.couldNotRead': 'Could not read log file. Evidence at: {0}',
    'signals.panel.outOfRange': 'Evidence lines out of range (file may have changed). Referenced: {0}',
};



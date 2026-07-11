/**
 * English strings for the WEBVIEW (log viewer) — keyed by symbolic ID.
 *
 * These differ from strings-a/strings-b (extension-host UI shown via
 * `vscode.l10n.t()` directly). Webview strings are built CLIENT-SIDE in the
 * iframe, where `vscode.l10n.t()` cannot run, so they take a two-step path:
 *
 *   1. The host resolves every key here through `t()` (→ vscode.l10n + the
 *      `l10n/bundle.l10n.*.json` translations) into a map.
 *   2. `getWebviewL10nScript()` serializes that map as `__VT` and ships it into
 *      the page; the client-side `vt(key, ...args)` helper looks up the
 *      (already-translated) template and substitutes `{0}`, `{1}`, … at render
 *      time with runtime values (frame counts, etc.).
 *
 * Keep templates as FULL sentences with `{n}` placeholders — never concatenate
 * translated fragments, because word order differs across languages. Add the
 * matching translations to each `l10n/bundle.l10n.<locale>.json` keyed by the
 * ENGLISH string (same convention as strings-a/b); until then `vt()` falls back
 * to English, identical to today's behavior.
 */
export const stringsWebview: Record<string, string> = {
    // Collapsible stack-trace header tooltips (multi-frame Dart/JS/Python traces).
    'viewer.stackHeader.single': 'Stack trace',
    'viewer.stackHeader.singleDup': 'Stack trace · appeared {0} times',
    'viewer.stackHeader.collapsed': 'Stack trace collapsed · {0} frames · click to expand',
    'viewer.stackHeader.expanded': 'Stack trace expanded · click to collapse',
    'viewer.stackHeader.preview': 'Stack trace · preview mode · click to expand all',

    // Collapsible Flutter exception banner header tooltips (RenderFlex/assertion dumps).
    'viewer.bannerHeader.collapsed': 'Exception collapsed · {0} lines · click to expand',
    'viewer.bannerHeader.expanded': 'Exception expanded · click to collapse',

    // Collapsible render-tree descendant-dump header tooltips (plan 052).
    'viewer.treeHeader.single': 'Render tree',
    'viewer.treeHeader.collapsed': 'Render tree collapsed · {0} nodes · click to expand',
    'viewer.treeHeader.expanded': 'Render tree expanded · click to collapse',
    'viewer.treeHeader.preview': 'Render tree · preview mode · click to expand all',

    // Trouble Mode severity chart (Stage 3) — client-side chart strings.
    'viewer.troubleChart.empty': 'No errors, warnings, or performance issues in this log yet',
    // Shown before the app launches: the log so far is only device backlog, not app trouble.
    'viewer.troubleChart.waiting': 'Waiting for the app to start…',
    // {0}=window start time, {1}=error count, {2}=warning count, {3}=performance count.
    'viewer.troubleChart.barTip': '{0} · errors {1} · warnings {2} · performance {3}',
    // Chart readability (plan 110, Stage 4): legend chips, peak-count label, axis end labels.
    // {0}=count in each legend chip, so a language can put the number before the word. The
    // words are deliberately abbreviated (Error / Warn / Perf) — the chips sit in a dense
    // head row the CSS renders uppercase, and the full words crowd it; the color swatch and
    // the tooltip carry the full meaning. WARN/PERF mirror the toolbar's single-letter dots.
    'viewer.troubleChart.legend.error': 'Error {0}',
    'viewer.troubleChart.legend.warning': 'Warn {0}',
    'viewer.troubleChart.legend.performance': 'Perf {0}',
    // Tooltip on each legend chip: the chips are clickable level filters, mirroring the
    // toolbar dots (single-click toggles the level, double-click focuses only it).
    'viewer.troubleChart.chip.title': 'Click to toggle this level, double-click to focus it',
    // {0}=the busiest window's total event count. Labels the top of the y axis.
    'viewer.troubleChart.peak': 'Peak {0}',
    // Crashlytics issue detail (rail + panel skeleton). {0}=event count, {1}=user count.
    'viewer.troubleCrashlytics.counts': '{0} events · {1} users',
    // Trouble Mode Signals band. count = per-row occurrence count; total = signals in the head; all = "See all" link.
    'viewer.troubleSignals.count': '{0}x',
    'viewer.troubleSignals.total': '{0} signals',
    'viewer.troubleSignals.all': 'All {0}',

    // Find in Files — runtime result strings built client-side.
    'viewer.find.minChars': 'Type at least 2 characters',
    'viewer.find.noMatches': 'No matches found',
    // {0}=matches, {1}=totalFiles when no file matched.
    'viewer.find.summaryZero': '{0} matches in 0 of {1} files',
    // {0}=count, {1}=match/matches, {2}=fileHits, {3}=totalFiles, {4}=file/files.
    // The count words are separate keys so singular/plural stays correct per language.
    'viewer.find.summary': '{0} {1} in {2} of {3} {4}',
    'viewer.find.matchWord.one': 'match',
    'viewer.find.matchWord.many': 'matches',
    'viewer.find.fileWord.one': 'file',
    'viewer.find.fileWord.many': 'files',

    // Bookmark panel — runtime strings built client-side.
    'viewer.bookmark.fileTitle': 'Log file',
    'viewer.bookmark.withNote': 'Bookmark with note',
    'viewer.bookmark.noNote': 'Bookmark',
    'viewer.bookmark.editNote': 'Edit Note',
    'viewer.bookmark.delete': 'Delete',
    'viewer.bookmark.deleteFile': 'Delete all for this file',
    'viewer.bookmark.noMatching': 'No matching bookmarks',
    'viewer.bookmark.emptyShort': 'No bookmarks yet.',

    // Trash panel — runtime strings built client-side.
    'viewer.trash.itemIcon': 'Trashed session',
    'viewer.meta.lines': '{0} lines',

    // About panel — runtime strings (chrome only; brand copy stays English).
    // changelogLoading is shared: host HTML t() (via merged map) + client vt() reset.
    'viewer.about.changelogLoading': 'Loading…',
    'viewer.about.changelogUnavailable': 'Changelog unavailable.',
    'viewer.about.copied': 'Copied: {0}',
    'viewer.about.debugLoading': 'Resolving paths…',
    'viewer.about.debugNoPaths': 'No log directory resolved — open a workspace folder, or browse a Logs root in the panel header.',
    'viewer.about.debugPresent': 'present',
    'viewer.about.debugMissing': 'missing',
    'viewer.about.openInViewer': 'Open in the log viewer',
    'viewer.about.revealInOS': 'Reveal in the file explorer',

    // Crashlytics panel — runtime strings built client-side.
    'viewer.crashlytics.headerBase': 'Crashlytics',
    'viewer.crashlytics.openConsole': 'Open Firebase Console',
    'viewer.crashlytics.openGsj': 'Open google-services.json',
    'viewer.crashlytics.copyDiag': 'Copy diagnostic',
    'viewer.crashlytics.showOutput': 'Show Output',
    'viewer.crashlytics.queryFailed': 'Query failed',
    'viewer.crashlytics.fatal': 'FATAL',
    'viewer.crashlytics.nonfatal': 'NON-FATAL',
    'viewer.crashlytics.openDetail': 'Open issue detail',
    'viewer.crashlytics.detail.loading': 'Loading issue…',
    'viewer.crashlytics.frameMenu.copy': 'Copy frame',
    'viewer.crashlytics.frameMenu.copyPath': 'Copy file path',
    'viewer.crashlytics.frameMenu.open': 'Open file',
    'viewer.crashlytics.frameMenu.issue': 'Create issue from frame',
    'viewer.crashlytics.closeIssue': 'Close',
    'viewer.crashlytics.mute': 'Mute',
    'viewer.crashlytics.usersOne': '{0} user',
    'viewer.crashlytics.usersMany': '{0} users',
    'viewer.crashlytics.events': '{0} events',
    // Rendered client-side via vt() in renderIssue, so it must live in the webview __VT map.
    'viewer.crashlytics.releaseDateTip': 'Release date derived from the app version code',
    'viewer.crashlytics.loadingDetail': 'Loading crash details…',
    // These four crash-badge labels and the three session-info strings below are rendered
    // CLIENT-SIDE via vt(), so they must live in a webview strings file to enter the __VT map.
    // They were previously in host strings (strings-viewer-c.ts / strings-viewer-d.ts), where vt()
    // could not resolve them and rendered the raw key (e.g. "viewer.crashlytics.badge.regressed")
    // to users. Surfaced by the visual harness (test/visual). Keep client-rendered keys here.
    'viewer.crashlytics.badge.repetitive': 'Repetitive',
    'viewer.crashlytics.badge.repetitiveTip': 'Seen across more than one app version',
    'viewer.crashlytics.badge.regressed': 'Regressed',
    'viewer.crashlytics.badge.regressedTip': 'Returned after dropping out of the tracked top issues in an earlier scan. Derived from the top-issues list, so it can also reflect an issue that merely fell below the tracked cutoff and came back, not only a true regression.',
    'viewer.sessionInfo.empty': 'No session header found in this log.',
    'viewer.sessionInfo.openInBrowser': 'Open in browser',
    'viewer.sessionInfo.revealInExplorer': 'Reveal in OS file explorer',

    // Crashlytics setup wizard — rendered CLIENT-SIDE via vt() (viewer-crashlytics-setup.ts), so these
    // must live in a webview strings file to enter the __VT map. Some values embed inline <code> tags
    // or HTML entities (&quot;, &rarr;): keep the markup inside the value so word order stays
    // translatable rather than concatenating English fragments. Brand/product/identifier tokens
    // (Firebase, Crashlytics, gcloud, google-services.json, VS Code, Google Cloud CLI, the setting id)
    // stay literal; the MT pipeline shields them.
    'viewer.crashlytics.setup.checkAgain': 'Check Again',
    'viewer.crashlytics.setup.testConnection': 'Test connection',
    'viewer.crashlytics.setup.connUnavailable': 'Connection check unavailable — see the Saropa Log Capture output channel.',
    'viewer.crashlytics.setup.connected': 'Connected',
    'viewer.crashlytics.setup.notConnected': 'Not connected yet — fix the steps marked below.',
    'viewer.crashlytics.setup.details': 'Details',
    'viewer.crashlytics.setup.intro': 'Connect Firebase Crashlytics to triage your crashes without leaving the editor.',
    'viewer.crashlytics.setup.stepInstall': 'Install',
    'viewer.crashlytics.setup.stepSignIn': 'Sign in',
    'viewer.crashlytics.setup.stepProject': 'Project',
    'viewer.crashlytics.setup.statusGcloud': 'Google Cloud access is not set up yet.',
    'viewer.crashlytics.setup.statusToken': 'Not signed in to Google Cloud yet.',
    'viewer.crashlytics.setup.statusConfig': 'Firebase project is not configured yet.',
    'viewer.crashlytics.setup.whatWentWrong': 'What went wrong?',
    'viewer.crashlytics.setup.billingTip': 'Google Cloud may prompt you to enable billing, but Crashlytics API access is free.',
    'viewer.crashlytics.setup.consoleVerifyHint': 'to verify the project or copy the project / app ID.',
    'viewer.crashlytics.setup.ifThisDoesntWork': 'If this doesn\'t work',
    'viewer.crashlytics.setup.troubleshooting': 'Troubleshooting',
    'viewer.crashlytics.setup.thSymptom': 'Symptom',
    'viewer.crashlytics.setup.thCause': 'Cause',
    'viewer.crashlytics.setup.thFix': 'Fix',
    'viewer.crashlytics.setup.installVia': 'Install via:',
    'viewer.crashlytics.setup.copy': 'Copy',
    'viewer.crashlytics.setup.gcloudPathHint': 'If <code>gcloud</code> is not in PATH after installing, restart the terminal or VS Code.',
    'viewer.crashlytics.setup.installTitle': 'Install Google Cloud CLI',
    'viewer.crashlytics.setup.gcloudNeeded': 'The <code>gcloud</code> CLI is needed to authenticate with Firebase Crashlytics.',
    'viewer.crashlytics.setup.downloadGcloud': 'Download Google Cloud CLI',
    'viewer.crashlytics.setup.signInExternalHint': 'If sign-in fails in the VS Code terminal, run the command below in an external terminal (where <code>gcloud</code> is in PATH), then click Check Again.',
    'viewer.crashlytics.setup.permissionDeniedHint': 'If you see &quot;Permission denied&quot;, your account needs the Firebase Crashlytics Viewer role on the project.',
    'viewer.crashlytics.setup.serviceAccountHint': 'Alternatively, set <code>saropaLogCapture.firebase.serviceAccountKeyPath</code> to a service account JSON key file (e.g. when gcloud is not available).',
    'viewer.crashlytics.setup.signInTitle': 'Sign in to Google Cloud',
    'viewer.crashlytics.setup.signInBody': 'Authenticate with your Google account to access Crashlytics data.',
    'viewer.crashlytics.setup.useExistingFile': 'Use existing file: {0}',
    'viewer.crashlytics.setup.findIdsHint': 'Find project ID and app ID in Firebase Console under Project Settings &rarr; General.',
    'viewer.crashlytics.setup.addConfigTitle': 'Add Firebase Config',
    'viewer.crashlytics.setup.provideConfig': 'Provide your <code>google-services.json</code> file or configure the project manually.',
    'viewer.crashlytics.setup.browseGsj': 'Browse for google-services.json',
    'viewer.crashlytics.setup.orConfigureSettings': 'Or configure in settings',

    // NOTE: the Signal panel's cross-session report strings (time labels, suggestion / hot-files /
    // environment / all-signals / in-log section summaries, related-signals counts, and the live
    // "No log open" label) were folded into the panel-standalone SignalScriptStrings object
    // (signal.* in strings-b.ts, consumed as SIGNAL_STRINGS.* via fillSignalString) so the whole
    // signal panel uses one localization mechanism. Do not re-add them here.

    // Session (Logs) list — runtime strings built client-side (viewer-session-panel-rendering.ts).
    'viewer.session.noMatch': 'No sessions match the current filters',
    'viewer.session.pagination.showing': 'Showing {0}–{1} of {2}',
    'viewer.session.pagination.prev': 'Previous page',
    'viewer.session.pagination.next': 'Next page',
    'viewer.session.icon.recording': 'Actively recording',
    'viewer.session.icon.completed': 'Completed session',
    'viewer.session.icon.logFile': 'Log file',
    'viewer.session.icon.updatedMin': 'Log updated in the last minute',
    'viewer.session.icon.updatedSince': 'Log has new lines since last viewed',
    // Verb labels precede one removable pill per filtered name (no {0}: the names
    // render as pills, so several can be hidden / shown at once).
    'viewer.session.nameFilter.only': 'Showing only:',
    'viewer.session.nameFilter.hiding': 'Hiding:',
    'viewer.session.nameFilter.remove.title': 'Remove {0} from the filter',
    'viewer.session.filterChip.remove.title': 'Clear the {0} filter',
    'viewer.session.nameFilter.clear.title': 'Clear name filter',
    'viewer.session.nameFilter.showAll': 'Show All',
    'viewer.session.latest': '(latest)',
    'viewer.session.pinned.heading': 'Pinned',
    'viewer.session.perfAvailable': 'Performance data available',
    'viewer.session.loadedManually': 'Opened via Open Log File · grouped by load date',
    'viewer.session.dot.updatedMin': 'Updated in the last minute',
    'viewer.session.dot.updatedSince': 'New lines since last viewed',
    'viewer.session.dot.unread': 'Unread — captured after Logs panel last had focus',
    'viewer.session.group.expand': 'Expand this session group',
    'viewer.session.group.collapse': 'Collapse this session group',
    'viewer.session.revealInOS': 'Reveal in File Explorer',
    // {0}=count of hidden older runs sharing this name. Appears on the latest row when "Latest only"
    // is on, so older logs stay discoverable (and one click expands them) instead of vanishing.
    'viewer.session.olderCount': '+{0} older',
    'viewer.session.older.expand': 'Show older logs with this name',
    'viewer.session.older.collapse': 'Hide older logs with this name',
    // Title on a Controller row's icon — the day's tree root that peripheral logs nest beneath.
    'viewer.session.controller': 'Controller — peripheral logs nest under this session',
    // Reports bucket and newer-log banner — see [plans/history/2026.06/2026.06.02/001_plan-newer-alert-and-reports-grouping.md].
    // {0}=count of report rows in the bucket. The label collapses N entries (lint reports,
    // bundle audits, etc.) under a single fold-out heading so the day's debug-session rows
    // stay scannable.
    'viewer.session.reports.bucketLabel': 'Reports ({0})',
    // {0}=newest unread log's display name, {1}=human time (relative or absolute).
    'viewer.session.newerBanner.singular': 'New log · {0} · {1}',
    // {0}=newest log name, {1}=time, {2}=count of additional unread logs (>=1).
    'viewer.session.newerBanner.plural': 'New logs · {0} · {1} (+{2} more)',
    'viewer.session.newerBanner.open': 'Open',
    'viewer.session.newerBanner.dismiss': 'Dismiss',

    // Unified log banner (plan 109). {0}=newest controller log name (auto mode) / relative start
    // (lifespan) / duration (lifespan) / newer-count (staleness chip).
    'viewer.logBanner.newer': 'Newer · {0}',
    'viewer.logBanner.started': 'Started {0}',
    'viewer.logBanner.ran': 'ran {0}',
    'viewer.logBanner.justNow': 'just now',
    'viewer.logBanner.minAgo': '{0} min ago',
    'viewer.logBanner.hrAgo': '1 hr ago',
    'viewer.logBanner.hrsAgo': '{0} hrs ago',
    'viewer.logBanner.more': 'More actions',
    'viewer.logBanner.unnamed': 'Log',
    // The session context line the status bar builds. It was toolbar HTML rendered host-side under
    // viewer.toolbar.sessionDetails.*; the bar builds it client-side, so it needs __VT keys.
    'viewer.logBanner.details.label': 'Log context',
    'viewer.logBanner.details.title': 'Log session context and metadata',
    'viewer.toolbar.staleness.newer': '{0} newer',
    // File-action labels the banner shows via vt(). Mirrors the host-side viewer.logFile.* values
    // used by the log-file modal so the inline banner and the modal read identically.
    'viewer.logFile.openEditor': 'Open in Editor',
    'viewer.logFile.openBeside': 'Open beside',
    'viewer.logFile.openFolder': 'Open containing folder',
    'viewer.logFile.revealInExplorer': 'Reveal in Explorer view',
    'viewer.logFile.openInTerminal': 'Open folder in terminal',
    'viewer.logFile.copyFilename': 'Copy filename',
    'viewer.logFile.copyRelativePath': 'Copy relative path',
    'viewer.logFile.copyFullPath': 'Copy Full Path',

    // Replay — runtime strings (viewer-replay.ts client script).
    'viewer.replay.qualityDisabled': 'Enable the codeQuality integration to generate quality reports.',
    'viewer.replay.qualityEnabled': 'Open session quality report (.quality.json sidecar)',
    'viewer.replay.action.playing': 'Replay playing',
    'viewer.replay.action.replay': 'Replay log',

    // Error hover popup — runtime strings (viewer-error-hover-script.ts).
    'viewer.errorHover.critical': 'CRITICAL',
    'viewer.errorHover.transient': 'TRANSIENT',
    'viewer.errorHover.bug': 'BUG',
    'viewer.errorHover.framework': '(framework)',
    'viewer.errorHover.close': 'Close',
    'viewer.errorHover.loadingHistory': 'Loading history…',
    'viewer.errorHover.analyze': 'Analyze',
    'viewer.errorHover.analyzeTitle': 'Open full analysis',
    'viewer.errorHover.firstOccurrence': 'First occurrence',
    'viewer.errorHover.new': 'New',
    'viewer.errorHover.logsOne': '{0} log',
    'viewer.errorHover.logsMany': '{0} logs',
    'viewer.errorHover.total': '{0} total',
    'viewer.errorHover.firstLast': 'First: {0} · Last: {1}',
    'viewer.errorHover.introducedInCommit': 'Introduced in commit ',
    'viewer.errorHover.lastChangedInCommit': 'Last changed in commit ',
    'viewer.errorHover.fingerprintTitle': 'Fingerprint: {0}',

    // ── Collections panel — webview runtime (viewer-collections-panel-script.ts) ──
    'viewer.collections.empty': 'No collections yet.',
    'viewer.collections.sourceOne': '{0} source',
    'viewer.collections.sourceMany': '{0} sources',
    'viewer.collections.justNow': 'just now',
    'viewer.collections.minAgo': '{0} min ago',
    'viewer.collections.hAgo': '{0}h ago',
    'viewer.collections.daysAgo': '{0} days ago',
    'viewer.collections.wAgo': '{0}w ago',
    'viewer.collections.rename': 'Rename',
    'viewer.collections.open': 'Open',
    'viewer.collections.delete': 'Delete',
    'viewer.collections.mergeError': 'Source and target must be different',
};

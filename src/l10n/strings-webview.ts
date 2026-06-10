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

    // Collapsible render-tree descendant-dump header tooltips (plan 052).
    'viewer.treeHeader.single': 'Render tree',
    'viewer.treeHeader.collapsed': 'Render tree collapsed · {0} nodes · click to expand',
    'viewer.treeHeader.expanded': 'Render tree expanded · click to collapse',
    'viewer.treeHeader.preview': 'Render tree · preview mode · click to expand all',

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
    'viewer.crashlytics.loadingDetail': 'Loading crash details…',

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
};

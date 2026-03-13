import * as vscode from 'vscode';

/**
 * English strings keyed by symbolic ID.
 * Source of truth for default (English) text.
 * Translation bundles in `l10n/` map the English string → translated string.
 */
const strings: Record<string, string> = {
    // Status bar
    'statusBar.pauseTooltip': 'Saropa Log Capture: Click to pause.',
    'statusBar.resumeTooltip': 'Saropa Log Capture: Click to resume.',
    'statusBar.recordingTooltip': 'Saropa Log Capture: Recording. Click to open log file.',
    'statusBar.recordingTooltipWithIntegrations': 'Saropa Log Capture: Recording. Integrations: {0}. Click to open log file.',
    'statusBar.pausedTooltip': 'Saropa Log Capture: Paused. Click to open log file.',
    'statusBar.lines': '{0} lines',
    'statusBar.pausedLines': 'Paused ({0} lines)',
    'statusBar.adaptersSuffix': ' | $(check-all) {0} adapters',
    'statusBar.singleAdapterSuffix': ' | $(package) {0}',

    // Integration labels
    'integration.packages': 'Packages',
    'integration.buildCi': 'Build',
    'integration.windowsEvents': 'Windows events',
    'integration.git': 'Git',
    'integration.database': 'Database',
    'integration.externalLogs': 'External logs',
    'integration.performance': 'Performance',
    'integration.http': 'HTTP',
    'integration.terminal': 'Terminal',
    'integration.browser': 'Browser',
    'integration.docker': 'Docker',
    'integration.linuxLogs': 'Linux logs',
    'integration.crashDumps': 'Crash dumps',
    'integration.testResults': 'Tests',
    'integration.security': 'Security',
    'integration.coverage': 'Coverage',
    'integration.environment': 'Environment',
    'integration.crashlytics': 'Crashlytics',

    // Session & file messages
    'msg.noActiveSessionToSplit': 'No active debug session to split.',
    'msg.logFileSplit': 'Log file split. Now on part {0}.',
    'msg.deleteFileConfirm': 'Delete {0}?',
    'msg.renameSessionPrompt': 'Enter new name for this session (also renames file)',
    'msg.enterTagsPrompt': 'Enter tags (comma-separated)',
    'msg.exportedTo': 'Exported to {0}',
    'msg.foundCorrelationTags': 'Found {0} correlation tag{1}.',
    'msg.filePathCopied': 'File path copied to clipboard',
    'msg.inlineDecorationsEnabled': 'Inline log decorations enabled',
    'msg.inlineDecorationsDisabled': 'Inline log decorations disabled',
    'msg.templateApplied': 'Template "{0}" applied.',
    'msg.resetSettingsConfirm': 'Reset all Saropa Log Capture settings to defaults?',
    'msg.settingsReset': 'Reset {0} settings to defaults.',
    'msg.markerPrompt': 'Marker text (leave empty for timestamp only)',
    'msg.markerPlaceholder': 'e.g. before refactor, test attempt 2',

    // Trash
    'msg.trashEmpty': 'Trash is empty.',
    'msg.deleteTrashConfirm': 'Permanently delete {0} trashed file(s)? This cannot be undone.',
    'msg.permanentlyDeletedFromTrash': 'Permanently deleted {0} file(s) from trash.',

    // Comparison
    'msg.markedForComparison': 'Marked "{0}" for comparison. Select another session to compare.',
    'msg.noSessionMarked': 'No session marked. Right-click a session and "Mark for Comparison" first.',
    'msg.cannotCompareWithSelf': 'Cannot compare a session with itself.',
    'msg.needTwoSessions': 'Need at least 2 sessions to compare.',
    'prompt.selectFirstSession': 'Select FIRST session to compare',
    'prompt.selectSecondSession': 'Select SECOND session to compare',
    'title.compareSessions1': 'Compare Sessions (1/2)',
    'title.compareSessions2': 'Compare Sessions (2/2)',

    // Gitignore
    'msg.gitignoreLogPrompt': "Saropa Log Capture saves logs to '{0}/'. Add it to .gitignore to prevent accidental commits?",
    'msg.gitignoreSaropaPrompt': "Saropa Log Capture stores indexes and caches in '.saropa/'. Add it to .gitignore?",
    'msg.failedUpdateGitignore': 'Failed to update .gitignore: {0}',

    // Deep links
    'msg.invalidDeepLink': 'Invalid deep link format',
    'msg.noWorkspaceOpen': 'No workspace open. Please open a workspace first.',
    'msg.logFileNotFound': 'Log file not found: {0}',
    'msg.deepLinkCopied': 'Deep link copied{0}',
    'msg.deepLinkLocalCopied': 'Link copied. Recipient: Investigation panel → Open .slc file → select the file.',
    'msg.importLinkMissingParams': 'Import link missing gist or url parameter.',
    'msg.importFailed': 'Failed to import: {0}',
    'msg.importGistNotFound': 'Gist not found or not accessible.',
    'msg.importGistInvalid': 'Invalid investigation gist: missing .slc file.',
    'msg.importDownloadFailed': 'Failed to download file.',
    'msg.importFileTooLarge': 'File too large (max 100 MB).',
    'msg.importOnlyHttps': 'Use an https URL, a same-network http URL (e.g. 192.168.x.x), or a file:// URL.',
    'msg.githubAuthRequired': 'GitHub authentication required to share via Gist.',
    'msg.investigationTooLargeWarning': 'Investigation is large ({0} MB). Upload may be slow or hit Gist limits. Continue?',
    'msg.deepLinksCopied': '{0} deep links copied to clipboard',
    'msg.filePathsCopied': '{0} file paths copied to clipboard',

    // AI Explain
    'msg.aiExplainDisabled': 'Enable "Saropa Log Capture > AI: Enabled" in Settings to use Explain with AI.',
    'msg.aiExplainError': 'Explain with AI: {0}',
    'msg.aiExplainProgress': 'Explaining with AI…',
    'panel.aiExplainTitle': 'AI Explanation',
    'panel.aiExplainCopyBtn': 'Copy explanation',
    'panel.aiExplainCached': ' (cached)',

    // Watch list
    'msg.alreadyInWatchList': '"{0}" is already in watch list.',
    'msg.addedToWatchList': 'Added "{0}" to watch list.',

    // Bookmarks
    'msg.deleteBookmarksForFile': 'Delete all bookmarks for {0}?',
    'msg.deleteAllBookmarks': 'Delete all {0} bookmark{1}?',
    'prompt.editBookmarkNote': 'Edit bookmark note',

    // Line editing
    'msg.noLogFileLoaded': 'No log file is currently loaded for editing.',
    'msg.debugSessionActiveEdit': 'A debug session is active. Editing the log file now may cause data loss or corruption.',
    'msg.lineIndexOutOfRange': 'Line index {0} is out of range.',
    'msg.lineUpdatedSuccess': 'Line {0} updated successfully.',
    'msg.exportedLinesTo': 'Exported {0} line{1}{2} to {3}',
    'msg.failedEditLine': 'Failed to edit line: {0}',
    'msg.failedExportLogs': 'Failed to export logs: {0}',
    'prompt.goToLine': 'Go to line number',
    'prompt.goToLineValidate': 'Enter a number',
    'prompt.annotateLine': 'Annotate line {0}',

    // File operations
    'msg.cannotRenameExists': 'Cannot rename: "{0}" already exists.',
    'msg.failedRenameLogFile': 'Failed to rename log file: {0}',
    'msg.fileRetentionMoved': 'Saropa Log Capture: Moved {0} old file(s) to trash (maxLogFiles: {1}).',
    'msg.sourceFileNotFound': 'Source file "{0}" not found in workspace.',

    // Filter presets
    'msg.noFilterPresets': 'No filter presets configured.',
    'msg.filterPresetSaved': 'Filter preset "{0}" saved.',
    'prompt.selectPreset': 'Select a filter preset to apply',
    'prompt.presetName': 'Enter a name for this filter preset',
    'prompt.presetPlaceholder': 'e.g., Errors Only, SQL Queries, Network Debug',

    // Templates
    'msg.noTemplates': 'No templates available.',
    'msg.templateSaved': 'Template "{0}" saved.',
    'prompt.selectTemplate': 'Select a template to apply',
    'prompt.templateName': 'Enter a name for this template',
    'prompt.templateNamePlaceholder': 'e.g., My Flutter Setup, API Debug',
    'prompt.templateDescription': 'Enter a description (optional)',
    'prompt.templateDescriptionPlaceholder': 'e.g., Optimized for REST API debugging',

    // Error rate
    'msg.highErrorRate': 'High error rate detected: {0} errors in {1}s',

    // Session management
    'msg.noSessionFiles': 'No session files found.',
    'msg.deletedSessionFiles': 'Deleted {0} session file(s).',
    'prompt.selectSessionsToDelete': 'Select session file(s) to delete',
    'msg.noTailedFiles': 'No files match tail patterns. Check saropaLogCapture.tailPatterns.',
    'msg.openWorkspaceFirst': 'Open a workspace folder first.',
    'msg.selectTailedFile': 'Select a file to open and tail',

    // Bug reports & timeline
    'msg.bugReportCopied': 'Bug report markdown copied to clipboard.',
    'msg.reportSavedTo': 'Report saved to {0}',
    'msg.rightClickForTimeline': 'Right-click a session in Session History to show its timeline.',
    'msg.rightClickForBugReport': 'Right-click an error line in the log viewer to generate a bug report.',

    // Timeline panel
    'panel.timeline.title': 'Unified Timeline',
    'panel.timeline.loading': 'Loading timeline data...',
    'panel.timeline.detectingCorrelations': 'Detecting correlations…',
    'panel.timeline.noEvents': 'No events found in this session.',
    'panel.timeline.duration': 'Duration',
    'panel.timeline.total': 'Events',
    'panel.timeline.exportJson': 'Export JSON',
    'panel.timeline.exportCsv': 'Export CSV',
    'panel.correlation.title': 'Correlations',
    'panel.correlation.related': 'Related events',
    'panel.correlation.jumpTo': 'Jump to event',
    'correlation.badgeTitle': 'Related to: {0}',
    'msg.noGoogleServicesJson': 'No google-services.json found in workspace. Add one (e.g. android/app/) or use Browse to select a file.',
    'msg.noAnalyzableTokens': 'No analyzable tokens found in this line.',

    // Export
    'saveLabel.exportLogs': 'Export Logs',
    'filter.textFiles': 'Text Files',
    'filter.allFiles': 'All Files',
    'filter.slcBundles': '.slc session bundles',
    'action.saveSlcBundle': 'Save .slc Bundle',
    'msg.slcImportReadFailed': 'Failed to read .slc file: {0}',
    'msg.slcImportNoManifest': 'Invalid .slc: missing manifest.json',
    'msg.slcImportInvalidManifest': 'Invalid .slc: invalid or unsupported manifest',
    'msg.slcImportNoWorkspace': 'Open a workspace folder to import .slc bundles.',
    'msg.slcImportMissingLog': 'Invalid .slc: missing log file "{0}"',
    'msg.openLogFirst': 'Open a log file first.',
    'title.importSlc': 'Import .slc session bundle(s)',
    'progress.exportSlc': 'Exporting .slc bundle\u2026',
    'progress.importSlc': 'Importing .slc bundle(s)\u2026',
    'progress.exportLoki': 'Pushing to Loki\u2026',
    'msg.lokiPushed': 'Session pushed to Loki.',
    'msg.lokiNotConfigured': 'Enable Loki export in settings and set the Loki push URL.',
    'msg.lokiPushFailed': 'Loki push failed: {0}',
    'msg.lokiApiKeyStored': 'Loki API key stored. You can now use Export to Loki.',
    'msg.lokiApiKeyEmpty': 'No key entered. Use this command again to store your Loki API key.',
    'prompt.lokiApiKey': 'Loki API key (Bearer token). Stored in Secret Storage.',
    'prompt.lokiApiKeyPlaceholder': 'Paste your Grafana Cloud or Loki API key',

    // Integration context
    'msg.noIntegrationContext': 'No integration context available for this line.',
    'msg.noIntegrationData': 'No integration data captured for this session. Enable integrations in settings.',
    'msg.noIntegrationDataInWindow': 'No integration data in this time window.',

    // Actions (shared button labels)
    'action.delete': 'Delete',
    'action.open': 'Open',
    'action.reset': 'Reset',
    'action.addToGitignore': 'Add to .gitignore',
    'action.dontAskAgain': "Don't Ask Again",
    'action.editAnyway': 'Edit Anyway',
    'action.cancel': 'Cancel',
    'action.deleteAll': 'Delete All',
    'action.openLog': 'Open Log',
    'action.add': 'Add',
    'action.clear': 'Clear',
    'action.unpin': 'Unpin',
    'action.createInvestigation': 'Create Investigation',
    'action.createNew': 'Create New...',
    'action.closeInvestigation': 'Close Investigation',
    'action.exportSlc': 'Export as .slc',
    'action.openSlcFile': 'Open .slc file',
    'action.generateBugReport': 'Generate Bug Report',

    // Investigation mode
    'prompt.investigationName': 'Enter a name for this investigation',
    'placeholder.investigationName': 'e.g., Auth Timeout Bug #1234',
    'validation.nameRequired': 'Name is required',
    'validation.nameTooLong': 'Name must be 100 characters or less',
    'msg.investigationCreated': 'Investigation "{0}" created.',
    'msg.investigationCreateFailed': 'Failed to create investigation: {0}',
    'msg.noInvestigations': 'No investigations yet.',
    'prompt.selectInvestigation': 'Select an investigation to open',
    'prompt.selectInvestigationToAdd': 'Select an investigation to add source to',
    'prompt.selectInvestigationToDelete': 'Select an investigation to delete',
    'prompt.selectSourceToRemove': 'Select a source to remove',
    'msg.noFileToAdd': 'No file selected to add.',
    'msg.sourceAddedToInvestigation': 'Added "{0}" to investigation "{1}".',
    'msg.sourceRemovedFromInvestigation': 'Removed "{0}" from investigation.',
    'msg.noActiveInvestigation': 'No active investigation.',
    'msg.noSourcesInInvestigation': 'No sources in this investigation.',
    'msg.noSessionsToAdd': 'No sessions found to add.',
    'prompt.selectSessionsForInvestigation': 'Select sessions to add to the new investigation',
    'msg.deleteInvestigationConfirm': 'Delete investigation "{0}"? This cannot be undone.',
    'msg.investigationDeleted': 'Investigation "{0}" deleted.',
    'msg.investigationImported': 'Investigation "{0}" imported.',
    'msg.investigationShared': 'Investigation shared.',
    'msg.featureComingSoon': 'This feature is coming soon.',
    'progress.exportInvestigation': 'Exporting investigation bundle…',
    'progress.shareInvestigation': 'Sharing investigation…',
    'title.shareInvestigation': 'Share Investigation',
    'title.recentShares': 'Recent shares',
    'msg.noRecentShares': 'No recent shares.',
    'msg.shareHistoryCleared': 'Share history cleared.',
    'action.shareInvestigation': 'Share',
    'action.recentShares': 'Recent shares…',
    'action.clearShareHistory': 'Clear share history',
    'action.shareOnLan': 'Share on LAN (temporary server)',
    'action.uploadToUrl': 'Upload to configured URL',
    'action.saveToSharedFolder': 'Save to shared folder',
    'action.copyDeepLinkLocal': 'Copy deep link (local file)',
    'share.copyDeepLinkLocalDescription': 'Export to .slc and copy link. Recipient opens via Investigation panel → Open .slc file.',
    'share.gistDescription': 'Secret gists do not expire; delete from GitHub when no longer needed.',
    'action.stopServer': 'Stop server',
    'msg.lanServerStarted': 'LAN server started. Teammates can download: {0}',
    'msg.uploadedToUrl': 'Uploaded to URL.',
    'msg.savedToSharedFolder': 'Saved to shared folder.',
    'msg.sharedFolderNotConfigured': 'Set saropaLogCapture.share.sharedFolderPath to use this option.',
    'msg.uploadUrlNotConfigured': 'Set saropaLogCapture.share.uploadPutUrl to use this option.',
    'action.copyLink': 'Copy Link',
    'action.openGist': 'Open Gist',
    'action.authenticate': 'Authenticate',
    'action.continue': 'Continue',

    // Cursor IDE compatibility
    'msg.cursorIdeWarning': 'Running in Cursor IDE. Debug output capture may not work correctly due to differences in the Debug Adapter Protocol implementation.',
    'action.learnMore': 'Learn More',
    'action.dontShowAgain': "Don't Show Again",

    'msg.investigationSources': '{0} pinned source(s)',
    'label.pinnedSources': 'Pinned Sources',
    'label.notes': 'Notes',
    'placeholder.searchSources': 'Search across all sources...',
    'placeholder.investigationNotes': 'Add notes about this investigation...',
    'msg.searching': 'Searching...',
    'msg.typeToSearch': 'Type to search across all pinned sources',
    'msg.noSearchResults': 'No matches found.',
    'msg.searchResultsCount': '{0} match(es) across {1} source(s)',
    'msg.noSourcesPinned': 'No sources pinned yet. Click + Add to pin files.',
    'title.noActiveInvestigation': 'No Active Investigation',
    'msg.noActiveInvestigationDesc': 'Create or open an investigation to pin sessions and files, search across sources, and export bundles.',
    'title.selectSourcesToPin': 'Select files to pin to investigation',
};

/**
 * Localized string lookup. Resolves a symbolic key to its English string,
 * then passes through `vscode.l10n.t()` for translation and argument substitution.
 */
export function t(key: string, ...args: (string | number | boolean)[]): string {
    const message = strings[key] ?? key;
    return args.length > 0
        ? vscode.l10n.t(message, ...args)
        : vscode.l10n.t(message);
}

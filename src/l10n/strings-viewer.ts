/**
 * English strings for HOST-built viewer HTML — keyed by symbolic ID.
 *
 * These are resolved by `t()` directly inside the `/* html *​/` builders
 * (getToolbarHtml, panel shells, …) that run in the extension host during
 * buildViewerHtml. They are NOT shipped into the `__VT` map (that is only for
 * client-side strings — see strings-webview.ts). Kept in their own file so the
 * large extension-host string files (strings-a/strings-b) stay under the
 * 300-line limit as the webview-localization sweep (plan 053) fills this in.
 *
 * Translations go in each `l10n/bundle.l10n.<locale>.json` keyed by the English
 * string; until filled, `t()` returns English (no behavior change).
 */
export const stringsViewer: Record<string, string> = {
    // ── Toolbar (viewer-toolbar-html.ts) ──────────────────────────────
    'viewer.toolbar.label': 'Log viewer toolbar',
    'viewer.toolbar.prevSession.title': 'Navigate to the previous (older) log session',
    'viewer.toolbar.prevSession.label': 'Previous log (older)',
    'viewer.toolbar.sessionPos.title': 'Session position — long-press (hold ~0.5s) to copy session metadata; hover for details when loaded',
    // "Log" and "of" wrap live count spans (Log <n> of <m>); kept as separate
    // labels because the numbers are JS-updated DOM nodes, not template args.
    'viewer.toolbar.sessionLog': 'Log',
    'viewer.toolbar.sessionOf': 'of',
    'viewer.toolbar.nextSession.title': 'Navigate to the next (newer) log session',
    'viewer.toolbar.nextSession.label': 'Next log (newer)',
    'viewer.toolbar.search.title': 'Open search to find text in the current log (Ctrl+F)',
    'viewer.toolbar.search.label': 'Toggle search',
    'viewer.toolbar.searchCount.title': 'Number of search matches',
    'viewer.toolbar.filter.title': 'Open filter drawer to show/hide log levels, streams, and exclusions',
    'viewer.toolbar.filter.label': 'Toggle filter drawer',
    'viewer.toolbar.filterCount.title': 'Number of active filters',
    'viewer.toolbar.signals.title': 'Toggle signals panel',
    'viewer.toolbar.signals.label': 'Toggle signals',
    'viewer.toolbar.signalsCount.title': 'Number of detected signals',
    'viewer.toolbar.deco.title': 'Toggle line decorations on/off',
    'viewer.toolbar.deco.label': 'Toggle decorations',
    'viewer.toolbar.format.title': 'Toggle formatted view for this document (markdown, JSON, CSV)',
    'viewer.toolbar.format.label': 'Toggle formatted view',
    'viewer.toolbar.actions.title': 'Open actions menu for replay, quality report, and export',
    'viewer.toolbar.actions.label': 'Actions menu',
    'viewer.toolbar.levelSummary.label': 'Level filters',
    'viewer.toolbar.levelSummary.title': 'Level filters — click a chip to toggle, double-click to show only that level',
    // Severity aria-labels (the single-letter glyphs E/W/I/… stay as symbolic icons).
    'viewer.level.error': 'Error',
    'viewer.level.warning': 'Warning',
    'viewer.level.info': 'Info',
    'viewer.level.performance': 'Performance',
    'viewer.level.todo': 'TODO',
    'viewer.level.notice': 'Notice',
    'viewer.level.debug': 'Debug',
    'viewer.level.database': 'Database',
    'viewer.toolbar.levelDot.error.title': 'Error — click to toggle, double-click to show only Errors',
    'viewer.toolbar.levelDot.warning.title': 'Warning — click to toggle, double-click to show only Warnings',
    'viewer.toolbar.levelDot.info.title': 'Info — click to toggle, double-click to show only Info',
    'viewer.toolbar.levelDot.performance.title': 'Performance — click to toggle, double-click to show only Perf',
    'viewer.toolbar.levelDot.todo.title': 'TODO — click to toggle, double-click to show only TODOs',
    'viewer.toolbar.levelDot.notice.title': 'Notice — click to toggle, double-click to show only Notices',
    'viewer.toolbar.levelDot.debug.title': 'Debug — click to toggle, double-click to show only Debug',
    'viewer.toolbar.levelDot.database.title': 'Database — click to toggle, double-click to show only Database',
    'viewer.toolbar.levelAll': 'All',
    'viewer.toolbar.levelTrigger.title': 'Level filter summary — click to open filter drawer',
    'viewer.toolbar.lineCount.title': 'Total number of lines in the current log',
    'viewer.toolbar.hiddenCounter.title': 'Lines hidden by active filters — click to peek, double-click to manage',
    'viewer.toolbar.hiddenCounter.label': 'Hidden lines counter',
    'viewer.toolbar.selection.title': 'Number of currently selected lines',
    'viewer.toolbar.perfChip.title': 'Performance data available — click to open the Signals panel',
    'viewer.toolbar.perfChip.label': 'Performance data available',
    'viewer.toolbar.perfChip.text': 'Performance',
    'viewer.toolbar.sessionDetails.label': 'Log context',
    'viewer.toolbar.sessionDetails.title': 'Log session context and metadata',
    'viewer.toolbar.filename.title': 'Log file — click the name for actions (open in editor, folder, copy path). Press F1 in the viewer (default) for the shortcut list.',
};

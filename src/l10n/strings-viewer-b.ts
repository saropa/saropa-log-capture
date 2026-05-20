/**
 * English strings for HOST-built viewer HTML — part B (continuation of
 * strings-viewer.ts; split to stay under the 300-line file limit). Covers the
 * icon bar, body banners/breadcrumb, and the side panels.
 *
 * Resolved by t() in the `/* html *​/` builders; globbed into the translate
 * pipeline via extract_all_source_strings(). See strings-viewer.ts header.
 */
export const stringsViewerB: Record<string, string> = {
    // ── Icon bar (viewer-icon-bar-html.ts) ───────────────────────────
    'viewer.iconBar.toolbar.label': 'Log viewer tools',
    'viewer.iconBar.toolbar.title': 'Click bar to show or hide icon labels',
    'viewer.iconBar.sessions.title': 'Click to open/close — browse and switch between log sessions in this project',
    'viewer.iconBar.sessions.label': 'Logs',
    'viewer.iconBar.sessions.text': 'Logs',
    'viewer.iconBar.find.title': 'Click to open/close — search across all log files in this project (Ctrl+Shift+F)',
    'viewer.iconBar.find.label': 'Find in Files (Ctrl+Shift+F)',
    'viewer.iconBar.find.text': 'Find in Files',
    'viewer.iconBar.signal.title': 'Click to open/close — signals, errors, warnings, and performance analysis',
    'viewer.iconBar.signal.label': 'Signals',
    'viewer.iconBar.signal.text': 'Signals',
    'viewer.iconBar.sqlHistory.title': 'Click to open/close — browse SQL queries captured during this session',
    'viewer.iconBar.sqlHistory.label': 'SQL Query History',
    'viewer.iconBar.sqlHistory.text': 'SQL History',
    'viewer.iconBar.crashlytics.title': 'Click to open/close — Firebase Crashlytics crash reports',
    'viewer.iconBar.crashlytics.label': 'Crashlytics',
    'viewer.iconBar.crashlytics.text': 'Crashlytics',
    'viewer.iconBar.collections.title': 'Click to open/close — group related log sessions and files into named collections',
    'viewer.iconBar.collections.label': 'Collections',
    'viewer.iconBar.collections.text': 'Collections',
    'viewer.iconBar.bookmarks.title': 'Click to open/close — view and manage bookmarked log lines',
    'viewer.iconBar.bookmarks.label': 'Bookmarks',
    'viewer.iconBar.bookmarks.text': 'Bookmarks',
    'viewer.iconBar.trash.title': 'Click to open/close — view and restore deleted log sessions',
    'viewer.iconBar.trash.label': 'Trash',
    'viewer.iconBar.trash.text': 'Trash',
    'viewer.iconBar.options.title': 'Click to open/close — display, layout, and audio settings',
    'viewer.iconBar.options.label': 'Options',
    'viewer.iconBar.options.text': 'Options',
    'viewer.iconBar.about.title': 'Click to open/close — version info, links, and help',
    'viewer.iconBar.about.label': 'About Saropa',
    'viewer.iconBar.about.text': 'About',

    // ── Body banners + breadcrumb (viewer-content-body.ts) ────────────
    'viewer.compressBanner.msg': 'Many identical lines in a row — try {0} (Options → Layout or right-click → Options).',
    'viewer.compressBanner.boldTerm': 'Compress lines',
    'viewer.compressBanner.enable': 'Enable',
    'viewer.compressBanner.dismiss': 'Dismiss',
    'viewer.resumeBanner.msg': 'Loaded latest log.',
    'viewer.resumeBanner.btn.title': 'Open last viewed session',
    'viewer.resumeBanner.dismiss': 'Dismiss',
    'viewer.split.prev.title': 'Previous part',
    'viewer.split.prev.label': 'Previous part',
    'viewer.split.part': 'Part',
    'viewer.split.of': 'of',
    'viewer.split.next.title': 'Next part',
    'viewer.split.next.label': 'Next part',
    'viewer.rootCause.region': 'Hypotheses',
    'viewer.logContent.region': 'Log content',
    'viewer.logContent.title': 'Right-click a line for actions (copy, filters, source). Long-press "Log N of M" in the toolbar to copy session metadata.',
    'viewer.jumpTop.title': 'Scroll to top',
    'viewer.jumpTop.text': 'Top',
    'viewer.jumpBottom.title': 'Scroll to bottom',
    'viewer.jumpBottom.text': 'Bottom',
    'viewer.copyFloat.title': 'Copy line',
    'viewer.copyFloat.label': 'Copy line',
};

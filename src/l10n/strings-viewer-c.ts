/**
 * English strings for HOST-built viewer HTML — part C (continuation of
 * strings-viewer-b.ts; split to stay under the 300-line file limit). Covers the
 * remaining side panels (trash, …).
 *
 * Resolved by t() in the `/* html *​/` builders; globbed into the translate
 * pipeline via extract_all_source_strings(). See strings-viewer.ts header.
 */
export const stringsViewerC: Record<string, string> = {
    // ── Trash panel — host HTML (viewer-trash-panel.ts) ───────────────
    'viewer.trash.region': 'Trash',
    'viewer.trash.header': 'Trash',
    'viewer.trash.emptyAll': 'Empty Trash',
    'viewer.trash.close.title': 'Close',
    'viewer.trash.close.label': 'Close Trash',
    'viewer.trash.empty': 'No trashed sessions',

    // ── Collections panel — host HTML (viewer-collections-panel.ts) ───
    'viewer.collections.region': 'Collections',
    'viewer.collections.header': 'Collections',
    'viewer.collections.close.title': 'Close',
    'viewer.collections.close.label': 'Close Collections',
    'viewer.collections.explainerTitle': 'What are Collections?',
    'viewer.collections.explainerDismiss.title': 'Dismiss',
    'viewer.collections.explainerDismiss.label': 'Dismiss explainer',
    'viewer.collections.explainerBody': 'Group related log sessions and files together for a bug, feature, or incident. Right-click on a log and choose "Add to Collection" to get started.',
    'viewer.collections.mergeBtn': 'Merge two collections…',
    'viewer.collections.mergeSource': 'Source (will be deleted):',
    'viewer.collections.mergeTarget': 'Target (will keep its name):',
    'viewer.collections.mergeConfirm': 'Merge',
    'viewer.collections.mergeCancel': 'Cancel',
    'viewer.collections.loading': 'Loading…',

    // ── About panel — UI chrome only (viewer-about-panel.ts).
    // Taglines, product blurbs, and link titles/badges/descriptions are brand /
    // marketing copy and proper nouns — left English by design (not auto-translated).
    'viewer.about.region': 'About Saropa',
    'viewer.about.close.title': 'Close',
    'viewer.about.close.label': 'Close About',
    'viewer.about.copyHint': 'Press and hold to copy',
    'viewer.about.recentChanges': 'Recent changes',
    'viewer.about.fullChangelog': 'Full changelog on Marketplace',
    'viewer.about.projects': 'Projects',
    'viewer.about.connect': 'Connect',

    // ── Crashlytics panel — host shell (panels/viewer-crashlytics-panel.ts) ─
    'viewer.crashlytics.region': 'Crashlytics',
    'viewer.crashlytics.refresh.title': 'Refresh',
    'viewer.crashlytics.refresh.label': 'Refresh Crashlytics',
    'viewer.crashlytics.close.title': 'Close',
    'viewer.crashlytics.close.label': 'Close Crashlytics',
    'viewer.crashlytics.loading': 'Loading Crashlytics data…',
    'viewer.crashlytics.empty': 'No open Crashlytics issues',
    'viewer.crashlytics.help': 'Help',

    // ── SQL Query History panel — host HTML (viewer-sql-query-history-panel-html.ts) ─
    'viewer.sqlHistory.header': 'SQL Query History',
    'viewer.sqlHistory.openViewer.title': 'Open Drift debug viewer in system browser (full window)',
    'viewer.sqlHistory.copy.title': 'Copy visible rows as JSON',
    'viewer.sqlHistory.close.title': 'Close',
    'viewer.sqlHistory.search.placeholder': 'Filter by fingerprint or preview…',
    'viewer.sqlHistory.cumulative.title': 'Aggregate SQL fingerprints across every sidebar log (excludes the active log to avoid double-counting). Cross-log rows show the fingerprint only — readable SQL text comes in Step 2.',
    'viewer.sqlHistory.cumulative.label': 'Cumulative across logs',
    'viewer.sqlHistory.col.count': 'Count',
    'viewer.sqlHistory.col.sql': 'SQL',
    'viewer.sqlHistory.col.slow': 'Slow',
    'viewer.sqlHistory.col.slow.title': 'Slowest duration in milliseconds',
    'viewer.sqlHistory.empty': 'No parsed SQL fingerprints in this session yet.',
};

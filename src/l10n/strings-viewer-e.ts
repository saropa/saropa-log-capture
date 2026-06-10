/**
 * English strings for HOST-built viewer HTML — part E. Covers the export modal,
 * the integrations/companion panel, and the keyboard-shortcuts reference.
 *
 * Resolved by t() in the `/* html *​/` builders; globbed into the translate
 * pipeline via extract_all_source_strings(). See strings-viewer.ts header.
 * Level names and option labels are user-facing UI filters (translated); the
 * emoji glyphs and technical acronyms inside them stay literal / shielded.
 */
export const stringsViewerE: Record<string, string> = {
    // ── Export modal — host HTML (viewer-export-html.ts) ──────────────
    'viewer.export.title': 'Export Logs',
    'viewer.export.close': 'Close',
    'viewer.export.template': 'Export Template',
    'viewer.export.template.custom': 'Custom Selection',
    'viewer.export.template.errorsOnly': 'Errors Only',
    'viewer.export.template.warningsErrors': 'Warnings + Errors',
    'viewer.export.template.production': 'Production Ready (no debug)',
    'viewer.export.template.fullDebug': 'Full Debug (all levels)',
    'viewer.export.template.performance': 'Performance Analysis',
    'viewer.export.includeLevels': 'Include Levels',
    'viewer.export.level.error': 'Error',
    'viewer.export.level.warning': 'Warning',
    'viewer.export.level.info': 'Info',
    'viewer.export.level.performance': 'Performance',
    'viewer.export.level.todo': 'TODO/FIXME',
    'viewer.export.level.notice': 'Notice',
    'viewer.export.level.debug': 'Debug/Trace',
    'viewer.export.level.database': 'Database',
    'viewer.export.options': 'Export Options',
    'viewer.export.opt.timestamps': 'Include timestamps',
    'viewer.export.opt.decorations': 'Include decorations (counter, severity)',
    'viewer.export.opt.stripAnsi': 'Strip ANSI codes (plain text)',
    'viewer.export.preview': 'Preview',
    'viewer.export.willBeExported': 'will be exported',
    'viewer.export.quickSave': 'Quick Save',
    'viewer.export.quickSave.title': 'Save current view as-is to the reports folder (no extra filtering)',
    'viewer.export.cancel': 'Cancel',
    'viewer.export.confirm': 'Export to File',
};

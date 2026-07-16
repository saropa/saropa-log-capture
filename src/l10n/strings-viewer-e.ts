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

    // ── Integrations panel — host HTML (viewer-integrations-panel-html.ts) ──
    // Per-adapter metadata (label / descriptionLong / performanceNote /
    // whenToDisable) comes from INTEGRATION_ADAPTERS in integrations-ui.ts and
    // is localized there, not here.
    'viewer.integrations.region': 'Integrations',
    'viewer.integrations.back': 'Back to Options',
    'viewer.integrations.intro': 'Choose session capture adapters (header lines and sidecars), third-party tools (Crashlytics, Drift, etc.), and in-editor features like Explain with AI. Each row notes performance impact and when you might turn it off.',
    'viewer.integrations.searchPlaceholder': 'Search integrations…',
    'viewer.integrations.searchLabel': 'Search integrations',
    'viewer.integrations.installSuite': 'Install all with the Saropa Suite extension pack',
    'viewer.integrations.companionInstalled': 'Installed — manage from the Extensions view',
    'viewer.integrations.companionInstallAction': 'Install {0}',
    'viewer.integrations.companionInstalling': 'Installing {0}…',
    'viewer.integrations.companionInstallDone': '{0} installed',
    'viewer.integrations.companionInstallFailed': 'Could not install {0}',
    'viewer.integrations.viewInMarketplace': 'View in Marketplace',
    'viewer.integrations.suggestHeading': 'Suggested for your project',
    'viewer.integrations.suggestReason': 'Your project uses {0}',
    'viewer.integrations.suggestEnable': 'Enable',
    'viewer.integrations.perfWarningLabel': 'Performance warning',
    'viewer.integrations.perfLabel': 'Performance:',
    'viewer.integrations.whenToDisable': 'When to disable:',
    'viewer.integrations.more': 'more',
    'viewer.integrations.companion.lints.benefit': 'Lint violations in bug reports, OWASP summaries, health scores, and one-click Explain Rule.',
    'viewer.integrations.companion.drift.benefit': 'Query stats, schema health, anomaly counts, index suggestions, and Open in Drift Advisor.',
};

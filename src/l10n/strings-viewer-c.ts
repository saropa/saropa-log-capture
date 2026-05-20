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
};

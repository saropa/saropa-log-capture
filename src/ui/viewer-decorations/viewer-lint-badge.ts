/**
 * Lint diagnostic badge for log lines referencing files with active VS Code diagnostics.
 * Shows a small coloured badge (red for errors, amber for warnings) with the count
 * when the `decoShowLintBadges` sub-toggle is enabled.
 *
 * Also handles live `updateLintData` messages that patch lint counts on existing
 * line items when diagnostics change in the editor.
 *
 * Concatenated into the same script scope as viewer-decorations.ts.
 */

/** Returns the JavaScript code for lint diagnostic badge rendering. */
export function getLintBadgeScript(): string {
    return /* javascript */ `
/** Sub-toggle: show lint diagnostic badges on log lines. Off by default. */
var decoShowLintBadges = false;

/** Copy lint counts from a PendingLine message onto the most recently added line item. */
function applyLintDataToLastLine(ln) {
    if (!ln.lintErrors && !ln.lintWarnings) return;
    var last = allLines[allLines.length - 1];
    if (last) { last.lintErrors = ln.lintErrors || 0; last.lintWarnings = ln.lintWarnings || 0; }
}

/**
 * Return a lint badge HTML string for the given line item.
 * Only rendered when decorations and the lint sub-toggle are on,
 * and the item has lintErrors or lintWarnings > 0.
 */
function getLintBadge(item) {
    if (!showDecorations || !decoShowLintBadges) return '';
    var e = item.lintErrors || 0;
    var w = item.lintWarnings || 0;
    if (e === 0 && w === 0) return '';
    var parts = [];
    if (e > 0) parts.push(e + (e > 1 ? ' errors' : ' error'));
    if (w > 0) parts.push(w + (w > 1 ? ' warnings' : ' warning'));
    var tip = 'Diagnostics: ' + parts.join(', ');
    var cls = e > 0 ? 'lint-badge-error' : 'lint-badge-warning';
    var label = e > 0 ? e : w;
    var icon = e > 0 ? '\\u26a0' : '\\u25b3';
    return '<span class="lint-badge ' + cls + '" title="' + tip + '">' + icon + '\\u2009' + label + '</span> ';
}

/**
 * Handle updateLintData message from the extension.
 * Patches lintErrors/lintWarnings on existing line items for files whose
 * diagnostics changed, then re-renders the viewport.
 *
 * msg.fileUpdates: Record<fsPath, Record<lineNumber, { errors, warnings }>>
 */
function handleUpdateLintData(msg) {
    var updates = msg.fileUpdates;
    if (!updates) return;
    var changed = false;
    for (var i = 0; i < allLines.length; i++) {
        var item = allLines[i];
        if (!item.sourcePath) continue;
        var fileData = updates[item.sourcePath];
        if (!fileData) continue;
        changed = patchItemLintData(item, fileData) || changed;
    }
    if (changed && typeof renderViewport === 'function') renderViewport(true);
}

/** Patch lint counts on a single item from file-level update data. */
function patchItemLintData(item, fileData) {
    var ref = (typeof extractSourceLineFromHtml === 'function')
        ? extractSourceLineFromHtml(item.html)
        : undefined;
    if (!ref) return false;
    var lineSummary = fileData[ref];
    if (lineSummary) {
        var newE = lineSummary.errors || 0;
        var newW = lineSummary.warnings || 0;
        if (item.lintErrors !== newE || item.lintWarnings !== newW) {
            item.lintErrors = newE;
            item.lintWarnings = newW;
            return true;
        }
    } else if (item.lintErrors || item.lintWarnings) {
        item.lintErrors = 0;
        item.lintWarnings = 0;
        return true;
    }
    return false;
}

/**
 * Extract the line number from a source-link anchor in the item's HTML.
 * Returns the 1-based line number or undefined if no source link found.
 */
function extractSourceLineFromHtml(html) {
    if (!html) return undefined;
    var m = html.match(/data-line="(\\d+)"/);
    return m ? parseInt(m[1], 10) : undefined;
}
`;
}

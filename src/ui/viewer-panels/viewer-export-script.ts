/**
 * JavaScript code for the export modal.
 *
 * Handles export template selection, level filtering, UI state sync,
 * and performs the export operation with user-selected options.
 */
import { getExportInitScript } from './viewer-export-init';

/** Returns the JavaScript code for export functionality in the webview. */
export function getExportScript(): string {
    return /* javascript */ `
/** Export modal element. */
var exportModalEl = null;

/** Current export level selection. */
var exportLevels = new Set(['error', 'warning', 'info']);

/** Export templates with predefined level selections. */
var exportTemplates = {
    'errors-only': new Set(['error']),
    'warnings-errors': new Set(['error', 'warning']),
    'production': new Set(['error', 'warning', 'info', 'notice']),
    'full-debug': new Set(['error', 'warning', 'info', 'performance', 'notice', 'todo', 'debug']),
    'performance': new Set(['error', 'warning', 'performance']),
    'custom': new Set(['error', 'warning', 'info'])
};

/** Export options. */
var exportOptions = {
    includeTimestamps: true,
    includeDecorations: false,
    stripAnsi: true
};

${getExportInitScript()}

/**
 * Open the export modal, seeded from the viewer's current level filter.
 */
function openExportModal() {
    if (!exportModalEl) return;

    // Seed from the viewer's active level filter
    if (typeof enabledLevels !== 'undefined' && enabledLevels.size > 0) {
        exportLevels = new Set(enabledLevels);
    }

    syncExportModalUi();
    updateExportPreview();
    updateExportSummaries();
    exportModalEl.classList.add('visible');
}
window.openExportModal = openExportModal;

/**
 * Close the export modal.
 */
function closeExportModal() {
    if (!exportModalEl) return;
    exportModalEl.classList.remove('visible');
}

/**
 * Apply an export template to level checkboxes.
 */
function applyExportTemplate(templateName) {
    var template = exportTemplates[templateName];
    if (!template) return;

    // Update exportLevels from template
    exportLevels = new Set(template);

    // Update UI
    var levels = ['error', 'warning', 'info', 'performance', 'notice', 'todo', 'debug'];
    for (var i = 0; i < levels.length; i++) {
        var checkbox = document.getElementById('export-level-' + levels[i]);
        if (checkbox) {
            checkbox.checked = exportLevels.has(levels[i]);
        }
    }

    updateExportPreview();
    updateExportSummaries();
}

/**
 * Resolve the template dropdown to match the current exportLevels, or 'custom'.
 */
function resolveTemplateDropdown() {
    var templateSelect = document.getElementById('export-template');
    if (!templateSelect) return;
    for (var key in exportTemplates) {
        if (setsEqual(exportLevels, exportTemplates[key])) {
            templateSelect.value = key;
            return;
        }
    }
    templateSelect.value = 'custom';
}

/**
 * Update exportLevels from checkbox states.
 */
function updateExportLevels() {
    exportLevels = new Set();
    var levels = ['error', 'warning', 'info', 'performance', 'notice', 'todo', 'debug'];
    for (var i = 0; i < levels.length; i++) {
        var checkbox = document.getElementById('export-level-' + levels[i]);
        if (checkbox && checkbox.checked) {
            exportLevels.add(levels[i]);
        }
    }
    resolveTemplateDropdown();
}

/**
 * Check if two sets are equal.
 */
function setsEqual(setA, setB) {
    if (setA.size !== setB.size) return false;
    var arr = Array.from(setA);
    for (var i = 0; i < arr.length; i++) {
        if (!setB.has(arr[i])) return false;
    }
    return true;
}

/**
 * Update the export preview count.
 */
function updateExportPreview() {
    var count = 0;
    for (var i = 0; i < allLines.length; i++) {
        var line = allLines[i];
        if (line.type === 'marker') continue;
        if (line.excluded) continue;
        if (line.levelFiltered) continue;
        if (!exportLevels.has(line.level)) continue;
        count++;
    }

    var preview = document.getElementById('export-line-count');
    if (preview) {
        preview.textContent = count + ' line' + (count === 1 ? '' : 's');
    }
}

/**
 * Sync export modal UI from current state.
 */
function syncExportModalUi() {
    // Sync level checkboxes
    var levels = ['error', 'warning', 'info', 'performance', 'notice', 'todo', 'debug'];
    for (var i = 0; i < levels.length; i++) {
        var checkbox = document.getElementById('export-level-' + levels[i]);
        if (checkbox) {
            checkbox.checked = exportLevels.has(levels[i]);
        }
    }

    resolveTemplateDropdown();

    // Sync options
    var tsCheck = document.getElementById('export-include-timestamps');
    var decoCheck = document.getElementById('export-include-decorations');
    var ansiCheck = document.getElementById('export-strip-ansi');
    if (tsCheck) tsCheck.checked = exportOptions.includeTimestamps;
    if (decoCheck) decoCheck.checked = exportOptions.includeDecorations;
    if (ansiCheck) ansiCheck.checked = exportOptions.stripAnsi;
}

/**
 * Update accordion summary counts for levels and options sections.
 */
function updateExportSummaries() {
    var levelSummary = document.getElementById('export-levels-summary');
    if (levelSummary) {
        levelSummary.textContent = exportLevels.size + '/7';
    }

    var optSummary = document.getElementById('export-options-summary');
    if (optSummary) {
        var count = 0;
        if (exportOptions.includeTimestamps) count++;
        if (exportOptions.includeDecorations) count++;
        if (exportOptions.stripAnsi) count++;
        optSummary.textContent = count + '/3';
    }
}

/**
 * Perform the export operation.
 */
function performExport() {
    var lines = [];

    // Collect lines matching export criteria
    for (var i = 0; i < allLines.length; i++) {
        var line = allLines[i];
        if (line.type === 'marker') continue;
        if (line.excluded) continue;
        if (line.levelFiltered) continue;
        if (!exportLevels.has(line.level)) continue;

        var text = stripTags(line.html || '');

        // Strip decorations if needed
        if (!exportOptions.includeDecorations) {
            // Remove counter, timestamp, severity dot, etc.
            text = text.replace(/^\\s*[🔴🟠🟢🟣⚪🟤🟦🔵]?\\s*#\\d+\\s*/, '');
            text = text.replace(/^\\s*\\d{2}:\\d{2}:\\d{2}(\\.\\d{3})?\\s*/, '');
            text = text.replace(/^\\s*\\[\\+\\d+(\\.\\d+)?[smh]\\]\\s*/, '');
        }

        lines.push(text);
    }

    if (lines.length === 0) {
        vscodeApi.postMessage({
            type: 'showMessage',
            level: 'warning',
            message: 'No lines match the selected export criteria.'
        });
        return;
    }

    var exportText = lines.join('\\n');

    // Send export request to extension
    vscodeApi.postMessage({
        type: 'exportLogs',
        text: exportText,
        options: {
            levels: Array.from(exportLevels),
            stripAnsi: exportOptions.stripAnsi,
            includeTimestamps: exportOptions.includeTimestamps,
            includeDecorations: exportOptions.includeDecorations,
            lineCount: lines.length
        }
    });

    closeExportModal();
}

/**
 * Quick-save the current view as-is (no extra filtering) to the reports folder.
 */
function performQuickExport() {
    var lines = [];
    var totalLines = 0;
    var levelCounts = {};

    for (var i = 0; i < allLines.length; i++) {
        var item = allLines[i];
        if (item.type === 'marker') continue;
        totalLines++;
        if (calcItemHeight(item) <= 0) continue;

        var text = stripTags(item.html || '');
        lines.push(text);
        var lvl = item.level || 'info';
        levelCounts[lvl] = (levelCounts[lvl] || 0) + 1;
    }

    if (lines.length === 0) {
        vscodeApi.postMessage({
            type: 'showMessage',
            level: 'warning',
            message: 'No visible lines to export.'
        });
        return;
    }

    // Gather active filter metadata
    var searchEl = document.getElementById('search-input');
    var searchTerm = searchEl ? searchEl.value.trim() : '';

    vscodeApi.postMessage({
        type: 'quickExportLogs',
        lines: lines,
        metadata: {
            sourceFile: currentFilename || '(unknown)',
            totalLines: totalLines,
            visibleLines: lines.length,
            enabledLevels: typeof enabledLevels !== 'undefined' ? Array.from(enabledLevels) : [],
            appOnly: typeof appOnlyMode !== 'undefined' && appOnlyMode,
            exclusionsActive: typeof exclusionsEnabled !== 'undefined' && exclusionsEnabled,
            searchTerm: searchTerm,
            levelCounts: levelCounts
        }
    });

    closeExportModal();
}

`;
}

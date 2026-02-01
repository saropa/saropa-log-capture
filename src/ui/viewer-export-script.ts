/**
 * JavaScript code for the export modal.
 *
 * Handles export template selection, level filtering, UI state sync,
 * and performs the export operation with user-selected options.
 */

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

/**
 * Initialize the export modal.
 */
function initExportModal() {
    exportModalEl = document.getElementById('export-modal');
    if (!exportModalEl) return;

    // Close button
    var closeBtn = exportModalEl.querySelector('.modal-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', closeExportModal);
    }

    // Cancel button
    var cancelBtn = document.getElementById('export-cancel-btn');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', closeExportModal);
    }

    // Export button
    var exportBtn = document.getElementById('export-confirm-btn');
    if (exportBtn) {
        exportBtn.addEventListener('click', performExport);
    }

    // Template selector
    var templateSelect = document.getElementById('export-template');
    if (templateSelect) {
        templateSelect.addEventListener('change', function(e) {
            applyExportTemplate(e.target.value);
        });
    }

    // Level checkboxes
    var levels = ['error', 'warning', 'info', 'performance', 'notice', 'todo', 'debug'];
    for (var i = 0; i < levels.length; i++) {
        var checkbox = document.getElementById('export-level-' + levels[i]);
        if (checkbox) {
            checkbox.addEventListener('change', function() {
                updateExportLevels();
                updateExportPreview();
            });
        }
    }

    // Option checkboxes
    var tsCheck = document.getElementById('export-include-timestamps');
    var decoCheck = document.getElementById('export-include-decorations');
    var ansiCheck = document.getElementById('export-strip-ansi');
    if (tsCheck) {
        tsCheck.addEventListener('change', function(e) {
            exportOptions.includeTimestamps = e.target.checked;
            updateExportPreview();
        });
    }
    if (decoCheck) {
        decoCheck.addEventListener('change', function(e) {
            exportOptions.includeDecorations = e.target.checked;
            updateExportPreview();
        });
    }
    if (ansiCheck) {
        ansiCheck.addEventListener('change', function(e) {
            exportOptions.stripAnsi = e.target.checked;
        });
    }

    // Click outside to close
    exportModalEl.addEventListener('click', function(e) {
        if (e.target === exportModalEl) {
            closeExportModal();
        }
    });
}

/**
 * Open the export modal.
 */
function openExportModal() {
    if (!exportModalEl) return;
    syncExportModalUi();
    updateExportPreview();
    exportModalEl.classList.add('visible');
}

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

    // Update template selector to "custom" if manual change
    var templateSelect = document.getElementById('export-template');
    if (templateSelect) {
        var matchesTemplate = false;
        for (var key in exportTemplates) {
            if (setsEqual(exportLevels, exportTemplates[key])) {
                templateSelect.value = key;
                matchesTemplate = true;
                break;
            }
        }
        if (!matchesTemplate) {
            templateSelect.value = 'custom';
        }
    }
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

    // Sync options
    var tsCheck = document.getElementById('export-include-timestamps');
    var decoCheck = document.getElementById('export-include-decorations');
    var ansiCheck = document.getElementById('export-strip-ansi');
    if (tsCheck) tsCheck.checked = exportOptions.includeTimestamps;
    if (decoCheck) decoCheck.checked = exportOptions.includeDecorations;
    if (ansiCheck) ansiCheck.checked = exportOptions.stripAnsi;
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

// Initialize export modal on load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initExportModal);
} else {
    initExportModal();
}

// Export button click handler
var exportBtn = document.getElementById('export-btn');
if (exportBtn) {
    exportBtn.addEventListener('click', openExportModal);
}
`;
}

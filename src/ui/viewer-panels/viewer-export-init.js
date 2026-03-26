"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getExportInitScript = getExportInitScript;
/** Returns the JavaScript code for export modal initialization and wiring. */
function getExportInitScript() {
    return /* javascript */ `
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

// Initialize export modal on load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initExportModal);
} else {
    initExportModal();
}
`;
}
//# sourceMappingURL=viewer-export-init.js.map
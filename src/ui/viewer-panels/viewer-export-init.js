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

    // Quick Save button
    var quickSaveBtn = document.getElementById('export-quick-save-btn');
    if (quickSaveBtn) {
        quickSaveBtn.addEventListener('click', performQuickExport);
    }

    // Template selector
    var templateSelect = document.getElementById('export-template');
    if (templateSelect) {
        templateSelect.addEventListener('change', function(e) {
            applyExportTemplate(e.target.value);
        });
    }

    // Level checkboxes
    var levels = ['error', 'warning', 'info', 'performance', 'notice', 'todo', 'debug', 'database'];
    for (var i = 0; i < levels.length; i++) {
        var checkbox = document.getElementById('export-level-' + levels[i]);
        if (checkbox) {
            checkbox.addEventListener('change', function() {
                updateExportLevels();
                updateExportPreview();
                updateExportSummaries();
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
            updateExportSummaries();
        });
    }
    if (decoCheck) {
        decoCheck.addEventListener('change', function(e) {
            exportOptions.includeDecorations = e.target.checked;
            updateExportPreview();
            updateExportSummaries();
        });
    }
    if (ansiCheck) {
        ansiCheck.addEventListener('change', function(e) {
            exportOptions.stripAnsi = e.target.checked;
            updateExportSummaries();
        });
    }

    // Export accordion toggle
    var exportAccHeaders = exportModalEl.querySelectorAll('.export-accordion-header');
    for (var i = 0; i < exportAccHeaders.length; i++) {
        exportAccHeaders[i].addEventListener('click', function(e) {
            var header = e.currentTarget;
            var section = header.parentElement;
            if (!section) return;
            var isExpanded = section.classList.contains('expanded');
            if (isExpanded) {
                section.classList.remove('expanded');
                header.setAttribute('aria-expanded', 'false');
            } else {
                section.classList.add('expanded');
                header.setAttribute('aria-expanded', 'true');
            }
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
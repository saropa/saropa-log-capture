/** Returns the JavaScript code for export modal initialization and wiring. */
export function getExportInitScript(): string {
    return /* javascript */ `
/**
 * Initialize the export modal.
 *
 * bug_029 (Fixed): Escape-to-close and the Tab focus trap below were originally
 * factored into a separate bindExportModalKeyboardHandlers() function but nothing ever
 * called it — the two keydown listeners were duplicated inline in this function
 * instead, leaving the extracted function dead. Deleted the dead function and kept
 * only the inline listeners (the ones actually wired up on load).
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
    var levels = ['error', 'warning', 'info', 'performance', 'todo', 'notice', 'debug', 'database'];
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

    // bug_029: Escape closes the modal (matches viewer-log-file-modal.ts) — without this
    // the export dialog trapped keyboard users with no way out except mouse-clicking Cancel.
    document.addEventListener('keydown', function(e) {
        if (e.key !== 'Escape' || !exportModalEl.classList.contains('visible')) return;
        e.preventDefault();
        closeExportModal();
    });

    // bug_029: focus trap — Tab/Shift+Tab wraps within the dialog's focusable elements
    // instead of escaping into the hidden viewer behind it, per WAI-ARIA modal-dialog
    // practice (an aria-modal="true" region must not leak Tab focus outside itself).
    document.addEventListener('keydown', function(e) {
        if (e.key !== 'Tab' || !exportModalEl.classList.contains('visible')) return;
        var focusable = exportModalEl.querySelectorAll(
            'button, select, input, a[href], [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        var first = focusable[0];
        var last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
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

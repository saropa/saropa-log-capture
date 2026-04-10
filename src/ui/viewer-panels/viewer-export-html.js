"use strict";
/**
 * HTML template for the export modal.
 *
 * Provides level-based filtering and preset templates for exporting logs:
 * - Errors Only: Only error-level messages
 * - Full Debug: All levels including debug/trace
 * - Production Ready: Info, warnings, errors (no debug/trace)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getExportModalHtml = getExportModalHtml;
/** Returns the HTML for the export modal element. */
function getExportModalHtml() {
    return `<div id="export-modal" class="modal">
    <div class="modal-content">
        <div class="modal-header">
            <span>Export Logs</span>
            <button class="modal-close" title="Close">&times;</button>
        </div>
        <div class="modal-body">
            <div class="export-section">
                <h4>Export Template</h4>
                <select id="export-template">
                    <option value="custom">Custom Selection</option>
                    <option value="errors-only">Errors Only</option>
                    <option value="warnings-errors">Warnings + Errors</option>
                    <option value="production">Production Ready (no debug)</option>
                    <option value="full-debug">Full Debug (all levels)</option>
                    <option value="performance">Performance Analysis</option>
                </select>
            </div>

            <div class="export-accordion expanded" id="export-levels-section">
                <button type="button" class="export-accordion-header" aria-expanded="true">
                    <span class="export-accordion-arrow codicon codicon-chevron-right"></span>
                    <span class="export-accordion-title">Include Levels</span>
                    <span class="export-accordion-summary" id="export-levels-summary"></span>
                </button>
                <div class="export-accordion-body">
                    <label class="export-checkbox">
                        <input type="checkbox" id="export-level-error" checked />
                        <span>🔴 Error</span>
                    </label>
                    <label class="export-checkbox">
                        <input type="checkbox" id="export-level-warning" checked />
                        <span>🟠 Warning</span>
                    </label>
                    <label class="export-checkbox">
                        <input type="checkbox" id="export-level-info" checked />
                        <span>🟢 Info</span>
                    </label>
                    <label class="export-checkbox">
                        <input type="checkbox" id="export-level-performance" />
                        <span>🟣 Performance</span>
                    </label>
                    <label class="export-checkbox">
                        <input type="checkbox" id="export-level-notice" />
                        <span>🟦 Notice</span>
                    </label>
                    <label class="export-checkbox">
                        <input type="checkbox" id="export-level-todo" />
                        <span>⚪ TODO/FIXME</span>
                    </label>
                    <label class="export-checkbox">
                        <input type="checkbox" id="export-level-debug" />
                        <span>🟤 Debug/Trace</span>
                    </label>
                    <label class="export-checkbox">
                        <input type="checkbox" id="export-level-database" />
                        <span>🟡 Database</span>
                    </label>
                </div>
            </div>

            <div class="export-accordion expanded" id="export-options-section">
                <button type="button" class="export-accordion-header" aria-expanded="true">
                    <span class="export-accordion-arrow codicon codicon-chevron-right"></span>
                    <span class="export-accordion-title">Export Options</span>
                    <span class="export-accordion-summary" id="export-options-summary"></span>
                </button>
                <div class="export-accordion-body">
                    <label class="export-checkbox">
                        <input type="checkbox" id="export-include-timestamps" checked />
                        <span>Include timestamps</span>
                    </label>
                    <label class="export-checkbox">
                        <input type="checkbox" id="export-include-decorations" />
                        <span>Include decorations (counter, severity)</span>
                    </label>
                    <label class="export-checkbox">
                        <input type="checkbox" id="export-strip-ansi" checked />
                        <span>Strip ANSI codes (plain text)</span>
                    </label>
                </div>
            </div>

            <div class="export-section">
                <h4>Preview</h4>
                <div id="export-preview">
                    <span id="export-line-count">0 lines</span> will be exported
                </div>
            </div>
        </div>
        <div class="modal-footer">
            <button id="export-quick-save-btn" class="modal-btn" title="Save current view as-is to the reports folder (no extra filtering)">Quick Save</button>
            <span class="modal-footer-spacer"></span>
            <button id="export-cancel-btn" class="modal-btn">Cancel</button>
            <button id="export-confirm-btn" class="modal-btn modal-btn-primary">Export to File</button>
        </div>
    </div>
</div>`;
}
//# sourceMappingURL=viewer-export-html.js.map
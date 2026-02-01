/**
 * HTML template for the export modal.
 *
 * Provides level-based filtering and preset templates for exporting logs:
 * - Errors Only: Only error-level messages
 * - Full Debug: All levels including debug/trace
 * - Production Ready: Info, warnings, errors (no debug/trace)
 */

/** Returns the HTML for the export modal element. */
export function getExportModalHtml(): string {
    return `<div id="export-modal" class="modal">
    <div class="modal-content">
        <div class="modal-header">
            <span>Export Logs</span>
            <button class="modal-close">&times;</button>
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

            <div class="export-section">
                <h4>Include Levels</h4>
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
            </div>

            <div class="export-section">
                <h4>Export Options</h4>
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

            <div class="export-section">
                <h4>Preview</h4>
                <div id="export-preview">
                    <span id="export-line-count">0 lines</span> will be exported
                </div>
            </div>
        </div>
        <div class="modal-footer">
            <button id="export-cancel-btn" class="modal-btn">Cancel</button>
            <button id="export-confirm-btn" class="modal-btn modal-btn-primary">Export to File</button>
        </div>
    </div>
</div>`;
}

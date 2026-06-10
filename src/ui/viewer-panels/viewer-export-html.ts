/**
 * HTML template for the export modal.
 *
 * Provides level-based filtering and preset templates for exporting logs:
 * - Errors Only: Only error-level messages
 * - Full Debug: All levels including debug/trace
 * - Production Ready: Info, warnings, errors (no debug/trace)
 *
 * User-facing labels are localized via t() (keys in strings-viewer-e.ts);
 * emoji glyphs stay literal and the line-count number is filled by the script.
 */

import { t } from "../../l10n";

/** Returns the HTML for the export modal element. */
export function getExportModalHtml(): string {
    return `<div id="export-modal" class="modal">
    <div class="modal-content">
        <div class="modal-header">
            <span>${t('viewer.export.title')}</span>
            <button class="modal-close" title="${t('viewer.export.close')}">&times;</button>
        </div>
        <div class="modal-body">
            <div class="export-section">
                <h4>${t('viewer.export.template')}</h4>
                <select id="export-template">
                    <option value="custom">${t('viewer.export.template.custom')}</option>
                    <option value="errors-only">${t('viewer.export.template.errorsOnly')}</option>
                    <option value="warnings-errors">${t('viewer.export.template.warningsErrors')}</option>
                    <option value="production">${t('viewer.export.template.production')}</option>
                    <option value="full-debug">${t('viewer.export.template.fullDebug')}</option>
                    <option value="performance">${t('viewer.export.template.performance')}</option>
                </select>
            </div>

            <div class="export-accordion expanded" id="export-levels-section">
                <button type="button" class="export-accordion-header" aria-expanded="true">
                    <span class="export-accordion-arrow codicon codicon-chevron-right"></span>
                    <span class="export-accordion-title">${t('viewer.export.includeLevels')}</span>
                    <span class="export-accordion-summary" id="export-levels-summary"></span>
                </button>
                <div class="export-accordion-body">
                    <label class="export-checkbox">
                        <input type="checkbox" id="export-level-error" checked />
                        <span>🔴 ${t('viewer.export.level.error')}</span>
                    </label>
                    <label class="export-checkbox">
                        <input type="checkbox" id="export-level-warning" checked />
                        <span>🟠 ${t('viewer.export.level.warning')}</span>
                    </label>
                    <label class="export-checkbox">
                        <input type="checkbox" id="export-level-info" checked />
                        <span>🟢 ${t('viewer.export.level.info')}</span>
                    </label>
                    <label class="export-checkbox">
                        <input type="checkbox" id="export-level-performance" />
                        <span>🟣 ${t('viewer.export.level.performance')}</span>
                    </label>
                    <label class="export-checkbox">
                        <input type="checkbox" id="export-level-todo" />
                        <span>⚪ ${t('viewer.export.level.todo')}</span>
                    </label>
                    <label class="export-checkbox">
                        <input type="checkbox" id="export-level-notice" />
                        <span>🟦 ${t('viewer.export.level.notice')}</span>
                    </label>
                    <label class="export-checkbox">
                        <input type="checkbox" id="export-level-debug" />
                        <span>🟤 ${t('viewer.export.level.debug')}</span>
                    </label>
                    <label class="export-checkbox">
                        <input type="checkbox" id="export-level-database" />
                        <span>🟡 ${t('viewer.export.level.database')}</span>
                    </label>
                </div>
            </div>

            <div class="export-accordion expanded" id="export-options-section">
                <button type="button" class="export-accordion-header" aria-expanded="true">
                    <span class="export-accordion-arrow codicon codicon-chevron-right"></span>
                    <span class="export-accordion-title">${t('viewer.export.options')}</span>
                    <span class="export-accordion-summary" id="export-options-summary"></span>
                </button>
                <div class="export-accordion-body">
                    <label class="export-checkbox">
                        <input type="checkbox" id="export-include-timestamps" checked />
                        <span>${t('viewer.export.opt.timestamps')}</span>
                    </label>
                    <label class="export-checkbox">
                        <input type="checkbox" id="export-include-decorations" />
                        <span>${t('viewer.export.opt.decorations')}</span>
                    </label>
                    <label class="export-checkbox">
                        <input type="checkbox" id="export-strip-ansi" checked />
                        <span>${t('viewer.export.opt.stripAnsi')}</span>
                    </label>
                </div>
            </div>

            <div class="export-section">
                <h4>${t('viewer.export.preview')}</h4>
                <div id="export-preview">
                    <span id="export-line-count">0 lines</span> ${t('viewer.export.willBeExported')}
                </div>
            </div>
        </div>
        <div class="modal-footer">
            <button id="export-quick-save-btn" class="modal-btn" title="${t('viewer.export.quickSave.title')}">${t('viewer.export.quickSave')}</button>
            <span class="modal-footer-spacer"></span>
            <button id="export-cancel-btn" class="modal-btn">${t('viewer.export.cancel')}</button>
            <button id="export-confirm-btn" class="modal-btn modal-btn-primary">${t('viewer.export.confirm')}</button>
        </div>
    </div>
</div>`;
}

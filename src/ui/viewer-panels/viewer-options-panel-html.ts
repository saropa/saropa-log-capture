/**
 * HTML template for the options panel.
 *
 * Provides a slide-out panel with display and layout settings:
 *   - Display options (word wrap, decorations, font size, line height)
 *   - Layout (visual spacing)
 *   - Integrations button (opens dedicated Integrations screen)
 *   - Help: Keyboard shortcuts… (opens shortcuts reference screen)
 *   - Audio alerts
 *   - Actions (reset to default, reset extension settings)
 *
 * Filter controls (presets, tags, exclusions) live in the filters panel.
 *
 * User-facing strings resolve through t() (host-built HTML) — see strings-viewer-c.ts.
 * Numeric select values (px widths, 0.5s/1s/…) stay literal as symbolic units.
 */
import { getIntegrationsPanelHtml } from './viewer-integrations-panel-html';
import { getKeyboardShortcutsViewHtml } from './viewer-keyboard-shortcuts-html';
import { t } from '../../l10n';

/** Returns the HTML for the options panel element. */
export function getOptionsPanelHtml(): string {
    return `<div id="options-panel" class="options-panel" role="region" aria-label="${t('viewer.options.region')}">
    <div class="options-header">
        <span>${t('viewer.options.header')}</span>
        <button class="options-close" type="button" title="${t('viewer.options.close.title')}" aria-label="${t('viewer.options.close.label')}"><span class="codicon codicon-close"></span></button>
    </div>

    <div class="options-search-wrapper">
        <input id="options-search" type="text" placeholder="${t('viewer.options.search.placeholder')}" title="${t('viewer.options.search.title')}" aria-label="${t('viewer.options.search.label')}" />
        <button id="options-search-clear" class="options-search-clear" type="button" title="${t('viewer.options.searchClear.title')}" aria-label="${t('viewer.options.searchClear.label')}">&times;</button>
    </div>

    <div class="options-content">
        <!-- Capture master switch -->
        <div class="options-section">
            <h3 class="options-section-title">${t('viewer.options.section.capture')}</h3>
            <label class="options-row" title="${t('viewer.options.captureEnabled.title')}">
                <input type="checkbox" id="opt-capture-enabled" />
                <span>${t('viewer.options.captureEnabled')}</span>
            </label>
            <label class="options-row" title="${t('viewer.options.diagnosticCapture.title')}">
                <input type="checkbox" id="opt-diagnostic-capture" />
                <span>${t('viewer.options.diagnosticCapture')}</span>
            </label>
        </div>

        <!-- Display Section -->
        <div class="options-section">
            <h3 class="options-section-title">${t('viewer.options.section.display')}</h3>
            <div class="options-row">
                <span>${t('viewer.options.fontSize')} <span id="font-size-label">13px</span></span>
            </div>
            <div class="options-row">
                <input type="range" id="font-size-slider" min="4" max="42" value="13" style="width: 100%;" title="${t('viewer.options.fontSize.title')}" />
            </div>
            <div class="options-row">
                <span>${t('viewer.options.lineHeight')} <span id="line-height-label">1.1</span></span>
            </div>
            <div class="options-row">
                <input type="range" id="line-height-slider" min="5" max="40" value="11" style="width: 100%;" title="${t('viewer.options.lineHeight.title')}" />
            </div>
            <label class="options-row" title="${t('viewer.options.wrap.title')}">
                <input type="checkbox" id="opt-wrap" />
                <span>${t('viewer.options.wrap')}</span>
            </label>
            <label class="options-row" title="${t('viewer.options.decoDot.title')}">
                <input type="checkbox" id="opt-deco-dot" checked />
                <span>${t('viewer.options.decoDot')}</span>
            </label>
            <label class="options-row" title="${t('viewer.options.decoTimestamp.title')}">
                <input type="checkbox" id="opt-deco-timestamp" checked />
                <span>${t('viewer.options.decoTimestamp')}</span>
            </label>
            <label class="options-row" title="${t('viewer.options.decoMs.title')}">
                <input type="checkbox" id="opt-deco-milliseconds" />
                <span>${t('viewer.options.decoMs')}</span>
            </label>
            <label class="options-row" title="${t('viewer.options.decoElapsed.title')}">
                <input type="checkbox" id="opt-deco-elapsed" />
                <span>${t('viewer.options.decoElapsed')}</span>
            </label>
            <div class="options-row" title="${t('viewer.options.lineColor.title')}">
                <span>${t('viewer.options.lineColor')}</span>
                <select id="opt-line-color">
                    <option value="none">${t('viewer.options.lineColor.none')}</option>
                    <option value="line">${t('viewer.options.lineColor.whole')}</option>
                </select>
            </div>
            <label class="options-row" title="${t('viewer.options.decoBar.title')}">
                <input type="checkbox" id="opt-deco-bar" checked />
                <span>${t('viewer.options.decoBar')}</span>
            </label>
        </div>

        <!-- Integrations: button opens dedicated Integrations screen -->
        <div class="options-section">
            <h3 class="options-section-title">${t('viewer.options.section.integrations')}</h3>
            <div class="options-row">
                <button type="button" id="options-open-integrations" class="options-integrations-btn" title="${t('viewer.options.openIntegrations.title')}">
                    <span class="codicon codicon-plug"></span> ${t('viewer.options.openIntegrations')}
                </button>
            </div>
        </div>

        <!-- Help: Keyboard shortcuts reference -->
        <div class="options-section">
            <h3 class="options-section-title">${t('viewer.options.section.help')}</h3>
            <div class="options-row">
                <button type="button" id="options-open-shortcuts" class="options-integrations-btn" title="${t('viewer.options.openShortcuts.title')}">
                    <span class="codicon codicon-keyboard"></span> ${t('viewer.options.openShortcuts')}
                </button>
            </div>
        </div>

        <!-- Layout Section -->
        <div class="options-section">
            <h3 class="options-section-title">${t('viewer.options.section.layout')}</h3>
            <label class="options-row" title="${t('viewer.options.counter.title')}">
                <input type="checkbox" id="opt-deco-counter" checked />
                <span>${t('viewer.options.counter')}</span>
            </label>
            <label class="options-row" title="${t('viewer.options.minimapSql.title')}">
                <input type="checkbox" id="opt-minimap-sql-density" />
                <span>${t('viewer.options.minimapSql')}</span>
            </label>
            <label class="options-row options-row--minimap-width" title="${t('viewer.options.minimapWidth.title')}">
                <span>${t('viewer.options.minimapWidth')}</span>
                <select id="opt-minimap-width" aria-label="${t('viewer.options.minimapWidth.label')}">
                    <option value="xsmall">${t('viewer.options.minimapWidth.xsmall')}</option>
                    <option value="small">${t('viewer.options.minimapWidth.small')}</option>
                    <option value="medium">${t('viewer.options.minimapWidth.medium')}</option>
                    <option value="large">${t('viewer.options.minimapWidth.large')}</option>
                    <option value="xlarge">${t('viewer.options.minimapWidth.xlarge')}</option>
                </select>
            </label>
            <label class="options-row" title="${t('viewer.options.visualSpacing.title')}">
                <input type="checkbox" id="opt-visual-spacing" />
                <span>${t('viewer.options.visualSpacing')}</span>
            </label>
            <label class="options-row" title="${t('viewer.options.hideBlank.title')}">
                <input type="checkbox" id="opt-hide-blank-lines" />
                <span>${t('viewer.options.hideBlank')}</span>
            </label>
            <label class="options-row" title="${t('viewer.options.compress.title')}">
                <input type="checkbox" id="opt-compress-lines" />
                <span>${t('viewer.options.compress')}</span>
            </label>
            <label class="options-row" title="${t('viewer.options.compressGlobal.title')}">
                <input type="checkbox" id="opt-compress-lines-global" />
                <span>${t('viewer.options.compressGlobal')}</span>
            </label>
            <label class="options-row" title="${t('viewer.options.collapseNumeric.title')}">
                <input type="checkbox" id="opt-collapse-numeric-variants" />
                <span>${t('viewer.options.collapseNumeric')}</span>
            </label>
        </div>

        <!-- Audio Section -->
        <div class="options-section">
            <h3 class="options-section-title">${t('viewer.options.section.audio')}</h3>
            <label class="options-row" title="${t('viewer.options.audio.title')}">
                <input type="checkbox" id="opt-audio" />
                <span>${t('viewer.options.audio')}</span>
            </label>
            <div class="options-indent" id="audio-options">
                <div class="options-row">
                    <span>${t('viewer.options.volume')} <span id="audio-volume-label">30%</span></span>
                </div>
                <div class="options-row">
                    <input type="range" id="audio-volume-slider" min="0" max="100" value="30" style="width: 100%;" title="${t('viewer.options.volume.title')}" />
                </div>
                <div class="options-row" title="${t('viewer.options.rateLimit.title')}">
                    <span>${t('viewer.options.rateLimit')}</span>
                    <select id="audio-rate-limit">
                        <option value="0">${t('viewer.options.rateLimit.none')}</option>
                        <option value="500">0.5s</option>
                        <option value="1000">1s</option>
                        <option value="2000" selected>2s</option>
                        <option value="5000">5s</option>
                        <option value="10000">10s</option>
                    </select>
                </div>
                <div class="options-row">
                    <span>${t('viewer.options.previewSounds')}</span>
                    <button id="preview-error-sound" class="preview-sound-btn" title="${t('viewer.options.previewError.title')}">${t('viewer.options.previewError')}</button>
                    <button id="preview-warning-sound" class="preview-sound-btn" title="${t('viewer.options.previewWarning.title')}">${t('viewer.options.previewWarning')}</button>
                </div>
            </div>
        </div>

        <!-- Severity Keywords Section -->
        <div class="options-section">
            <h3 class="options-section-title">${t('viewer.options.section.severityKw')}</h3>
            <div id="severity-keywords-display" class="severity-keywords-display"></div>
            <div class="options-row">
                <button type="button" id="options-edit-severity-keywords" class="options-integrations-btn" title="${t('viewer.options.editKeywords.title')}">
                    <span class="codicon codicon-edit"></span> ${t('viewer.options.editKeywords')}
                </button>
            </div>
        </div>

        <!-- Actions Section -->
        <div class="options-section">
            <h3 class="options-section-title">${t('viewer.options.section.actions')}</h3>
            <div class="options-row">
                <button id="reset-options-btn" class="options-action-btn" title="${t('viewer.options.resetOptions.title')}">${t('viewer.options.resetOptions')}</button>
                <button id="reset-settings-btn" class="options-action-btn" title="${t('viewer.options.resetSettings.title')}">${t('viewer.options.resetSettings')}</button>
            </div>
        </div>
    </div>
    ${getIntegrationsPanelHtml()}
    ${getKeyboardShortcutsViewHtml()}
</div>`;
}

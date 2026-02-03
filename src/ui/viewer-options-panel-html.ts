/**
 * HTML template for the options panel.
 *
 * Provides a slide-out panel with organized sections for all viewer settings:
 *   - Quick Filters (presets + reset)
 *   - Output Channels (DAP category checkboxes)
 *   - Log Tags (source tag chips)
 *   - Noise Reduction (exclusions + app-only)
 *   - Display options (word wrap, decorations, font size, line height)
 *   - Layout (visual spacing)
 *   - Audio alerts
 *   - Actions (export)
 */

/** Returns the HTML for the options panel element. */
export function getOptionsPanelHtml(): string {
    return `<div id="options-panel" class="options-panel">
    <div class="options-header">
        <span>Options</span>
        <button class="options-close">&times;</button>
    </div>

    <div class="options-content">
        <!-- Quick Filters Section -->
        <div class="options-section">
            <h3 class="options-section-title">Quick Filters</h3>
            <div class="options-row">
                <select id="preset-select" title="Quick Filters" style="flex:1">
                    <option value="">None</option>
                </select>
            </div>
            <div class="options-row">
                <button id="reset-all-filters" class="options-action-btn" title="Clear all active filters and return to default view">Reset all filters</button>
            </div>
        </div>

        <!-- Output Channels Section (populated dynamically) -->
        <div class="options-section" id="output-channels-section" style="display:none">
            <h3 class="options-section-title">Output Channels</h3>
            <div id="output-channels-list"></div>
        </div>

        <!-- Log Tags Section (populated dynamically) -->
        <div class="options-section" id="log-tags-section" style="display:none">
            <h3 class="options-section-title">Log Tags</h3>
            <div class="options-row">
                <span id="source-tag-summary" class="source-tag-summary"></span>
            </div>
            <div id="source-tag-chips" class="source-tag-chips options-tags"></div>
        </div>

        <!-- Noise Reduction Section -->
        <div class="options-section">
            <h3 class="options-section-title">Noise Reduction</h3>
            <label class="options-row" title="Hide log lines matching configured exclusion patterns">
                <input type="checkbox" id="opt-exclusions" />
                <span id="exclusion-label">Exclusions</span>
            </label>
            <div class="exclusion-input-wrapper">
                <input id="exclusion-add-input" type="text" placeholder="e.g. verbose or /debug/i" />
                <button id="exclusion-add-btn" title="Add exclusion pattern">Add</button>
            </div>
            <div id="exclusion-chips" class="exclusion-chips"></div>
            <div class="options-hint" id="exclusion-count"></div>
            <label class="options-row" title="Show only application output, hiding framework and system messages">
                <input type="checkbox" id="opt-app-only" />
                <span>App only (hide framework)</span>
            </label>
        </div>

        <!-- Display Section -->
        <div class="options-section">
            <h3 class="options-section-title">Display</h3>
            <div class="options-row">
                <span>Font size: <span id="font-size-label">13px</span></span>
            </div>
            <div class="options-row">
                <input type="range" id="font-size-slider" min="8" max="22" value="13" style="width: 100%;" title="Adjust the font size for log text" />
            </div>
            <div class="options-row">
                <span>Line height: <span id="line-height-label">1.5</span></span>
            </div>
            <div class="options-row">
                <input type="range" id="line-height-slider" min="5" max="40" value="15" style="width: 100%;" title="Adjust the spacing between log lines" />
            </div>
            <label class="options-row" title="Wrap long lines to fit the panel width">
                <input type="checkbox" id="opt-wrap" />
                <span>Word wrap</span>
            </label>
            <label class="options-row" title="Show severity dot, line number, and timestamp before each line">
                <input type="checkbox" id="opt-decorations" />
                <span>Line prefix (&#x1F7E2; N T00:00:00)</span>
            </label>
            <div class="options-indent" id="decoration-options">
                <label class="options-row" title="Show colored circle indicating log severity">
                    <input type="checkbox" id="opt-deco-dot" checked />
                    <span>Severity dot</span>
                </label>
                <label class="options-row" title="Show the line number in the prefix">
                    <input type="checkbox" id="opt-deco-counter" checked />
                    <span>Counter</span>
                </label>
                <label class="options-row" title="Show the time each line was logged">
                    <input type="checkbox" id="opt-deco-timestamp" checked />
                    <span>Timestamp</span>
                </label>
                <label class="options-row" title="Include millisecond precision in timestamps">
                    <input type="checkbox" id="opt-deco-milliseconds" />
                    <span>Show milliseconds</span>
                </label>
                <label class="options-row" title="Show time elapsed since the previous log line">
                    <input type="checkbox" id="opt-deco-elapsed" />
                    <span>Elapsed time (+Nms)</span>
                </label>
                <div class="options-row" title="Apply background color to lines based on severity level">
                    <span>Line coloring</span>
                    <select id="opt-line-color">
                        <option value="none">None</option>
                        <option value="line">Whole line</option>
                    </select>
                </div>
                <label class="options-row" title="Show colored left border based on log severity">
                    <input type="checkbox" id="opt-deco-bar" checked />
                    <span>Severity bar (left border)</span>
                </label>
            </div>
        </div>

        <!-- Layout Section -->
        <div class="options-section">
            <h3 class="options-section-title">Layout</h3>
            <label class="options-row" title="Add extra vertical padding between log lines for easier reading">
                <input type="checkbox" id="opt-visual-spacing" checked />
                <span>Visual spacing (breathing room)</span>
            </label>
        </div>

        <!-- Audio Section -->
        <div class="options-section">
            <h3 class="options-section-title">Audio</h3>
            <label class="options-row" title="Play an alert sound when errors or warnings are logged">
                <input type="checkbox" id="opt-audio" />
                <span>Play sounds for errors/warnings</span>
            </label>
            <div class="options-indent" id="audio-options">
                <div class="options-row">
                    <span>Volume: <span id="audio-volume-label">30%</span></span>
                </div>
                <div class="options-row">
                    <input type="range" id="audio-volume-slider" min="0" max="100" value="30" style="width: 100%;" title="Set the volume for alert sounds" />
                </div>
                <div class="options-row" title="Minimum time between consecutive alert sounds">
                    <span>Rate limit (seconds between sounds)</span>
                    <select id="audio-rate-limit">
                        <option value="0">None</option>
                        <option value="500">0.5s</option>
                        <option value="1000">1s</option>
                        <option value="2000" selected>2s</option>
                        <option value="5000">5s</option>
                        <option value="10000">10s</option>
                    </select>
                </div>
                <div class="options-row">
                    <span>Preview sounds:</span>
                    <button id="preview-error-sound" class="preview-sound-btn">🔴 Error</button>
                    <button id="preview-warning-sound" class="preview-sound-btn">🟠 Warning</button>
                </div>
            </div>
        </div>

        <!-- Actions Section -->
        <div class="options-section">
            <h3 class="options-section-title">Actions</h3>
            <div class="options-row">
                <button id="export-btn" class="options-action-btn" title="Export logs">Export</button>
            </div>
        </div>
    </div>
</div>`;
}

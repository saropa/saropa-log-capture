/**
 * HTML template for the options panel.
 *
 * Provides a slide-out panel with display and layout settings:
 *   - Display options (word wrap, decorations, font size, line height)
 *   - Layout (visual spacing)
 *   - Audio alerts
 *   - Actions (export)
 *
 * Filter controls (presets, tags, exclusions) live in the filters panel.
 */

/** Returns the HTML for the options panel element. */
export function getOptionsPanelHtml(): string {
    return `<div id="options-panel" class="options-panel">
    <div class="options-header">
        <span>Options</span>
        <button class="options-close">&times;</button>
    </div>

    <div class="options-search-wrapper">
        <input id="options-search" type="text" placeholder="Filter options\u2026" />
        <button id="options-search-clear" class="options-search-clear" title="Clear filter">&times;</button>
    </div>

    <div class="options-content">
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

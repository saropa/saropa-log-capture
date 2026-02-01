/**
 * HTML template for the options panel.
 *
 * Provides a slide-out panel with organized sections for all viewer settings:
 *   - Display options (word wrap, decorations, font size, line height)
 *   - Level filters
 *   - Search and filtering
 *   - Exclusions and watch
 *   - Layout (visual spacing)
 *   - Audio alerts
 */

/** Returns the HTML for the options panel element. */
export function getOptionsPanelHtml(): string {
    return `<div id="options-panel" class="options-panel">
    <div class="options-header">
        <span>Options</span>
        <button class="options-close">&times;</button>
    </div>

    <div class="options-content">
        <!-- Display Section -->
        <div class="options-section">
            <h3 class="options-section-title">Display</h3>
            <div class="options-row">
                <span>Font size: <span id="font-size-label">13px</span></span>
            </div>
            <div class="options-row">
                <input type="range" id="font-size-slider" min="10" max="20" value="13" style="width: 100%;" />
            </div>
            <div class="options-row">
                <span>Line height: <span id="line-height-label">1.5</span></span>
            </div>
            <div class="options-row">
                <input type="range" id="line-height-slider" min="10" max="25" value="15" style="width: 100%;" />
            </div>
            <label class="options-row">
                <input type="checkbox" id="opt-wrap" checked />
                <span>Word wrap</span>
            </label>
            <label class="options-row">
                <input type="checkbox" id="opt-decorations" />
                <span>Line prefix (&#x1F7E2; #N T00:00:00)</span>
            </label>
            <label class="options-row">
                <input type="checkbox" id="opt-inline-context" />
                <span>Show inline context (file » function)</span>
            </label>
            <div class="options-indent" id="decoration-options">
                <label class="options-row">
                    <input type="checkbox" id="opt-deco-dot" checked />
                    <span>Severity dot</span>
                </label>
                <label class="options-row">
                    <input type="checkbox" id="opt-deco-counter" checked />
                    <span>Counter (#N)</span>
                </label>
                <label class="options-row">
                    <input type="checkbox" id="opt-deco-timestamp" checked />
                    <span>Timestamp</span>
                </label>
                <label class="options-row">
                    <input type="checkbox" id="opt-deco-elapsed" />
                    <span>Elapsed time</span>
                </label>
                <div class="options-row">
                    <span>Line coloring</span>
                    <select id="opt-line-color">
                        <option value="none">None</option>
                        <option value="line">Whole line</option>
                    </select>
                </div>
            </div>
        </div>

        <!-- Level Filters Section -->
        <div class="options-section">
            <h3 class="options-section-title">Level Filters</h3>
            <label class="options-row">
                <input type="checkbox" id="opt-level-info" checked />
                <span>🟢 Info</span>
            </label>
            <label class="options-row">
                <input type="checkbox" id="opt-level-warning" checked />
                <span>🟠 Warning</span>
            </label>
            <label class="options-row">
                <input type="checkbox" id="opt-level-error" checked />
                <span>🔴 Error</span>
            </label>
            <label class="options-row">
                <input type="checkbox" id="opt-level-perf" checked />
                <span>🟣 Performance</span>
            </label>
            <label class="options-row">
                <input type="checkbox" id="opt-level-todo" checked />
                <span>⚪ TODO/FIXME</span>
            </label>
            <label class="options-row">
                <input type="checkbox" id="opt-level-debug" checked />
                <span>🟤 Debug/Trace</span>
            </label>
            <label class="options-row">
                <input type="checkbox" id="opt-level-notice" checked />
                <span>🟦 Notice</span>
            </label>
        </div>

        <!-- Filtering Section -->
        <div class="options-section">
            <h3 class="options-section-title">Filtering</h3>
            <label class="options-row">
                <input type="checkbox" id="opt-exclusions" />
                <span>Enable exclusions</span>
            </label>
            <label class="options-row">
                <input type="checkbox" id="opt-app-only" />
                <span>App only (hide framework)</span>
            </label>
        </div>

        <!-- Layout Section -->
        <div class="options-section">
            <h3 class="options-section-title">Layout</h3>
            <label class="options-row">
                <input type="checkbox" id="opt-visual-spacing" />
                <span>Visual spacing (breathing room)</span>
            </label>
        </div>

        <!-- Audio Section -->
        <div class="options-section">
            <h3 class="options-section-title">Audio</h3>
            <label class="options-row">
                <input type="checkbox" id="opt-audio" />
                <span>Play sounds for errors/warnings</span>
            </label>
            <div class="options-indent" id="audio-options">
                <div class="options-row">
                    <span>Volume: <span id="audio-volume-label">30%</span></span>
                </div>
                <div class="options-row">
                    <input type="range" id="audio-volume-slider" min="0" max="100" value="30" style="width: 100%;" />
                </div>
                <div class="options-row">
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
    </div>
</div>`;
}

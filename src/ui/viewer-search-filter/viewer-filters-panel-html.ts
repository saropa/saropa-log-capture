/**
 * HTML template for the filters panel.
 *
 * Slide-out panel from the right side with organized sections for all
 * viewer filter controls:
 *   - Quick Filters (presets + reset)
 *   - Log Streams (debug / terminal; external sidecars grouped with count)
 *   - Code Location Scope (narrow by active editor path; contextual hint when too few lines match)
 *   - Output Channels (DAP category checkboxes)
 *   - Log Tags (source tag chips)
 *   - SQL Patterns (normalized Drift SQL fingerprints + Other SQL bucket)
 *   - Code Tags (class/method tag chips)
 *   - Noise Reduction (exclusions + app-only)
 *
 * Tag search input at the top filters chip labels across both tag sections.
 */

/** Returns the HTML for the filters panel element. */
export function getFiltersPanelHtml(): string {
    return `<div id="filters-panel" class="options-panel">
    <div class="options-header">
        <span>Filters</span>
        <button class="filters-close options-close" title="Close">&times;</button>
    </div>

    <div class="options-search-wrapper">
        <input id="filters-search" type="text" placeholder="Search tags\u2026" />
        <button id="filters-search-clear" class="options-search-clear" title="Clear">&times;</button>
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

        <!-- Log streams (debug / terminal / external sidecars); shown when session has multiple inputs -->
        <div class="options-section" id="source-filter-section" style="display:none">
            <h3 class="options-section-title">Log Streams</h3>
            <div id="source-streams-intro" class="options-hint">Choose which inputs to show (debug console, terminal capture, or merged external log files).</div>
            <div id="source-filter-list" class="options-row-list source-filter-list"></div>
        </div>

        <!-- Code location scope: DAP source path relative to active editor (separate from Log Streams above) -->
        <div class="options-section" id="scope-section">
            <h3 class="options-section-title">Code Location Scope</h3>
            <div id="scope-intro" class="options-hint">Narrow the view using file paths attached to log lines by the debugger—not the same as Log Streams above.</div>
            <div id="scope-status" class="options-hint">No active editor</div>
            <label class="options-row"><input type="radio" name="scope" value="all" checked /> All logs</label>
            <div id="scope-no-context-hint" class="options-hint">Open a source file from your workspace to enable folder and file scope.</div>
            <div id="scope-narrowing-block" style="display:none">
                <label class="options-row"><input type="radio" name="scope" value="workspace" disabled /> Workspace folder</label>
                <label class="options-row"><input type="radio" name="scope" value="package" disabled /> Package</label>
                <label class="options-row"><input type="radio" name="scope" value="directory" disabled /> Directory</label>
                <label class="options-row"><input type="radio" name="scope" value="file" disabled /> File</label>
                <label class="options-row" title="When a location scope is active, hide lines with no file path from the debugger">
                    <input type="checkbox" id="scope-hide-unattrib" />
                    <span>Hide lines without file path</span>
                </label>
                <div id="scope-filter-hint" class="options-hint scope-filter-hint" style="display:none" aria-live="polite"></div>
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

        <!-- SQL pattern chips (Drift fingerprints; low-frequency → Other SQL); plan DB_05 -->
        <div class="options-section" id="sql-patterns-section" style="display:none">
            <h3 class="options-section-title">Top SQL Patterns</h3>
            <div class="options-row">
                <span id="sql-pattern-summary" class="source-tag-summary"></span>
            </div>
            <div id="sql-pattern-chips" class="source-tag-chips options-tags"></div>
        </div>

        <!-- Code Tags Section (populated dynamically) -->
        <div class="options-section" id="class-tags-section" style="display:none">
            <h3 class="options-section-title">Code Tags</h3>
            <div class="options-row">
                <span id="class-tag-summary" class="source-tag-summary"></span>
            </div>
            <div id="class-tag-chips" class="source-tag-chips options-tags"></div>
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
    </div>
</div>`;
}

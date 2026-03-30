/**
 * HTML template for the filters panel.
 *
 * Slide-out panel from the right side with organized sections for all
 * viewer filter controls:
 *   - Quick Filters (presets + reset)
 *   - Log Inputs (merged: sources + DAP category checkboxes)
 *   - Noise Reduction (app-only + exclusions)
 *   - Message Tags (source tag chips from logging framework)
 *   - Code Origins (class/method tag chips)
 *   - File Scope (narrow by active editor path)
 *   - SQL Commands (normalized Drift SQL fingerprints)
 *
 * Tag search input at the top filters chip labels across tag sections.
 */

/** Returns the HTML for the filters panel element. */
export function getFiltersPanelHtml(): string {
    return `<div id="filters-panel" class="options-panel" role="region" aria-label="Filters">
    <div class="options-header">
        <span>Filters</span>
        <button class="filters-close options-close" title="Close" aria-label="Close Filters">&times;</button>
    </div>

    <div class="options-search-wrapper">
        <input id="filters-search" type="text" placeholder="Search tags\u2026" aria-label="Search tags" />
        <button id="filters-search-clear" class="options-search-clear" title="Clear" aria-label="Clear search">&times;</button>
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

        <!-- Log Inputs: merged sources + categories; shown when session has multiple inputs or categories -->
        <div class="options-section" id="log-inputs-section" style="display:none">
            <h3 class="options-section-title">Log Inputs</h3>
            <div id="source-filter-list" class="options-row-list source-filter-list"></div>
            <div id="log-inputs-divider" class="log-inputs-divider" style="display:none"></div>
            <div id="output-channels-list"></div>
        </div>

        <!-- Noise Reduction: app-only + exclusion patterns -->
        <div class="options-section">
            <h3 class="options-section-title">Noise Reduction</h3>
            <label class="options-row" title="Show only application output, hiding framework and system messages">
                <input type="checkbox" id="opt-app-only" />
                <span>App only (hide framework)</span>
            </label>
            <label class="options-row" title="Hide log lines matching configured exclusion patterns">
                <input type="checkbox" id="opt-exclusions" />
                <span id="exclusion-label">Exclusion patterns</span>
            </label>
            <div class="exclusion-input-wrapper">
                <input id="exclusion-add-input" type="text" placeholder="e.g. verbose or /debug/i" />
                <button id="exclusion-add-btn" title="Add exclusion pattern">Add</button>
            </div>
            <div id="exclusion-chips" class="exclusion-chips"></div>
            <div class="options-hint" id="exclusion-count"></div>
        </div>

        <!-- Message Tags Section (populated dynamically) -->
        <div class="options-section" id="log-tags-section" style="display:none">
            <h3 class="options-section-title">Message Tags</h3>
            <div class="options-hint">Tags from your logging framework</div>
            <div class="options-row">
                <span id="source-tag-summary" class="source-tag-summary"></span>
            </div>
            <div id="source-tag-chips" class="source-tag-chips options-tags"></div>
        </div>

        <!-- Code Origins Section (populated dynamically) -->
        <div class="options-section" id="class-tags-section" style="display:none">
            <h3 class="options-section-title">Code Origins</h3>
            <div class="options-hint">Class &amp; method where log originated</div>
            <div class="options-row">
                <span id="class-tag-summary" class="source-tag-summary"></span>
            </div>
            <div id="class-tag-chips" class="source-tag-chips options-tags"></div>
        </div>

        <!-- File Scope: DAP source path relative to active editor -->
        <div class="options-section" id="scope-section">
            <h3 class="options-section-title">File Scope</h3>
            <div id="scope-intro" class="options-hint">Narrow by file path from the debugger.</div>
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

        <!-- SQL command-type chips (verb-based: SELECT, INSERT, etc.) -->
        <div class="options-section" id="sql-patterns-section" style="display:none">
            <h3 class="options-section-title">SQL Commands</h3>
            <div class="options-row">
                <span id="sql-pattern-summary" class="source-tag-summary"></span>
            </div>
            <div id="sql-pattern-chips" class="source-tag-chips options-tags"></div>
            <div class="options-row">
                <button type="button" id="open-sql-query-history-from-filters" class="options-action-btn" title="Open scrollable list of SQL fingerprints for this session">SQL Query History\u2026</button>
            </div>
        </div>
    </div>
</div>`;
}

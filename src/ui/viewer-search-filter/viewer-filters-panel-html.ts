/**
 * HTML template for the filters panel.
 *
 * Slide-out panel from the right side with organized sections for all
 * viewer filter controls:
 *   - Quick Filters (presets + reset)
 *   - Log Inputs (tier checkboxes + sources + DAP category checkboxes)
 *   - Exclusions (exclusion patterns)
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

        <!-- Log Inputs: tier checkboxes + sources + categories -->
        <div class="options-section" id="log-inputs-section" style="display:none">
            <h3 class="options-section-title">Log Inputs</h3>
            <div class="options-row-list tier-filter-list">
                <label class="options-row" title="Show Flutter app output"><input type="checkbox" id="opt-flutter" checked /><span>Flutter</span></label>
                <label class="options-row" title="Show device/system logs (excludes critical device errors which are always visible)"><input type="checkbox" id="opt-device" /><span>Device</span></label>
            </div>
            <div id="log-inputs-divider" class="log-inputs-divider" style="display:none"></div>
            <div id="source-filter-list" class="options-row-list source-filter-list"></div>
            <div id="log-inputs-divider-cat" class="log-inputs-divider" style="display:none"></div>
            <div id="output-channels-list"></div>
        </div>

        <!-- Exclusions: exclusion patterns -->
        <div class="options-section">
            <h3 class="options-section-title">Noise Reduction</h3>
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
            <div id="scope-status" class="options-hint"></div>
            <label class="options-row"><input type="radio" name="scope" value="all" checked /> All logs</label>
            <label class="options-row"><input type="radio" name="scope" value="workspace" disabled /> Only workspace<span id="scope-suffix-workspace" class="scope-suffix"></span></label>
            <label class="options-row"><input type="radio" name="scope" value="package" disabled /> Only package<span id="scope-suffix-package" class="scope-suffix"></span></label>
            <label class="options-row"><input type="radio" name="scope" value="directory" disabled /> Only directory<span id="scope-suffix-directory" class="scope-suffix"></span></label>
            <label class="options-row"><input type="radio" name="scope" value="file" disabled /> Only file<span id="scope-suffix-file" class="scope-suffix"></span></label>
            <label class="options-row scope-unattrib-row" title="When a scope is active, also exclude lines that have no source file from the debugger">
                <input type="checkbox" id="scope-hide-unattrib" />
                <span>Exclude lines with no source file</span>
            </label>
            <div id="scope-filter-hint" class="options-hint scope-filter-hint" style="display:none" aria-live="polite"></div>
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

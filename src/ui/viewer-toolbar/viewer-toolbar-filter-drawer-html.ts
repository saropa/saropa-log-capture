/**
 * Filter drawer HTML — drops below the toolbar when filter icon is clicked.
 *
 * Consolidates ALL filter controls that previously lived in the sidebar
 * Filters panel and footer level fly-up into a single compact drawer.
 *
 * Layout:
 *   Row 1: Level toggles + context slider (always visible when open)
 *   Row 2: Accordion sections (each with a summary line, expandable)
 *   Row 3: Presets, reset, active count
 *
 * All interior element IDs match the old filters-panel / level-flyup so
 * that existing scripts bind without changes.
 */

/** Filter drawer HTML fragment — inserted after the search flyout. */
export function getFilterDrawerHtml(): string {
    return /* html */ `
<div id="filter-drawer" class="filter-drawer u-hidden" role="region" aria-label="Filters">

    <!-- Row 1: Levels (always visible when drawer is open) -->
    <div class="filter-drawer-levels">
        <div class="filter-drawer-level-row">
            <div class="level-flyup-header">
                <button type="button" id="level-select-all" class="active" title="Click to show all log levels">All</button>
                <button type="button" id="level-select-none" title="Click to hide all log levels">None</button>
            </div>
            <button id="level-error-toggle" class="level-circle active" title="Error — click to show/hide error messages" aria-label="Toggle Error level"><span class="level-emoji">\uD83D\uDD34</span><span class="level-label">Error</span><span class="level-count"></span></button>
            <button id="level-warning-toggle" class="level-circle active" title="Warning — click to show/hide warning messages" aria-label="Toggle Warning level"><span class="level-emoji">\uD83D\uDFE0</span><span class="level-label">Warning</span><span class="level-count"></span></button>
            <button id="level-info-toggle" class="level-circle active" title="Info — click to show/hide informational messages" aria-label="Toggle Info level"><span class="level-emoji">\uD83D\uDFE2</span><span class="level-label">Info</span><span class="level-count"></span></button>
            <button id="level-performance-toggle" class="level-circle active" title="Performance — click to show/hide slow query and timing messages" aria-label="Toggle Performance level"><span class="level-emoji">\uD83D\uDFE3</span><span class="level-label">Perf</span><span class="level-count"></span></button>
            <button id="level-todo-toggle" class="level-circle active" title="TODO / FIXME / HACK / XXX / BUG / KLUDGE / WORKAROUND — click to show/hide code markers" aria-label="Toggle TODO level"><span class="level-emoji">\u26AA</span><span class="level-label">TODO</span><span class="level-count"></span></button>
            <button id="level-notice-toggle" class="level-circle active" title="Notice — click to show/hide notice-level messages" aria-label="Toggle Notice level"><span class="level-emoji">\uD83D\uDFE6</span><span class="level-label">Notice</span><span class="level-count"></span></button>
            <button id="level-debug-toggle" class="level-circle active" title="Debug/Trace — click to show/hide debug and trace output" aria-label="Toggle Debug level"><span class="level-emoji">\uD83D\uDFE4</span><span class="level-label">Debug</span><span class="level-count"></span></button>
            <button id="level-database-toggle" class="level-circle active" title="Database — click to show/hide SQL query output" aria-label="Toggle Database level"><span class="level-emoji">\uD83D\uDFE1</span><span class="level-label">DB</span><span class="level-count"></span></button>
            <span class="filter-drawer-context" title="Number of surrounding lines to keep visible around filtered matches">
                <span id="context-lines-label">\u00B13</span>
                <input type="range" id="context-lines-slider" min="0" max="10" value="3" title="Number of surrounding lines to keep visible around filtered matches" aria-label="Context lines" />
            </span>
        </div>
    </div>

    <!-- Row 2: Accordion filter sections -->
    <div class="filter-drawer-sections">
        ${getAccordionSections()}
    </div>

    <!-- Row 3: Presets + active count + reset -->
    <div class="filter-drawer-footer">
        <span class="filter-drawer-footer-label">Preset:</span>
        <select id="preset-select" title="Apply a preset filter configuration (e.g. Errors Only, Warnings+)">
            <option value="">None</option>
        </select>
        <span id="filter-drawer-summary" class="filter-drawer-summary" title="Summary of currently active filters"></span>
        <span class="filter-drawer-spacer"></span>
        <button id="reset-all-filters" class="options-action-btn" title="Clear all active filters and show all log lines">Reset all</button>
    </div>
</div>`;
}

/** Accordion sections — each has a clickable header and collapsible body. */
function getAccordionSections(): string {
    return /* html */ `
        ${accordionSection('log-inputs-section', 'Log Inputs', `
            <div class="options-row-list tier-filter-list">
                <label class="options-row" title="Show Flutter app output"><input type="checkbox" id="opt-flutter" checked /><span>Flutter</span></label>
                <label class="options-row" title="Show device/system logs (excludes critical device errors which are always visible)"><input type="checkbox" id="opt-device" /><span>Device</span></label>
            </div>
            <div id="log-inputs-divider" class="log-inputs-divider" style="display:none"></div>
            <div id="source-filter-list" class="options-row-list source-filter-list"></div>
            <div id="log-inputs-divider-cat" class="log-inputs-divider" style="display:none"></div>
            <div id="output-channels-list"></div>
        `)}
        ${accordionSection('exclusions-section', 'Exclusions', `
            <label class="options-row" title="Enable or disable exclusion pattern filtering"><input type="checkbox" id="opt-exclusions" /><span id="exclusion-label">Exclusion patterns</span></label>
            <div class="exclusion-input-wrapper">
                <input id="exclusion-add-input" type="text" placeholder="e.g. verbose or /debug/i" title="Enter a text pattern or /regex/i to exclude matching log lines" />
                <button id="exclusion-add-btn" title="Add this pattern to the exclusion list">Add</button>
            </div>
            <div id="exclusion-chips" class="exclusion-chips"></div>
            <div class="options-hint" id="exclusion-count"></div>
        `)}
        ${accordionSection('log-tags-section', 'Message Tags', `
            <div class="options-hint">Tags from your logging framework</div>
            <div class="options-row"><span id="source-tag-summary" class="source-tag-summary"></span></div>
            <div id="source-tag-chips" class="source-tag-chips options-tags"></div>
        `)}
        ${accordionSection('class-tags-section', 'Code Origins', `
            <div class="options-hint">Class &amp; method where log originated</div>
            <div class="options-row"><span id="class-tag-summary" class="source-tag-summary"></span></div>
            <div id="class-tag-chips" class="source-tag-chips options-tags"></div>
        `)}
        ${accordionSection('scope-section', 'File Scope', `
            <div id="scope-status" class="options-hint"></div>
            <label class="options-row" title="Show all log lines regardless of source file"><input type="radio" name="scope" value="all" checked /> All logs</label>
            <label class="options-row" title="Show only logs from the current workspace"><input type="radio" name="scope" value="workspace" disabled /> Only workspace<span id="scope-suffix-workspace" class="scope-suffix"></span></label>
            <label class="options-row" title="Show only logs from the current package"><input type="radio" name="scope" value="package" disabled /> Only package<span id="scope-suffix-package" class="scope-suffix"></span></label>
            <label class="options-row" title="Show only logs from the active file\u2019s directory"><input type="radio" name="scope" value="directory" disabled /> Only directory<span id="scope-suffix-directory" class="scope-suffix"></span></label>
            <label class="options-row" title="Show only logs from the active file"><input type="radio" name="scope" value="file" disabled /> Only file<span id="scope-suffix-file" class="scope-suffix"></span></label>
            <label class="options-row scope-unattrib-row" title="When a scope is active, also exclude lines that have no source file from the debugger"><input type="checkbox" id="scope-hide-unattrib" /><span>Exclude lines with no source file</span></label>
            <div id="scope-filter-hint" class="options-hint scope-filter-hint" style="display:none" aria-live="polite"></div>
        `)}
        ${accordionSection('sql-patterns-section', 'SQL Commands', `
            <div class="options-row"><span id="sql-pattern-summary" class="source-tag-summary"></span></div>
            <div id="sql-pattern-chips" class="source-tag-chips options-tags"></div>
            <div class="options-row">
                <button type="button" id="open-sql-query-history-from-filters" class="options-action-btn" title="Open the SQL Query History panel to browse all queries in this session">SQL Query History\u2026</button>
            </div>
        `)}`;
}

/** Single accordion section with collapsible body. */
function accordionSection(id: string, title: string, body: string): string {
    return /* html */ `
    <div class="filter-accordion" id="${id}" style="display:none">
        <button type="button" class="filter-accordion-header" title="Click to expand or collapse the ${title} filter section" aria-expanded="false">
            <span class="filter-accordion-arrow codicon codicon-chevron-right"></span>
            <span class="filter-accordion-title">${title}</span>
            <span class="filter-accordion-summary"></span>
        </button>
        <div class="filter-accordion-body">${body}</div>
    </div>`;
}

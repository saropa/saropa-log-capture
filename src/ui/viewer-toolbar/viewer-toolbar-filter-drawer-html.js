"use strict";
/**
 * Filter drawer HTML — drops below the toolbar when filter icon is clicked.
 *
 * Consolidates ALL filter controls that previously lived in the sidebar
 * Filters panel and footer level fly-up into a single compact drawer.
 *
 * Layout:
 *   Row 1: Level toggles + context slider + app-only (always visible when open)
 *   Row 2: Accordion sections (each with a summary line, expandable)
 *   Row 3: Presets, reset, active count
 *
 * All interior element IDs match the old filters-panel / level-flyup so
 * that existing scripts bind without changes.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFilterDrawerHtml = getFilterDrawerHtml;
/** Filter drawer HTML fragment — inserted after the search flyout. */
function getFilterDrawerHtml() {
    return /* html */ `
<div id="filter-drawer" class="filter-drawer u-hidden" role="region" aria-label="Filters">

    <!-- Row 1: Levels + app-only (always visible when drawer is open) -->
    <div class="filter-drawer-levels">
        <div class="filter-drawer-level-row">
            <div class="level-flyup-header">
                <button type="button" id="level-select-all" class="active">All</button>
                <button type="button" id="level-select-none">None</button>
            </div>
            <button id="level-info-toggle" class="level-circle active" title="Info" aria-label="Toggle Info level"><span class="level-emoji">\uD83D\uDFE2</span><span class="level-label">Info</span><span class="level-count"></span></button>
            <button id="level-warning-toggle" class="level-circle active" title="Warning" aria-label="Toggle Warning level"><span class="level-emoji">\uD83D\uDFE0</span><span class="level-label">Warning</span><span class="level-count"></span></button>
            <button id="level-error-toggle" class="level-circle active" title="Error" aria-label="Toggle Error level"><span class="level-emoji">\uD83D\uDD34</span><span class="level-label">Error</span><span class="level-count"></span></button>
            <button id="level-performance-toggle" class="level-circle active" title="Performance" aria-label="Toggle Performance level"><span class="level-emoji">\uD83D\uDFE3</span><span class="level-label">Perf</span><span class="level-count"></span></button>
            <button id="level-todo-toggle" class="level-circle active" title="TODO/FIXME" aria-label="Toggle TODO level"><span class="level-emoji">\u26AA</span><span class="level-label">TODO</span><span class="level-count"></span></button>
            <button id="level-debug-toggle" class="level-circle active" title="Debug/Trace" aria-label="Toggle Debug level"><span class="level-emoji">\uD83D\uDFE4</span><span class="level-label">Debug</span><span class="level-count"></span></button>
            <button id="level-notice-toggle" class="level-circle active" title="Notice" aria-label="Toggle Notice level"><span class="level-emoji">\uD83D\uDFE6</span><span class="level-label">Notice</span><span class="level-count"></span></button>
            <span class="filter-drawer-context">
                <span>Context: <span id="context-lines-label">3 lines</span></span>
                <input type="range" id="context-lines-slider" min="0" max="10" value="3" title="Context lines when filtering" aria-label="Context lines" />
            </span>
        </div>
        <label class="filter-drawer-app-only" title="Show only application output, hiding framework and system messages">
            <input type="checkbox" id="opt-app-only" />
            <span>App only</span>
        </label>
    </div>

    <!-- Row 2: Accordion filter sections -->
    <div class="filter-drawer-sections">
        ${getAccordionSections()}
    </div>

    <!-- Row 3: Presets + reset + active count -->
    <div class="filter-drawer-footer">
        <select id="preset-select" title="Quick Filters">
            <option value="">Presets</option>
        </select>
        <button id="reset-all-filters" class="options-action-btn" title="Clear all active filters">Reset all</button>
        <span class="filter-drawer-spacer"></span>
        <span id="filter-drawer-summary" class="filter-drawer-summary"></span>
    </div>
</div>`;
}
/** Accordion sections — each has a clickable header and collapsible body. */
function getAccordionSections() {
    return /* html */ `
        ${accordionSection('source-filter-section', 'Log Streams', `
            <div id="source-streams-intro" class="options-hint">Choose which inputs to show.</div>
            <div id="source-filter-list" class="options-row-list source-filter-list"></div>
        `)}
        ${accordionSection('log-tags-section', 'Log Tags', `
            <div class="options-row"><span id="source-tag-summary" class="source-tag-summary"></span></div>
            <div id="source-tag-chips" class="source-tag-chips options-tags"></div>
        `)}
        ${accordionSection('sql-patterns-section', 'SQL Patterns', `
            <div class="options-row"><span id="sql-pattern-summary" class="source-tag-summary"></span></div>
            <div id="sql-pattern-chips" class="source-tag-chips options-tags"></div>
            <div class="options-row">
                <button type="button" id="open-sql-query-history-from-filters" class="options-action-btn" title="Open SQL Query History">SQL Query History\u2026</button>
            </div>
        `)}
        ${accordionSection('class-tags-section', 'Code Tags', `
            <div class="options-row"><span id="class-tag-summary" class="source-tag-summary"></span></div>
            <div id="class-tag-chips" class="source-tag-chips options-tags"></div>
        `)}
        ${accordionSection('scope-section', 'Scope', `
            <div id="scope-status" class="options-hint">No active editor</div>
            <label class="options-row"><input type="radio" name="scope" value="all" checked /> All logs</label>
            <div id="scope-no-context-hint" class="options-hint">Open a source file to enable scope.</div>
            <div id="scope-narrowing-block" style="display:none">
                <label class="options-row"><input type="radio" name="scope" value="workspace" disabled /> Workspace</label>
                <label class="options-row"><input type="radio" name="scope" value="package" disabled /> Package</label>
                <label class="options-row"><input type="radio" name="scope" value="directory" disabled /> Directory</label>
                <label class="options-row"><input type="radio" name="scope" value="file" disabled /> File</label>
                <label class="options-row"><input type="checkbox" id="scope-hide-unattrib" /><span>Hide lines without file path</span></label>
                <div id="scope-filter-hint" class="options-hint scope-filter-hint" style="display:none" aria-live="polite"></div>
            </div>
        `)}
        ${accordionSection('output-channels-section', 'Output Channels', `
            <div id="output-channels-list"></div>
        `)}
        ${accordionSection('noise-section', 'Exclusions', `
            <label class="options-row"><input type="checkbox" id="opt-exclusions" /><span id="exclusion-label">Exclusions</span></label>
            <div class="exclusion-input-wrapper">
                <input id="exclusion-add-input" type="text" placeholder="e.g. verbose or /debug/i" />
                <button id="exclusion-add-btn" title="Add exclusion pattern">Add</button>
            </div>
            <div id="exclusion-chips" class="exclusion-chips"></div>
            <div class="options-hint" id="exclusion-count"></div>
        `)}`;
}
/** Single accordion section with collapsible body. */
function accordionSection(id, title, body) {
    return /* html */ `
    <div class="filter-accordion" id="${id}" style="display:none">
        <button type="button" class="filter-accordion-header" aria-expanded="false">
            <span class="filter-accordion-arrow">\u25B8</span>
            <span class="filter-accordion-title">${title}</span>
            <span class="filter-accordion-summary"></span>
        </button>
        <div class="filter-accordion-body" hidden>${body}</div>
    </div>`;
}
//# sourceMappingURL=viewer-toolbar-filter-drawer-html.js.map
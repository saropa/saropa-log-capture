/**
 * Filter drawer HTML — drops below the toolbar when filter icon is clicked.
 *
 * Compact dropdown with controls that directly filter log visibility:
 *   Row 1: Level toggles + context slider (always visible when open)
 *   Row 2: Accordion sections — Log Sources, Text Exclusions, File Scope
 *   Row 3: Saved Filters dropdown + active count
 *
 * Chip-heavy browsing sections (Message Tags, Code Origins, SQL Commands)
 * live in the Tags & Origins slide-out panel (icon bar), not here.
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

    <!-- Row 3: Saved Filters + active count -->
    <div class="filter-drawer-footer">
        <span class="filter-drawer-footer-label">Saved Filters:</span>
        <select id="preset-select" title="Apply a saved filter configuration (e.g. Errors Only, Warnings+)">
            <option value="">Default</option>
        </select>
        <span id="filter-drawer-summary" class="filter-drawer-summary" title="Summary of currently active filters"></span>
    </div>
</div>`;
}

/** Accordion sections — each has a clickable header and collapsible body. */
function getAccordionSections(): string {
    return /* html */ `
        ${accordionSection('log-sources-section', 'Log Sources', `
            <div class="options-row-list tier-filter-list">
                <fieldset class="tier-radio-group">
                    <legend title="Debug Adapter Protocol \u2014 the channel between VS Code and the Flutter debugger">Flutter DAP</legend>
                    <div class="tier-hint">stdout, stderr, console</div>
                    <label title="Show all output from your app code"><input type="radio" name="tier-flutter" value="all" checked /> All</label>
                    <label title="Show only warnings and errors from your app"><input type="radio" name="tier-flutter" value="warnplus" /> Warn+</label>
                    <label title="Hide all app output"><input type="radio" name="tier-flutter" value="none" /> None</label>
                </fieldset>
                <fieldset class="tier-radio-group">
                    <legend>Device</legend>
                    <div class="tier-hint">Logcat, Android system logs</div>
                    <label title="Show all device/system logs (critical errors like crashes and ANR are always visible)"><input type="radio" name="tier-device" value="all" /> All</label>
                    <label title="Show only device warnings and errors"><input type="radio" name="tier-device" value="warnplus" checked /> Warn+</label>
                    <label title="Hide device/system logs (critical errors remain visible)"><input type="radio" name="tier-device" value="none" /> None</label>
                </fieldset>
                <fieldset class="tier-radio-group">
                    <legend>External</legend>
                    <div class="tier-hint">Saved logs, terminal, browser, drift-perf</div>
                    <label title="Show all external source output"><input type="radio" name="tier-external" value="all" /> All</label>
                    <label title="Show only warnings and errors from external sources"><input type="radio" name="tier-external" value="warnplus" checked /> Warn+</label>
                    <label title="Hide all external source output"><input type="radio" name="tier-external" value="none" /> None</label>
                </fieldset>
            </div>
        `)}
        ${accordionSection('exclusions-section', 'Text Exclusions', `
            <div class="exclusion-input-wrapper">
                <label class="exclusion-toggle" title="Enable or disable exclusion pattern filtering"><input type="checkbox" id="opt-exclusions" /><span id="exclusion-label" class="u-sr-only">Exclusion patterns</span></label>
                <input id="exclusion-add-input" type="text" placeholder="e.g. verbose or /debug/i" title="Enter a text pattern or /regex/i to exclude matching log lines" />
                <button id="exclusion-add-btn" title="Add this pattern to the exclusion list">Add</button>
            </div>
            <div id="exclusion-chips" class="exclusion-chips"></div>
            <div class="options-hint" id="exclusion-count"></div>
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

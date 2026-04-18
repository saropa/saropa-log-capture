/**
 * Filter panel HTML — full-height slide-out panel in the panel-slot.
 *
 * Opened by the toolbar filter button via setActivePanel('filters').
 * Layout: levels row at top, then vertical tab sidebar (left) with
 * panel content area (right).
 *
 * Tabs: Log Sources, Exclusions, File Scope, Message Tags, Source Classes,
 * SQL Commands. Each has an icon, toggleable label, and count suffix.
 * Click tab bar whitespace to toggle labels (persisted in webview state).
 */

/** Filter panel HTML — inserted into #panel-slot. */
export function getFilterDrawerHtml(): string {
    return /* html */ `
<div id="filters-panel" class="filters-panel" role="region" aria-label="Filters">
    <div class="filters-panel-header">
        <span>Filters</span>
        <button class="filters-panel-close" type="button" title="Close" aria-label="Close Filters">
            <span class="codicon codicon-close"></span>
        </button>
    </div>

    <!-- Levels row -->
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

    <!-- Vertical tab sidebar (left) + panel content (right) -->
    <div class="filter-tab-layout">
        <div class="filter-tab-bar" role="tablist" aria-label="Filter sections"
             title="Click background to show or hide tab labels">
            ${getFilterTabs()}
        </div>
        <div class="filter-tab-panels">
            ${getFilterTabPanels()}
        </div>
    </div>

    <!-- Hidden preset select — kept for backward compat with presets script -->
    <select id="preset-select" class="u-hidden" aria-hidden="true">
        <option value="">Default</option>
    </select>
    <span id="filter-drawer-summary" class="filter-drawer-summary u-hidden" aria-hidden="true"></span>
</div>`;
}

/** Tab buttons — each with a codicon, label, and count suffix span. */
function getFilterTabs(): string {
    return /* html */ `
        ${filterTab('log-sources', 'broadcast', 'Log Sources')}
        ${filterTab('exclusions', 'exclude', 'Exclusions')}
        ${filterTab('scope', 'folder-opened', 'File Scope')}
        ${filterTab('log-tags', 'tag', 'Message Tags')}
        ${filterTab('class-tags', 'symbol-class', 'Source Classes')}
        ${filterTab('sql-patterns', 'database', 'SQL Commands')}`;
}

/** Single tab button with icon, label, and count. */
function filterTab(id: string, icon: string, label: string): string {
    return /* html */ `
    <button type="button" class="filter-tab" id="filter-tab-${id}"
            role="tab" aria-selected="false"
            aria-controls="${id}-section"
            title="${label}">
        <span class="codicon codicon-${icon}"></span>
        <span class="filter-tab-label">${label}</span>
        <span class="filter-tab-count" id="filter-tab-count-${id}"></span>
    </button>`;
}

/** Tab panel content — each panel wraps the section body. */
function getFilterTabPanels(): string {
    return /* html */ `
    <div class="filter-tab-panel" id="log-sources-section" role="tabpanel" style="display:none">
        <div class="options-row-list tier-filter-list">
            <fieldset class="tier-radio-group">
                <legend title="Debug Adapter Protocol \u2014 the channel between VS Code and the Flutter debugger">Flutter DAP <span class="tier-hint">\u2014 stdout, stderr, console</span></legend>
                <label title="Show all output from your app code"><input type="radio" name="tier-flutter" value="all" checked /> All</label>
                <label title="Show only warnings and errors from your app"><input type="radio" name="tier-flutter" value="warnplus" /> Warn+</label>
                <label title="Hide all app output"><input type="radio" name="tier-flutter" value="none" /> None</label>
            </fieldset>
            <fieldset class="tier-radio-group tier-radio-group-spaced">
                <legend>Device <span class="tier-hint">\u2014 Logcat, Android system logs</span></legend>
                <label title="Show all device/system logs (critical errors like crashes and ANR are always visible)"><input type="radio" name="tier-device" value="all" /> All</label>
                <label title="Show only device warnings and errors"><input type="radio" name="tier-device" value="warnplus" checked /> Warn+</label>
                <label title="Hide device/system logs (critical errors remain visible)"><input type="radio" name="tier-device" value="none" /> None</label>
            </fieldset>
            <fieldset class="tier-radio-group tier-radio-group-spaced">
                <legend>External <span class="tier-hint">\u2014 Saved logs, terminal, browser, drift-perf</span></legend>
                <label title="Show all external source output"><input type="radio" name="tier-external" value="all" /> All</label>
                <label title="Show only warnings and errors from external sources"><input type="radio" name="tier-external" value="warnplus" checked /> Warn+</label>
                <label title="Hide all external source output"><input type="radio" name="tier-external" value="none" /> None</label>
            </fieldset>
        </div>
    </div>
    <div class="filter-tab-panel" id="exclusions-section" role="tabpanel" style="display:none">
        <div class="exclusion-input-wrapper">
            <label class="exclusion-toggle" title="Enable or disable exclusion pattern filtering"><input type="checkbox" id="opt-exclusions" /><span id="exclusion-label" class="u-sr-only">Exclusion patterns</span></label>
            <input id="exclusion-add-input" type="text" placeholder="e.g. verbose or /debug/i" title="Enter a text pattern or /regex/i to exclude matching log lines" />
            <button id="exclusion-add-btn" title="Add this pattern to the exclusion list">Add</button>
        </div>
        <div id="exclusion-chips" class="exclusion-chips"></div>
        <div class="options-hint" id="exclusion-count"></div>
    </div>
    <div class="filter-tab-panel" id="scope-section" role="tabpanel" style="display:none">
        <div id="scope-status" class="options-hint"></div>
        <label class="options-row" title="Show all log lines regardless of source file"><input type="radio" name="scope" value="all" checked /> All logs</label>
        <label class="options-row" title="Show only logs from the current workspace"><input type="radio" name="scope" value="workspace" disabled /> Only workspace<span id="scope-suffix-workspace" class="scope-suffix"></span></label>
        <label class="options-row" title="Show only logs from the current package"><input type="radio" name="scope" value="package" disabled /> Only package<span id="scope-suffix-package" class="scope-suffix"></span></label>
        <label class="options-row" title="Show only logs from the active file\u2019s directory"><input type="radio" name="scope" value="directory" disabled /> Only directory<span id="scope-suffix-directory" class="scope-suffix"></span></label>
        <label class="options-row" title="Show only logs from the active file"><input type="radio" name="scope" value="file" disabled /> Only file<span id="scope-suffix-file" class="scope-suffix"></span></label>
        <label class="options-row scope-unattrib-row" title="When a scope is active, also exclude lines that have no source file from the debugger"><input type="checkbox" id="scope-hide-unattrib" /><span>Exclude lines with no source file</span></label>
        <div id="scope-filter-hint" class="options-hint scope-filter-hint" style="display:none" aria-live="polite"></div>
    </div>
    <div class="filter-tab-panel" id="log-tags-section" role="tabpanel" style="display:none">
        <div class="options-hint">Tags from your logging framework</div>
        <div class="options-row">
            <span id="source-tag-summary" class="source-tag-summary"></span>
        </div>
        <div id="source-tag-chips" class="source-tag-chips options-tags"></div>
    </div>
    <div class="filter-tab-panel" id="class-tags-section" role="tabpanel" style="display:none">
        <div class="options-hint">Class &amp; method where log originated</div>
        <div class="options-row">
            <span id="class-tag-summary" class="source-tag-summary"></span>
        </div>
        <div id="class-tag-chips" class="source-tag-chips options-tags"></div>
    </div>
    <div class="filter-tab-panel" id="sql-patterns-section" role="tabpanel" style="display:none">
        <div class="options-row">
            <span id="sql-pattern-summary" class="source-tag-summary"></span>
        </div>
        <div id="sql-pattern-chips" class="source-tag-chips options-tags"></div>
        <div class="options-row">
            <button type="button" id="open-sql-query-history-from-tags" class="options-action-btn" title="Open scrollable list of SQL fingerprints for this session">SQL Query History\u2026</button>
        </div>
    </div>`;
}

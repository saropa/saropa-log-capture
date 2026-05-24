/**
 * Toggle rows for scroll map + scrollbar settings — embedded in the main menu and in
 * `#scroll-chrome-context-menu` (right-click on minimap / native scrollbar).
 */
export function getScrollChromeMenuTogglesHtml(): string {
    return `
            <div class="context-menu-item context-menu-toggle" data-action="toggle-minimap-proportional" title="Proportional line width (minimap)">
                <span class="codicon codicon-graph" aria-hidden="true"></span>
                <span class="context-menu-check codicon codicon-check"></span>
                <span class="context-menu-label">Proportional line width (minimap)</span>
            </div>
            <div class="context-menu-item context-menu-toggle" data-action="toggle-show-scrollbar" title="Show native scrollbar">
                <span class="codicon codicon-layout" aria-hidden="true"></span>
                <span class="context-menu-check codicon codicon-check"></span>
                <span class="context-menu-label">Show native scrollbar</span>
            </div>
            <div class="context-menu-item context-menu-toggle" data-action="toggle-minimap-info-markers" title="Info / debug / notice on minimap">
                <span class="codicon codicon-info" aria-hidden="true"></span>
                <span class="context-menu-check codicon codicon-check"></span>
                <span class="context-menu-label">Info / debug / notice on minimap</span>
            </div>
            <div class="context-menu-item context-menu-toggle" data-action="toggle-minimap-sql-density" title="SQL density on minimap">
                <span class="codicon codicon-database" aria-hidden="true"></span>
                <span class="context-menu-check codicon codicon-check"></span>
                <span class="context-menu-label">SQL density on minimap</span>
            </div>
            <div class="context-menu-item context-menu-toggle" data-action="toggle-minimap-viewport-red-outline" title="Red outline on viewport">
                <span class="codicon codicon-circle-outline" aria-hidden="true"></span>
                <span class="context-menu-check codicon codicon-check"></span>
                <span class="context-menu-label">Red outline on viewport</span>
            </div>
            <div class="context-menu-item context-menu-toggle" data-action="toggle-minimap-outside-arrow" title="Yellow arrow outside minimap">
                <span class="codicon codicon-arrow-right" aria-hidden="true"></span>
                <span class="context-menu-check codicon codicon-check"></span>
                <span class="context-menu-label">Yellow arrow outside minimap</span>
            </div>`;
}

/** Compact menu: same toggles as the Scroll map & scrollbar submenu (minimap / scrollbar right-click). */
export function getScrollChromeContextMenuHtml(): string {
    return `<div id="scroll-chrome-context-menu" class="context-menu" role="menu" aria-label="Scroll map and scrollbar">
${getScrollChromeMenuTogglesHtml()}
</div>`;
}

/**
 * Returns the HTML for the log content context menu.
 * Column toggles (line numbers, timestamps, session elapsed, tag) live in the top-level
 * **Columns** submenu; layout toggles (wrap, spacing, line height, compression) live in
 * the top-level **Layout** submenu; the footer gear panel remains **Options** in the UI.
 */
export function getContextMenuHtml(): string {
    return `<div id="context-menu" class="context-menu">
    <div class="context-menu-item" data-action="open-source-link" data-source-action title="Open this source file in the editor">
        <span class="codicon codicon-go-to-file"></span> Open File
    </div>
    <div class="context-menu-item" data-action="copy-relative-path" data-source-action title="Copy the workspace-relative file path">
        <span class="codicon codicon-copy"></span> Copy Relative Path
    </div>
    <div class="context-menu-item" data-action="copy-full-path" data-source-action title="Copy the absolute file path">
        <span class="codicon codicon-copy"></span> Copy Full Path
    </div>
    <div class="context-menu-separator" data-source-action></div>
    <div class="context-menu-item" data-action="copy-error-warning-block" data-copy-error-warning-row style="display:none" title="Copy the full adjacent error or warning block">
        <span class="codicon codicon-error" data-ew-copy-icon aria-hidden="true"></span>
        <span data-ew-copy-label>Copy Error</span>
    </div>
    <div class="context-menu-item" data-action="copy-db-cluster-block" data-copy-db-cluster-row style="display:none" title="Copy all SQL lines in this database timestamp burst">
        <span class="codicon codicon-database"></span> Copy DB cluster
    </div>
    <div class="context-menu-separator" data-grouped-block-copy-separator style="display:none"></div>
    <!-- Copy & Export submenu: shortens main menu so it fits on screen; Copy to Search after separator (line-only). -->
    <div class="context-menu-submenu" id="copy-export-submenu">
        <span class="codicon codicon-clippy"></span> Copy & Export
        <span class="context-menu-arrow codicon codicon-chevron-right"></span>
        <div class="context-menu-submenu-content">
            <div class="context-menu-item" data-action="copy-selection" title="Copy the selected text to the clipboard">
                <span class="codicon codicon-copy"></span> Copy
                <span class="context-menu-shortcut">Ctrl+C</span>
            </div>
            <div class="context-menu-item" data-action="copy" data-line-action title="Copy this line as plain text">
                <span class="codicon codicon-copy"></span> Copy Line
            </div>
            <div class="context-menu-item" data-action="copy-decorated" data-line-action title="Copy this line with its decoration prefix (dot, line number, timestamp)">
                <span class="codicon codicon-copy"></span> Copy Line Decorated
            </div>
            <div class="context-menu-item" data-action="copy-line-number" data-line-action title="Copy this line's number to the clipboard">
                <span class="codicon codicon-list-ordered"></span> Copy Line Number
            </div>
            <div class="context-menu-item" data-action="copy-timestamp" data-line-action data-timestamp-action title="Copy this line's wall-clock timestamp">
                <span class="codicon codicon-clock"></span> Copy Timestamp
            </div>
            <div class="context-menu-separator" data-line-action></div>
            <div class="context-menu-item" data-action="copy-all" title="Copy every line in the log as plain text">
                <span class="codicon codicon-clippy"></span> Copy All
                <span class="context-menu-shortcut">Ctrl+Shift+A</span>
            </div>
            <div class="context-menu-item" data-action="copy-all-decorated" title="Copy every line with decoration prefixes">
                <span class="codicon codicon-clippy"></span> Copy All Decorated
            </div>
            <div class="context-menu-item" data-action="copy-as-snippet" title="Copy as a fenced code block for GitHub or GitLab">
                <span class="codicon codicon-markdown"></span> Copy as snippet (GitHub/GitLab)
            </div>
            <div class="context-menu-separator"></div>
            <div class="context-menu-item" data-action="copy-with-source" title="Copy the selection together with the matching source filename and code">
                <span class="codicon codicon-file-code"></span> Copy with source (filename + source code)
            </div>
            <div class="context-menu-item" data-action="select-all" title="Select all lines in the viewport">
                <span class="codicon codicon-list-flat"></span> Select All
                <span class="context-menu-shortcut">Ctrl+A</span>
            </div>
            <div class="context-menu-item" data-action="export-current-view" title="Export filtered log content to a file">
                <span class="codicon codicon-export"></span> Export current view…
            </div>
            <div class="context-menu-separator" data-line-action></div>
            <div class="context-menu-item" data-action="copy-to-search" data-line-action title="Paste this line's text into the search bar">
                <span class="codicon codicon-search"></span> Copy to Search
            </div>
        </div>
    </div>
    <div class="context-menu-item" data-action="open-source" data-line-action title="Open the source file referenced in this line">
        <span class="codicon codicon-go-to-file"></span> Open Source File
    </div>
    <div class="context-menu-separator" data-line-action></div>
    <div class="context-menu-submenu" data-line-action>
        <span class="codicon codicon-search"></span> Search
        <span class="context-menu-arrow codicon codicon-chevron-right"></span>
        <div class="context-menu-submenu-content">
            <div class="context-menu-item" data-action="search-codebase" title="Search the workspace source code for this line's text">
                <span class="codicon codicon-search"></span> Search Codebase
            </div>
            <div class="context-menu-item" data-action="search-sessions" title="Search all saved logs for this line's text">
                <span class="codicon codicon-history"></span> Search Past Logs
            </div>
            <div class="context-menu-separator"></div>
            <div class="context-menu-item" data-action="analyze-line" title="Find this line's pattern across all saved logs">
                <span class="codicon codicon-search-fuzzy"></span> Analyze Across Logs
            </div>
            <div class="context-menu-item" data-action="generate-report" title="Generate a markdown bug report from the current context">
                <span class="codicon codicon-report"></span> Generate Bug Report
            </div>
            <div class="context-menu-item" data-action="create-report-file" title="Create a bug report file in the workspace">
                <span class="codicon codicon-new-file"></span> Create Bug Report File
            </div>
        </div>
    </div>
    <div class="context-menu-submenu" data-line-action>
        <span class="codicon codicon-tools"></span> Actions
        <span class="context-menu-arrow codicon codicon-chevron-right"></span>
        <div class="context-menu-submenu-content">
            <div class="context-menu-item" data-action="pin" title="Pin this line to a sticky header strip at the top of the viewer">
                <span class="codicon codicon-pin"></span> Pin Line
                <span class="context-menu-shortcut">P</span>
            </div>
            <div class="context-menu-item" data-action="bookmark" title="Save this line to the Bookmarks panel for quick navigation">
                <span class="codicon codicon-bookmark"></span> Bookmark Line
                <span class="context-menu-shortcut">Ctrl+B</span>
            </div>
            <div class="context-menu-item" data-action="edit" title="Edit this line's text in place">
                <span class="codicon codicon-edit"></span> Edit Line
            </div>
            <div class="context-menu-item" data-action="show-context" title="Open a popover with surrounding log lines for this line">
                <span class="codicon codicon-list-flat"></span> View Context
            </div>
            <div class="context-menu-item" data-action="show-integration-context" title="Open a popover with integration adapter data for this line">
                <span class="codicon codicon-layers"></span> View Integration Context
            </div>
            <div class="context-menu-item" data-action="show-related-queries" data-line-action title="Open a popover listing SQL queries related to this line">
                <span class="codicon codicon-database"></span> View Related Queries
            </div>
            <div class="context-menu-item" data-action="show-code-quality" data-line-action title="Open a popover with code quality diagnostics for this file">
                <span class="codicon codicon-symbol-misc"></span> View Code Quality
            </div>
            <div class="context-menu-item" data-action="show-git-history" title="Open a popover with git blame for this line and the file's recent commits">
                <span class="codicon codicon-git-commit"></span> View Git History
            </div>
            <div class="context-menu-item" data-action="show-changelog-since" title="Look up what the workspace CHANGELOG released after the version on this line">
                <span class="codicon codicon-history"></span> What changed since this version?
            </div>
            <div class="context-menu-item" data-action="open-drift-advisor" data-line-action data-drift-line-action title="Open this SQL line in the Drift Advisor extension">
                <span class="codicon codicon-database"></span> Open in Drift Advisor
            </div>
            <div class="context-menu-item" data-action="find-static-sources-line" data-line-action data-static-sql-line-action title="Search Dart source files for code that could emit this SQL">
                <span class="codicon codicon-search"></span> Find possible Dart sources (static)
            </div>
            <div class="context-menu-item" data-action="explain-with-ai" data-line-action title="Ask an AI model to explain this log line">
                <span class="codicon codicon-sparkle"></span> Explain with AI
            </div>
            <div class="context-menu-item" data-action="explain-root-cause-hypotheses" data-line-action title="Ask an AI model to hypothesize root causes from detected signals">
                <span class="codicon codicon-lightbulb"></span> Explain signals
            </div>
            <div class="context-menu-separator"></div>
            <div class="context-menu-item" data-action="add-watch" title="Add this line's text as a watch pattern for live-capture alerts">
                <span class="codicon codicon-eye"></span> Add to Watch List
            </div>
        </div>
    </div>
    <div class="context-menu-submenu" id="hide-lines-submenu">
        <span class="codicon codicon-eye-closed"></span> Hide
        <span class="context-menu-arrow codicon codicon-chevron-right"></span>
        <div class="context-menu-submenu-content">
            <div class="context-menu-item" data-action="hide-line" data-line-action title="Hide this single line from the viewer">
                <span class="codicon codicon-eye-closed"></span> Hide This Line
            </div>
            <div class="context-menu-item" data-action="unhide-line" data-line-action data-requires-hidden title="Restore this hidden line">
                <span class="codicon codicon-eye"></span> Unhide This Line
            </div>
            <div class="context-menu-separator" data-selection-action></div>
            <div class="context-menu-item" data-action="hide-selection" data-selection-action title="Hide all lines in the current shift-click selection">
                <span class="codicon codicon-eye-closed"></span> Hide Selection
            </div>
            <div class="context-menu-item" data-action="unhide-selection" data-selection-action data-requires-hidden title="Restore hidden lines in the current selection">
                <span class="codicon codicon-eye"></span> Unhide Selection
            </div>
            <div class="context-menu-separator" data-text-selection-action></div>
            <div class="context-menu-item" data-action="hide-text-session" data-text-selection-action title="Hide lines matching the selected text for this log only">
                <span class="codicon codicon-eye-closed"></span> Hide Selection (This Log)
            </div>
            <div class="context-menu-item" data-action="hide-text-always" data-text-selection-action title="Add the selected text as a permanent exclusion pattern">
                <span class="codicon codicon-eye-closed"></span> Hide Selection (Always)
            </div>
            <div class="context-menu-item" data-action="add-exclusion" data-line-action title="Add this line's text as a permanent exclusion pattern">
                <span class="codicon codicon-eye-closed"></span> Hide This Text (Always)
            </div>
            <div class="context-menu-separator"></div>
            <div class="context-menu-item" data-action="hide-all-visible" title="Hide every currently visible line">
                <span class="codicon codicon-eye-closed"></span> Hide All Visible
            </div>
            <div class="context-menu-item" data-action="unhide-all" data-requires-any-hidden title="Restore all hidden lines">
                <span class="codicon codicon-eye"></span> Unhide All
            </div>
            <div class="context-menu-separator"></div>
            <div class="context-menu-item context-menu-toggle" data-action="toggle-show-blank-lines" title="Show or hide lines that are empty or whitespace-only">
                <span class="codicon codicon-whitespace" aria-hidden="true"></span>
                <span class="context-menu-check codicon codicon-check"></span>
                <span class="context-menu-label">Show blank lines</span>
                <span class="context-menu-shortcut">H</span>
            </div>
        </div>
    </div>
    <div class="context-menu-submenu">
        <span class="codicon codicon-table"></span> Columns
        <span class="context-menu-arrow codicon codicon-chevron-right"></span>
        <div class="context-menu-submenu-content">
            <div class="context-menu-item context-menu-toggle" data-action="toggle-line-numbers" title="Show the line number at the start of each row">
                <span class="codicon codicon-list-ordered" aria-hidden="true"></span>
                <span class="context-menu-check codicon codicon-check"></span>
                <span class="context-menu-label">Line numbers</span>
            </div>
            <div class="context-menu-item context-menu-toggle" data-action="toggle-timestamp" title="Show the wall-clock timestamp in each line's decoration prefix">
                <span class="codicon codicon-clock" aria-hidden="true"></span>
                <span class="context-menu-check codicon codicon-check"></span>
                <span class="context-menu-label">Timestamp</span>
            </div>
            <div class="context-menu-item context-menu-toggle" data-action="toggle-session-elapsed" title="Show elapsed time since the first log line (e.g. 5m 15s)">
                <span class="codicon codicon-watch" aria-hidden="true"></span>
                <span class="context-menu-check codicon codicon-check"></span>
                <span class="context-menu-label">Session elapsed</span>
            </div>
            <div class="context-menu-item context-menu-toggle" data-action="toggle-parsed-tag" title="Show the parsed source tag column (e.g. flutter, HWUI)">
                <span class="codicon codicon-tag" aria-hidden="true"></span>
                <span class="context-menu-check codicon codicon-check"></span>
                <span class="context-menu-label">Tag</span>
            </div>
        </div>
    </div>
    <div class="context-menu-submenu">
        <span class="codicon codicon-settings-gear"></span> Layout
        <span class="context-menu-arrow codicon codicon-chevron-right"></span>
        <div class="context-menu-submenu-content">
            <div class="context-menu-item context-menu-toggle" data-action="toggle-wrap" title="Wrap long lines to fit the viewer width">
                <span class="codicon codicon-word-wrap" aria-hidden="true"></span>
                <span class="context-menu-check codicon codicon-check"></span>
                <span class="context-menu-label">Word wrap</span>
                <span class="context-menu-shortcut">W</span>
            </div>
            <div class="context-menu-separator"></div>
            <div class="context-menu-item context-menu-toggle" data-action="toggle-spacing" title="Add extra vertical gaps between markers and level changes">
                <span class="codicon codicon-layout-panel" aria-hidden="true"></span>
                <span class="context-menu-check codicon codicon-check"></span>
                <span class="context-menu-label">Visual spacing</span>
                <span class="context-menu-shortcut">V</span>
            </div>
            <div class="context-menu-item context-menu-toggle" data-action="toggle-line-height" title="Double each row's height for easier reading (1.2 → 2.0 line-height)">
                <span class="codicon codicon-unfold" aria-hidden="true"></span>
                <span class="context-menu-check codicon codicon-check"></span>
                <span class="context-menu-label">Tall rows</span>
                <span class="context-menu-shortcut">Ctrl+Shift+Scroll</span>
            </div>
            <div class="context-menu-separator"></div>
            <div class="context-menu-item context-menu-toggle" data-action="toggle-compress-lines" title="Collapse runs of identical consecutive lines into one row with a count badge">
                <span class="codicon codicon-fold" aria-hidden="true"></span>
                <span class="context-menu-check codicon codicon-check"></span>
                <span class="context-menu-label">Compress lines (consecutive dupes)</span>
                <span class="context-menu-shortcut">C</span>
            </div>
            <div class="context-menu-item context-menu-toggle" data-action="toggle-compress-lines-global" title="Also collapse duplicate lines that are not adjacent to each other">
                <span class="codicon codicon-fold-down" aria-hidden="true"></span>
                <span class="context-menu-check codicon codicon-check"></span>
                <span class="context-menu-label">Compress lines (non-consecutive dupes)</span>
            </div>
        </div>
    </div>
</div>`;
}

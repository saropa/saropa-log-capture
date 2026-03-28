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
            <div class="context-menu-item context-menu-toggle" data-action="toggle-minimap-info-markers" title="Info markers on minimap">
                <span class="codicon codicon-info" aria-hidden="true"></span>
                <span class="context-menu-check codicon codicon-check"></span>
                <span class="context-menu-label">Info markers on minimap</span>
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
 * Layout toggles (wrap, decorations, timestamps, compression) use the top-level **Layout** submenu;
 * the footer gear panel remains **Options** in the UI.
 */
export function getContextMenuHtml(): string {
    const scrollToggles = getScrollChromeMenuTogglesHtml();
    return `<div id="context-menu" class="context-menu">
    <div class="context-menu-item" data-action="open-source-link" data-source-action>
        <span class="codicon codicon-go-to-file"></span> Open File
    </div>
    <div class="context-menu-item" data-action="copy-relative-path" data-source-action>
        <span class="codicon codicon-copy"></span> Copy Relative Path
    </div>
    <div class="context-menu-item" data-action="copy-full-path" data-source-action>
        <span class="codicon codicon-copy"></span> Copy Full Path
    </div>
    <div class="context-menu-separator" data-source-action></div>
    <!-- Copy & Export submenu: shortens main menu so it fits on screen; Copy to Search after separator (line-only). -->
    <div class="context-menu-submenu" id="copy-export-submenu">
        <span class="codicon codicon-clippy"></span> Copy & Export
        <span class="context-menu-arrow codicon codicon-chevron-right"></span>
        <div class="context-menu-submenu-content">
            <div class="context-menu-item" data-action="copy-selection">
                <span class="codicon codicon-copy"></span> Copy
            </div>
            <div class="context-menu-item" data-action="copy" data-line-action>
                <span class="codicon codicon-copy"></span> Copy Line
            </div>
            <div class="context-menu-item" data-action="copy-all">
                <span class="codicon codicon-clippy"></span> Copy All
            </div>
            <div class="context-menu-item" data-action="copy-all-decorated">
                <span class="codicon codicon-clippy"></span> Copy All Decorated
            </div>
            <div class="context-menu-item" data-action="copy-as-snippet">
                <span class="codicon codicon-markdown"></span> Copy as snippet (GitHub/GitLab)
            </div>
            <div class="context-menu-item" data-action="copy-with-source">
                <span class="codicon codicon-file-code"></span> Copy with source (filename + source code)
            </div>
            <div class="context-menu-item" data-action="select-all">
                <span class="codicon codicon-list-flat"></span> Select All
            </div>
            <div class="context-menu-item" data-action="export-current-view">
                <span class="codicon codicon-export"></span> Export current view…
            </div>
            <div class="context-menu-separator" data-line-action></div>
            <div class="context-menu-item" data-action="copy-to-search" data-line-action>
                <span class="codicon codicon-search"></span> Copy to Search
            </div>
        </div>
    </div>
    <div class="context-menu-item" data-action="open-source" data-line-action>
        <span class="codicon codicon-go-to-file"></span> Open Source File
    </div>
    <div class="context-menu-separator" data-line-action></div>
    <div class="context-menu-submenu" data-line-action>
        <span class="codicon codicon-search"></span> Search
        <span class="context-menu-arrow codicon codicon-chevron-right"></span>
        <div class="context-menu-submenu-content">
            <div class="context-menu-item" data-action="search-codebase">
                <span class="codicon codicon-search"></span> Search Codebase
            </div>
            <div class="context-menu-item" data-action="search-sessions">
                <span class="codicon codicon-history"></span> Search Past Logs
            </div>
            <div class="context-menu-separator"></div>
            <div class="context-menu-item" data-action="analyze-line">
                <span class="codicon codicon-search-fuzzy"></span> Analyze Across Logs
            </div>
            <div class="context-menu-item" data-action="generate-report">
                <span class="codicon codicon-report"></span> Generate Bug Report
            </div>
            <div class="context-menu-item" data-action="create-report-file">
                <span class="codicon codicon-new-file"></span> Create Bug Report File
            </div>
        </div>
    </div>
    <div class="context-menu-submenu" data-line-action>
        <span class="codicon codicon-tools"></span> Actions
        <span class="context-menu-arrow codicon codicon-chevron-right"></span>
        <div class="context-menu-submenu-content">
            <div class="context-menu-item" data-action="pin">
                <span class="codicon codicon-pin"></span> Pin Line
            </div>
            <div class="context-menu-item" data-action="bookmark">
                <span class="codicon codicon-bookmark"></span> Bookmark Line
            </div>
            <div class="context-menu-item" data-action="edit">
                <span class="codicon codicon-edit"></span> Edit Line
            </div>
            <div class="context-menu-item" data-action="show-context">
                <span class="codicon codicon-list-flat"></span> Show Context
            </div>
            <div class="context-menu-item" data-action="show-integration-context">
                <span class="codicon codicon-layers"></span> Show Integration Context
            </div>
            <div class="context-menu-item" data-action="show-related-queries" data-line-action>
                <span class="codicon codicon-database"></span> Show Related Queries
            </div>
            <div class="context-menu-item" data-action="show-code-quality" data-line-action>
                <span class="codicon codicon-symbol-misc"></span> Show code quality
            </div>
            <div class="context-menu-item" data-action="open-drift-advisor" data-line-action data-drift-line-action>
                <span class="codicon codicon-database"></span> Open in Drift Advisor
            </div>
            <div class="context-menu-item" data-action="find-static-sources-line" data-line-action data-static-sql-line-action>
                <span class="codicon codicon-search"></span> Find possible Dart sources (static)
            </div>
            <div class="context-menu-item" data-action="explain-with-ai" data-line-action>
                <span class="codicon codicon-sparkle"></span> Explain with AI
            </div>
            <div class="context-menu-item" data-action="explain-root-cause-hypotheses" data-line-action>
                <span class="codicon codicon-lightbulb"></span> Explain signals
            </div>
            <div class="context-menu-separator"></div>
            <div class="context-menu-item" data-action="add-watch">
                <span class="codicon codicon-eye"></span> Add to Watch List
            </div>
        </div>
    </div>
    <div class="context-menu-submenu" id="hide-lines-submenu">
        <span class="codicon codicon-eye-closed"></span> Hide
        <span class="context-menu-arrow codicon codicon-chevron-right"></span>
        <div class="context-menu-submenu-content">
            <div class="context-menu-item" data-action="hide-line" data-line-action>
                <span class="codicon codicon-eye-closed"></span> Hide This Line
            </div>
            <div class="context-menu-item" data-action="unhide-line" data-line-action data-requires-hidden>
                <span class="codicon codicon-eye"></span> Unhide This Line
            </div>
            <div class="context-menu-separator" data-selection-action></div>
            <div class="context-menu-item" data-action="hide-selection" data-selection-action>
                <span class="codicon codicon-eye-closed"></span> Hide Selection
            </div>
            <div class="context-menu-item" data-action="unhide-selection" data-selection-action data-requires-hidden>
                <span class="codicon codicon-eye"></span> Unhide Selection
            </div>
            <div class="context-menu-separator" data-text-selection-action></div>
            <div class="context-menu-item" data-action="hide-text-session" data-text-selection-action>
                <span class="codicon codicon-eye-closed"></span> Hide Selection (This Log)
            </div>
            <div class="context-menu-item" data-action="hide-text-always" data-text-selection-action>
                <span class="codicon codicon-eye-closed"></span> Hide Selection (Always)
            </div>
            <div class="context-menu-item" data-action="add-exclusion" data-line-action>
                <span class="codicon codicon-eye-closed"></span> Hide This Text (Always)
            </div>
            <div class="context-menu-separator"></div>
            <div class="context-menu-item" data-action="hide-all-visible">
                <span class="codicon codicon-eye-closed"></span> Hide All Visible
            </div>
            <div class="context-menu-item" data-action="unhide-all" data-requires-any-hidden>
                <span class="codicon codicon-eye"></span> Unhide All
            </div>
            <div class="context-menu-separator"></div>
            <div class="context-menu-item context-menu-toggle" data-action="toggle-hide-blank-lines">
                <span class="codicon codicon-eye-closed" aria-hidden="true"></span>
                <span class="context-menu-check codicon codicon-check"></span>
                <span class="context-menu-label">Hide blank lines</span>
            </div>
        </div>
    </div>
    <div class="context-menu-submenu">
        <span class="codicon codicon-settings-gear"></span> Layout
        <span class="context-menu-arrow codicon codicon-chevron-right"></span>
        <div class="context-menu-submenu-content">
            <div class="context-menu-item context-menu-toggle" data-action="toggle-wrap">
                <span class="codicon codicon-word-wrap" aria-hidden="true"></span>
                <span class="context-menu-check codicon codicon-check"></span>
                <span class="context-menu-label">Word wrap</span>
            </div>
            <div class="context-menu-item context-menu-toggle" data-action="toggle-decorations">
                <span class="codicon codicon-symbol-event" aria-hidden="true"></span>
                <span class="context-menu-check codicon codicon-check"></span>
                <span class="context-menu-label">Line decorations (dot, number, time)</span>
            </div>
            <div class="context-menu-item context-menu-toggle" data-action="toggle-timestamp">
                <span class="codicon codicon-clock" aria-hidden="true"></span>
                <span class="context-menu-check codicon codicon-check"></span>
                <span class="context-menu-label">Timestamp</span>
            </div>
            <div class="context-menu-item context-menu-toggle" data-action="toggle-session-elapsed">
                <span class="codicon codicon-watch" aria-hidden="true"></span>
                <span class="context-menu-check codicon codicon-check"></span>
                <span class="context-menu-label">Session elapsed</span>
            </div>
            <div class="context-menu-item context-menu-toggle" data-action="toggle-spacing">
                <span class="codicon codicon-layout-panel" aria-hidden="true"></span>
                <span class="context-menu-check codicon codicon-check"></span>
                <span class="context-menu-label">Visual spacing</span>
            </div>
            <div class="context-menu-item context-menu-toggle" data-action="toggle-line-height">
                <span class="codicon codicon-unfold" aria-hidden="true"></span>
                <span class="context-menu-check codicon codicon-check"></span>
                <span class="context-menu-label">Comfortable line height</span>
            </div>
            <div class="context-menu-item context-menu-toggle" data-action="toggle-compress-lines">
                <span class="codicon codicon-fold" aria-hidden="true"></span>
                <span class="context-menu-check codicon codicon-check"></span>
                <span class="context-menu-label">Compress lines (consecutive dupes)</span>
            </div>
            <div class="context-menu-item context-menu-toggle" data-action="toggle-compress-lines-global">
                <span class="codicon codicon-fold-down" aria-hidden="true"></span>
                <span class="context-menu-check codicon codicon-check"></span>
                <span class="context-menu-label">Compress lines (non-consecutive dupes)</span>
            </div>
        </div>
    </div>
    <div class="context-menu-submenu" id="scroll-chrome-submenu">
        <span class="codicon codicon-layout-sidebar-right"></span> Scroll map & scrollbar
        <span class="context-menu-arrow codicon codicon-chevron-right"></span>
        <div class="context-menu-submenu-content">
${scrollToggles}
        </div>
    </div>
</div>`;
}

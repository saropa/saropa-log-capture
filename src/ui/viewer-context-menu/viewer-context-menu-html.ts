/** Returns the HTML for the context menu element. */
export function getContextMenuHtml(): string {
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
                <span class="codicon codicon-history"></span> Search Past Sessions
            </div>
            <div class="context-menu-separator"></div>
            <div class="context-menu-item" data-action="analyze-line">
                <span class="codicon codicon-search-fuzzy"></span> Analyze Across Sessions
            </div>
            <div class="context-menu-item" data-action="generate-report">
                <span class="codicon codicon-report"></span> Generate Bug Report
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
            <div class="context-menu-separator"></div>
            <div class="context-menu-item" data-action="add-watch">
                <span class="codicon codicon-eye"></span> Add to Watch List
            </div>
            <div class="context-menu-item" data-action="add-exclusion">
                <span class="codicon codicon-eye-closed"></span> Add to Exclusions
            </div>
        </div>
    </div>
    <div class="context-menu-submenu">
        <span class="codicon codicon-settings-gear"></span> Options
        <span class="context-menu-arrow codicon codicon-chevron-right"></span>
        <div class="context-menu-submenu-content">
            <div class="context-menu-item context-menu-toggle" data-action="toggle-wrap">
                <span class="context-menu-check codicon codicon-check"></span>
                <span>Word wrap</span>
            </div>
            <div class="context-menu-item context-menu-toggle" data-action="toggle-decorations">
                <span class="context-menu-check codicon codicon-check"></span>
                <span>Line prefix</span>
            </div>
            <div class="context-menu-item context-menu-toggle" data-action="toggle-spacing">
                <span class="context-menu-check codicon codicon-check"></span>
                <span>Visual spacing</span>
            </div>
            <div class="context-menu-item context-menu-toggle" data-action="toggle-line-height">
                <span class="context-menu-check codicon codicon-check"></span>
                <span>Comfortable line height</span>
            </div>
            <div class="context-menu-item context-menu-toggle" data-action="toggle-hide-blank-lines">
                <span class="context-menu-check codicon codicon-check"></span>
                <span>Hide blank lines</span>
            </div>
        </div>
    </div>
</div>`;
}

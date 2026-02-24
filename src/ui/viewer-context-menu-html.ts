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
    <div class="context-menu-item" data-action="copy-decorated" data-line-action>
        <span class="codicon codicon-copy"></span> Copy Line Decorated
    </div>
    <div class="context-menu-item" data-action="copy-all">
        <span class="codicon codicon-clippy"></span> Copy All
    </div>
    <div class="context-menu-item" data-action="copy-all-decorated">
        <span class="codicon codicon-clippy"></span> Copy All Decorated
    </div>
    <div class="context-menu-item" data-action="select-all">
        <span class="codicon codicon-list-flat"></span> Select All
    </div>
    <div class="context-menu-separator" data-line-action></div>
    <div class="context-menu-item" data-action="copy-to-search" data-line-action>
        <span class="codicon codicon-search"></span> Copy to Search
    </div>
    <div class="context-menu-separator" data-line-action></div>
    <div class="context-menu-item" data-action="search-codebase" data-line-action>
        <span class="codicon codicon-search"></span> Search Codebase
    </div>
    <div class="context-menu-item" data-action="search-sessions" data-line-action>
        <span class="codicon codicon-history"></span> Search Past Sessions
    </div>
    <div class="context-menu-item" data-action="analyze-line" data-line-action>
        <span class="codicon codicon-search-fuzzy"></span> Analyze Across Sessions
    </div>
    <div class="context-menu-item" data-action="generate-report" data-line-action>
        <span class="codicon codicon-report"></span> Generate Bug Report
    </div>
    <div class="context-menu-separator" data-line-action></div>
    <div class="context-menu-item" data-action="open-source" data-line-action>
        <span class="codicon codicon-go-to-file"></span> Open Source File
    </div>
    <div class="context-menu-item" data-action="show-context" data-line-action>
        <span class="codicon codicon-list-flat"></span> Show Context
    </div>
    <div class="context-menu-separator" data-line-action></div>
    <div class="context-menu-item" data-action="pin" data-line-action>
        <span class="codicon codicon-pin"></span> Pin Line
    </div>
    <div class="context-menu-item" data-action="bookmark" data-line-action>
        <span class="codicon codicon-bookmark"></span> Bookmark Line
    </div>
    <div class="context-menu-item" data-action="edit" data-line-action>
        <span class="codicon codicon-edit"></span> Edit Line
    </div>
    <div class="context-menu-separator" data-line-action></div>
    <div class="context-menu-item" data-action="add-watch" data-line-action>
        <span class="codicon codicon-eye"></span> Add to Watch List
    </div>
    <div class="context-menu-item" data-action="add-exclusion" data-line-action>
        <span class="codicon codicon-eye-closed"></span> Add to Exclusions
    </div>
</div>`;
}

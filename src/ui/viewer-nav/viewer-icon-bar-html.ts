/**
 * Icon bar HTML markup for the vertical activity bar.
 * Extracted from viewer-icon-bar.ts to keep that file under the 300-line limit.
 *
 * Tools open a slide-out panel in `#panel-slot` with mutual exclusion. In-log search lives only
 * in the session-nav field (top bar); use Ctrl+F / focus the search input — not an icon here.
 *
 * Optional text labels: click the bar background or separator (not a button) to toggle;
 * preference is persisted in webview state (iconBarLabelsVisible).
 */

/** Generate the icon bar HTML with codicon-based buttons and optional labels. */
export function getIconBarHtml(): string {
    return /* html */ `
<div id="icon-bar" role="toolbar" aria-label="Log viewer tools" title="Click bar to show or hide icon labels">
    <button id="ib-sessions" class="ib-icon" tabindex="0" title="Click to open/close — browse and switch between log sessions in this project" aria-label="Logs">
        <span class="codicon codicon-files"></span><span class="ib-label">Logs</span>
    </button>
    <button id="ib-find" class="ib-icon" tabindex="0" title="Click to open/close — search across all log files in this project (Ctrl+Shift+F)" aria-label="Find in Files (Ctrl+Shift+F)">
        <span class="codicon codicon-search"></span><span class="ib-label">Find in Files</span>
    </button>
    <button id="ib-signal" class="ib-icon" tabindex="0" title="Click to open/close — signals, errors, warnings, and performance analysis" aria-label="Signals">
        <span class="codicon codicon-pulse"></span><span id="ib-signal-badge" class="ib-badge"></span><span class="ib-label">Signals<span id="ib-signal-count" class="ib-count"></span></span>
    </button>
    <button id="ib-sql-query-history" class="ib-icon" tabindex="0" title="Click to open/close — browse SQL queries captured during this session" aria-label="SQL Query History">
        <span class="codicon codicon-database"></span><span id="ib-sql-badge" class="ib-badge"></span><span class="ib-label">SQL History<span id="ib-sql-count" class="ib-count"></span></span>
    </button>
    <div class="ib-separator"></div>
    <button id="ib-crashlytics" class="ib-icon" tabindex="0" title="Click to open/close — Firebase Crashlytics crash reports" aria-label="Crashlytics">
        <span class="codicon codicon-flame"></span><span id="ib-crashlytics-badge" class="ib-badge"></span><span class="ib-label">Crashlytics<span id="ib-crashlytics-count" class="ib-count"></span></span>
    </button>
    <button id="ib-collections" class="ib-icon" tabindex="0" title="Click to open/close — group related log sessions and files into named collections" aria-label="Collections">
        <span class="codicon codicon-folder-library"></span><span id="ib-collections-badge" class="ib-badge"></span><span class="ib-label">Collections<span id="ib-collections-count" class="ib-count"></span></span>
    </button>
    <button id="ib-bookmarks" class="ib-icon" tabindex="0" title="Click to open/close — view and manage bookmarked log lines" aria-label="Bookmarks">
        <span class="codicon codicon-bookmark"></span><span id="ib-bookmarks-badge" class="ib-badge"></span><span class="ib-label">Bookmarks<span id="ib-bookmarks-count" class="ib-count"></span></span>
    </button>
    <button id="ib-trash" class="ib-icon" tabindex="0" title="Click to open/close — view and restore deleted log sessions" aria-label="Trash">
        <span class="codicon codicon-trash"></span><span id="ib-trash-badge" class="ib-badge"></span><span class="ib-label">Trash<span id="ib-trash-count" class="ib-count"></span></span>
    </button>
    <div class="ib-separator"></div>
    <button id="ib-options" class="ib-icon" tabindex="0" title="Click to open/close — display, layout, and audio settings" aria-label="Options">
        <span class="codicon codicon-settings-gear"></span><span class="ib-label">Options</span>
    </button>
    <button id="ib-about" class="ib-icon" tabindex="0" title="Click to open/close — version info, links, and help" aria-label="About Saropa">
        <span class="codicon codicon-home"></span><span class="ib-label">About</span>
    </button>
</div>`;
}

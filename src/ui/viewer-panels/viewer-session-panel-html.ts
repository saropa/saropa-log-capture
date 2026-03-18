/**
 * Session history panel HTML template for the webview.
 * Used by viewer-session-panel.ts.
 * Header: "Project Logs" plus optional " · <path>" (hidden when default folder); whole header span is clickable.
 * Includes a date-range select (All time / Last 7 days / Last 30 days) persisted with session display options.
 */

/** Generate the session panel HTML. */
export function getSessionPanelHtml(): string {
    return /* html */ `
<div id="session-panel" class="session-panel" role="region" aria-label="Project Logs">
    <div id="session-resize" class="session-panel-resize" aria-hidden="true"></div>
    <div class="session-panel-header">
        <span id="session-header-clickable" class="session-header-clickable" title="Click to choose folder">
            <span class="session-panel-title">Project Logs</span>
            <span id="session-header-path" class="session-header-path" style="display:none"><span class="session-path-sep" aria-hidden="true"> · </span><span id="session-path-text"></span></span>
        </span>
        <button id="session-reset-root" class="session-panel-action" type="button" title="Use default folder" aria-label="Use default folder" style="display:none">
            <span class="codicon codicon-debug-restart"></span>
        </button>
        <div class="session-panel-actions">
            <button id="session-refresh" class="session-panel-action" type="button" title="Refresh" aria-label="Refresh session list">
                <span class="codicon codicon-refresh"></span>
            </button>
            <button id="session-close" class="session-panel-close" type="button" title="Close" aria-label="Close Project Logs"><span class="codicon codicon-close"></span></button>
        </div>
    </div>
    <div class="session-panel-toggles">
        <select id="session-date-range" class="session-date-range-select" title="Filter by date" aria-label="Filter sessions by date">
            <option value="all">All time</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
        </select>
        <button id="session-toggle-strip" class="session-toggle-btn" type="button" title="Show date/time in filenames" aria-label="Show date and time in filenames"><span class="codicon codicon-calendar"></span> Dates</button>
        <button id="session-toggle-normalize" class="session-toggle-btn" type="button" title="Tidy names" aria-label="Tidy session names"><span class="codicon codicon-edit"></span> Tidy</button>
        <button id="session-toggle-headings" class="session-toggle-btn" type="button" title="Group by day" aria-label="Group by day"><span class="codicon codicon-list-tree"></span> Days</button>
        <button id="session-toggle-reverse" class="session-toggle-btn session-sort-btn" type="button" title="Reverse sort order" aria-label="Reverse sort order"><span class="codicon codicon-sort-precedence"></span></button>
        <button id="session-toggle-latest" class="session-toggle-btn" type="button" title="Show only latest of each name" aria-label="Show only latest of each name"><span class="codicon codicon-pinned"></span> Latest</button>
        <button id="session-filter-tags" class="session-toggle-btn" type="button" title="Filter by correlation tag" aria-label="Filter by correlation tag"><span class="codicon codicon-filter"></span> Tags</button>
    </div>
    <div id="session-tags-section" class="session-tags-section" style="display:none">
        <div id="session-tag-chips" class="session-tag-chips"></div>
    </div>
    <div class="session-panel-content">
        <div id="session-list"></div>
        <div id="session-list-pagination" class="session-list-pagination" style="display:none" aria-label="Session list pagination"></div>
        <div id="session-empty" class="session-empty">No sessions found</div>
        <div id="session-loading" class="session-loading" style="display:none">
            <div class="session-loading-bar"><div class="session-loading-bar-fill"></div></div>
            <div id="session-loading-label" class="session-loading-label">Loading…</div>
            <div class="session-loading-shimmer">
                <div class="session-shimmer-line"></div>
                <div class="session-shimmer-line"></div>
                <div class="session-shimmer-line"></div>
                <div class="session-shimmer-line session-shimmer-line-short"></div>
            </div>
        </div>
    </div>
</div>`;
}

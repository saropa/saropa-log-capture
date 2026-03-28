/**
 * Toolbar HTML for the log viewer webview.
 *
 * Replaces the session-nav header and footer with a single persistent bar.
 * Fixed-width elements (nav, icons, level dots, line count) sit left;
 * the variable-width filename fills remaining space on the right with ellipsis.
 *
 * Element IDs preserved from the old footer/header so existing scripts
 * continue to work without changes:
 *   `#level-menu-btn`, `#line-count`, `#hidden-lines-counter`,
 *   `#footer-selection`, `#filter-badge`, `#footer-text`.
 */

import { getRunNavHtml } from '../viewer-nav/viewer-run-nav';

export interface ToolbarHtmlOptions {
    readonly version: string;
}

/** Toolbar HTML: nav arrows, icons, level dots, line count, filename. */
export function getToolbarHtml(opts: ToolbarHtmlOptions): string {
    const ver = opts.version ? `v${opts.version}` : '';
    return /* html */ `
<div id="viewer-toolbar" class="viewer-toolbar" role="toolbar" aria-label="Log viewer toolbar" data-version="${ver}">
    <div class="toolbar-left">
        <button type="button" id="session-prev" class="toolbar-icon-btn" title="Previous log (older)" aria-label="Previous log (older)" disabled>
            <span class="codicon codicon-chevron-left" aria-hidden="true"></span>
        </button>
        <span class="nav-bar-label">Log <span id="session-nav-current">1</span> of <span id="session-nav-total">1</span></span>
        <button type="button" id="session-next" class="toolbar-icon-btn" title="Next log (newer)" aria-label="Next log (newer)" disabled>
            <span class="codicon codicon-chevron-right" aria-hidden="true"></span>
        </button>
        ${getRunNavHtml()}
        <span class="toolbar-sep"></span>
        <button type="button" id="toolbar-search-btn" class="toolbar-icon-btn" title="Search in log (Ctrl+F)" aria-label="Toggle search" aria-expanded="false">
            <span class="codicon codicon-search" aria-hidden="true"></span>
        </button>
        <button type="button" id="toolbar-filter-btn" class="toolbar-icon-btn" title="Filters" aria-label="Toggle filter drawer" aria-expanded="false">
            <span class="codicon codicon-filter" aria-hidden="true"></span>
            <span id="toolbar-filter-count" class="toolbar-badge"></span>
        </button>
        <button type="button" id="toolbar-actions-btn" class="toolbar-icon-btn toolbar-actions-trigger" title="Actions" aria-label="Actions menu" aria-haspopup="true" aria-expanded="false">
            <span class="codicon codicon-kebab-vertical" aria-hidden="true"></span>
        </button>
        <span class="toolbar-sep"></span>
        <span id="level-menu-btn" class="level-summary" role="button" aria-label="Level filters" title="Level filters — click a dot to toggle">
            <span class="level-dot-group" data-level="info" title="Info" role="img" aria-label="Info"><span class="level-dot active level-dot-info"></span><span class="dot-count"></span></span>
            <span class="level-dot-group" data-level="warning" title="Warning" role="img" aria-label="Warning"><span class="level-dot active level-dot-warning"></span><span class="dot-count"></span></span>
            <span class="level-dot-group" data-level="error" title="Error" role="img" aria-label="Error"><span class="level-dot active level-dot-error"></span><span class="dot-count"></span></span>
            <span class="level-dot-group" data-level="performance" title="Perf" role="img" aria-label="Performance"><span class="level-dot active level-dot-performance"></span><span class="dot-count"></span></span>
            <span class="level-dot-group" data-level="todo" title="TODO" role="img" aria-label="TODO"><span class="level-dot active level-dot-todo"></span><span class="dot-count"></span></span>
            <span class="level-dot-group" data-level="debug" title="Debug" role="img" aria-label="Debug"><span class="level-dot active level-dot-debug"></span><span class="dot-count"></span></span>
            <span class="level-dot-group" data-level="notice" title="Notice" role="img" aria-label="Notice"><span class="level-dot active level-dot-notice"></span><span class="dot-count"></span></span>
            <span id="level-trigger-label" class="level-trigger-label">All</span>
        </span>
        <span class="toolbar-sep"></span>
        <span id="line-count" aria-live="polite" aria-atomic="true"></span>
        <span id="hidden-lines-counter" class="hidden-lines-counter u-hidden" role="button" title="Click to peek, double-click to manage" aria-label="Hidden lines counter">
            <span class="codicon codicon-eye-closed"></span>
            <span class="hidden-count-text"></span>
        </span>
        <span id="footer-selection" class="footer-selection"></span>
        <span id="filter-badge" class="filter-badge" role="button" title="Active filters" aria-label="Active filters"></span>
        <button type="button" id="session-perf-chip" class="session-perf-chip u-hidden" title="Open Performance panel" aria-label="Performance data available">Performance</button>
    </div>
    <div class="toolbar-right">
        <span id="session-details-inline" class="session-details-inline" aria-label="Log context"></span>
        <span id="footer-text" data-version="${ver}" class="toolbar-filename"></span>
    </div>
</div>`;
}

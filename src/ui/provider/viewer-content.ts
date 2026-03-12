/**
 * Assembles HTML, CSS, and script bundles for the log viewer webview. Composes
 * viewer-script, filter/search/presets, decorations, panels, and nav into a single
 * HTML document; used by LogViewerProvider and PopOutPanel when creating the webview.
 */

import { getViewerStyles } from '../viewer-styles/viewer-styles';
import { getViewerScript } from '../viewer/viewer-script';
import { getFilterScript } from '../viewer-search-filter/viewer-filter';
import { getSearchScript, getSearchPanelHtml } from '../viewer-search-filter/viewer-search';
import { getSearchHistoryScript } from '../viewer-search-filter/viewer-search-history';
import { getSearchTogglesScript } from '../viewer-search-filter/viewer-search-toggles';
import { getWatchScript } from '../viewer/viewer-watch';
import { getPinScript } from '../viewer/viewer-pin';
import { getExclusionScript } from '../viewer-search-filter/viewer-exclusions';
import { getCopyScript } from '../viewer/viewer-copy';
import { getHiddenLinesScript } from '../viewer/viewer-hidden-lines';
import { getAnnotationScript } from '../viewer/viewer-annotations';
import { getTimingScript } from '../viewer/viewer-timing';
import { getDecorationsScript } from '../viewer-decorations/viewer-decorations';
import { getDecoSettingsScript, getDecoSettingsHtml } from '../viewer-decorations/viewer-deco-settings';
import { getStackFilterScript } from '../viewer-stack-tags/viewer-stack-filter';
import { getStackDedupScript } from '../viewer-stack-tags/viewer-stack-dedup';
import { getSplitNavScript } from '../viewer-nav/viewer-split-nav';
import { getSessionNavScript } from '../viewer-nav/viewer-session-nav';
import { getJsonScript } from '../viewer/viewer-json';
import { getHighlightScript } from '../viewer-decorations/viewer-highlight';
import { getPresetsScript } from '../viewer-search-filter/viewer-presets';
import { getContextMenuScript, getContextMenuHtml } from '../viewer-context-menu/viewer-context-menu';
import { getLevelFilterScript } from '../viewer-search-filter/viewer-level-filter';
import { getContextModalScript, getContextModalHtml } from '../viewer-context-menu/viewer-context-modal';
import { getContextPopoverScript } from '../viewer-context-menu/viewer-context-popover';
import { getViewerDataScript } from '../viewer/viewer-data';
import { getSourceTagsScript } from '../viewer-stack-tags/viewer-source-tags';
import { getClassTagsScript } from '../viewer-stack-tags/viewer-class-tags';
import { getFilterBadgeScript } from '../viewer-search-filter/viewer-filter-badge';
import { getAudioScript } from '../viewer/viewer-audio';
import { getOptionsPanelHtml, getOptionsPanelScript } from '../viewer-panels/viewer-options-panel';
import { getFiltersPanelHtml, getFiltersPanelScript } from '../viewer-search-filter/viewer-filters-panel';
import { getErrorBreakpointHtml, getErrorBreakpointScript } from '../viewer-decorations/viewer-error-breakpoint';
import { getStatsScript } from '../viewer/viewer-stats';
import { getEditModalHtml, getEditModalScript } from '../viewer-context-menu/viewer-edit-modal';
import { getScrollbarMinimapHtml, getScrollbarMinimapScript } from '../viewer/viewer-scrollbar-minimap';
import { getSessionHeaderScript } from '../viewer-nav/viewer-session-header';
import { getExportModalHtml, getExportScript } from '../viewer-panels/viewer-export';
import { getLayoutScript } from './viewer-layout';
import { getScrollAnchorScript } from '../viewer/viewer-scroll-anchor';
import { getViewerVisibilityScript } from '../viewer/viewer-visibility';
import { getErrorClassificationScript } from '../viewer-decorations/viewer-error-classification';
import { getScopeFilterScript } from '../viewer-search-filter/viewer-scope-filter';
import { getErrorHandlerScript } from '../viewer-decorations/viewer-error-handler';
import { getIconBarHtml, getIconBarScript } from '../viewer-nav/viewer-icon-bar';
import { getSessionPanelHtml, getSessionPanelScript } from '../viewer-panels/viewer-session-panel';
// Must be loaded before session panel script — defines transform functions it calls.
import { getSessionTransformsScript } from '../viewer/viewer-session-transforms';
import { getSessionTagsScript } from '../viewer-panels/viewer-session-tags';
import { getSessionContextMenuHtml, getSessionContextMenuScript } from '../viewer-context-menu/viewer-session-context-menu';
import { getGotoLineHtml, getGotoLineStyles, getGotoLineScript } from '../viewer/viewer-goto-line';
import { getRunNavHtml, getRunNavScript } from '../viewer-nav/viewer-run-nav';
import { getFindPanelHtml, getFindPanelScript } from '../viewer-panels/viewer-find-panel';
import { getBookmarkPanelHtml, getBookmarkPanelScript } from '../viewer-panels/viewer-bookmark-panel';
import { getTrashPanelHtml, getTrashPanelScript } from '../viewer-panels/viewer-trash-panel';
import { getCrashlyticsPanelHtml, getCrashlyticsPanelScript } from '../panels/viewer-crashlytics-panel';
import { getRecurringPanelHtml, getRecurringPanelScript } from '../panels/viewer-recurring-panel';
import { getPerformancePanelHtml, getPerformancePanelScript } from '../panels/viewer-performance-panel';
import { getAboutPanelHtml, getAboutPanelScript } from '../viewer-panels/viewer-about-panel';
import { getReplayBarHtml, getReplayScript } from '../viewer/viewer-replay';

/** Maximum lines retained in the viewer data array when viewerMaxLines is 0 (file on disk can be larger, up to maxLines). */
export const MAX_VIEWER_LINES = 50000;

/** Wrap script content in a nonce-tagged script element for fault isolation. */
function scriptTag(nonce: string, ...parts: string[]): string {
    return `<script nonce="${nonce}">${parts.join('\n')}</script>`;
}

/** Generate a random nonce for Content Security Policy. */
export function getNonce(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 32; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

interface ViewerHtmlOptions {
    readonly nonce: string;
    readonly extensionUri?: string;
    readonly version?: string;
    readonly cspSource?: string;
    readonly codiconCssUri?: string;
    /** Max lines retained in the viewer (default MAX_VIEWER_LINES when omitted). */
    readonly viewerMaxLines?: number;
}

/**
 * Effective viewer line cap from config.
 * Used when building viewer HTML (getViewerScript) and when slicing file content in the provider.
 * @param maxLines - Max lines per log file (config).
 * @param viewerMaxLines - Max lines to show in viewer (0 = use MAX_VIEWER_LINES).
 * @returns Cap to use; never exceeds maxLines.
 */
export function getEffectiveViewerLines(maxLines: number, viewerMaxLines: number): number {
    return (viewerMaxLines > 0 ? Math.min(viewerMaxLines, maxLines) : MAX_VIEWER_LINES);
}

/** Build the complete HTML document for the log viewer webview. */
export function buildViewerHtml(opts: ViewerHtmlOptions): string {
    const { nonce, extensionUri, version, cspSource, codiconCssUri } = opts;
    const fontSrc = cspSource ? `font-src ${cspSource};` : '';
    const styleSrc = cspSource
        ? `style-src 'nonce-${nonce}' 'unsafe-inline' ${cspSource};`
        : `style-src 'nonce-${nonce}' 'unsafe-inline';`;
    const codiconLink = codiconCssUri ? `<link rel="stylesheet" href="${codiconCssUri}">` : '';
    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy"
          content="default-src 'none'; script-src 'nonce-${nonce}'; ${styleSrc} ${fontSrc} media-src ${cspSource || extensionUri || 'vscode-resource:'};">
    ${codiconLink}
    <style nonce="${nonce}">
        ${getViewerStyles()}
        ${getGotoLineStyles()}
    </style>
</head>
<body>
    <div id="main-content">
    <div id="session-nav-wrapper" class="session-nav-wrapper">
    <div id="session-nav">
        <span class="session-nav-controls">
        <button id="session-prev" title="Previous session (older)" aria-label="Previous session (older)" disabled>&#x25C0; Prev</button>
        <span class="nav-bar-label">Session <span id="session-nav-current">1</span> of <span id="session-nav-total">1</span></span>
        <button id="session-next" title="Next session (newer)" aria-label="Next session (newer)" disabled>Next &#x25B6;</button>
        ${getRunNavHtml()}
        </span>
        <span id="session-details-inline" class="session-details-inline" aria-label="Session context"></span>
    </div>
    </div>
    <div id="split-breadcrumb">
        <button id="split-prev" title="Previous part" aria-label="Previous part" disabled>&#x25C0;</button>
        <span class="nav-bar-label" aria-hidden="true">Part <span id="split-current">1</span> of <span id="split-total">1</span></span>
        <button id="split-next" title="Next part" aria-label="Next part" disabled>&#x25B6;</button>
    </div>
    <div id="pinned-section"></div>
    <div id="panel-content-row">
    <div id="panel-slot">
    ${getSearchPanelHtml()}
    ${getSessionPanelHtml()}
    ${getSessionContextMenuHtml()}
    ${getFindPanelHtml()}
    ${getBookmarkPanelHtml()}
    ${getTrashPanelHtml()}
    ${getFiltersPanelHtml()}
    ${getOptionsPanelHtml()}
    ${getCrashlyticsPanelHtml()}
    ${getRecurringPanelHtml()}
    ${getPerformancePanelHtml()}
    ${getAboutPanelHtml()}
    </div>
    <div id="log-area-with-footer">
    <!-- Footer lives here so it appears only under the log area, not under the sidebar panel slot -->
    <div id="log-content-wrapper">
    <!-- Log region: role=log and aria-label for screen readers -->
    <div id="log-content" class="nowrap" role="log" aria-label="Log content">
        <div id="spacer-top"></div>
        <div id="viewport"></div>
        <div id="spacer-bottom"></div>
    </div>
    <button id="jump-top-btn" title="Scroll to top" aria-label="Scroll to top">&#x2B06; Top</button>
    <button id="jump-btn" title="Scroll to bottom" aria-label="Scroll to bottom">&#x2B07; Bottom</button>
    <div id="copy-float" class="codicon codicon-copy" title="Copy line" role="button" aria-label="Copy line"></div>
    ${getScrollbarMinimapHtml()}
    ${getGotoLineHtml()}
    </div>
    ${getReplayBarHtml()}
    <div id="footer">
        <span id="footer-text" data-version="${version ? `v${version}` : ''}">Waiting for debug session...</span>
        ${getErrorBreakpointHtml()}
        <span id="level-menu-btn" class="level-summary" role="button" aria-label="Level filters" title="Level filters — click to open">
            <span class="level-dot-group" data-level="info" title="Info" role="img" aria-label="Info"><span class="level-dot active level-dot-info"></span><span class="dot-count"></span></span>
            <span class="level-dot-group" data-level="warning" title="Warning" role="img" aria-label="Warning"><span class="level-dot active level-dot-warning"></span><span class="dot-count"></span></span>
            <span class="level-dot-group" data-level="error" title="Error" role="img" aria-label="Error"><span class="level-dot active level-dot-error"></span><span class="dot-count"></span></span>
            <span class="level-dot-group" data-level="performance" title="Perf" role="img" aria-label="Performance"><span class="level-dot active level-dot-performance"></span><span class="dot-count"></span></span>
            <span class="level-dot-group" data-level="todo" title="TODO" role="img" aria-label="TODO"><span class="level-dot active level-dot-todo"></span><span class="dot-count"></span></span>
            <span class="level-dot-group" data-level="debug" title="Debug" role="img" aria-label="Debug"><span class="level-dot active level-dot-debug"></span><span class="dot-count"></span></span>
            <span class="level-dot-group" data-level="notice" title="Notice" role="img" aria-label="Notice"><span class="level-dot active level-dot-notice"></span><span class="dot-count"></span></span>
            <span id="level-trigger-label" class="level-trigger-label">All</span>
        </span>
        <span id="line-count"></span>
        <span id="hidden-lines-counter" class="hidden-lines-counter" style="display: none;" role="button" title="Click to peek at hidden lines" aria-label="Hidden lines counter">
            <span class="codicon codicon-eye-closed"></span>
            <span class="hidden-count-text">0 hidden</span>
        </span>
        <span id="footer-selection" class="footer-selection"></span>
        <span id="filter-badge" class="filter-badge" role="button" title="Active filters — click to open filters" aria-label="Active filters — click to open options"></span>
        <span class="footer-spacer"></span>
        <a id="footer-version-link" href="#" class="footer-version-link" title="About Saropa" aria-label="About Saropa Log Capture">${version ? `v${version}` : ''}</a>
    </div>
    </div>
    </div>
    ${getContextMenuHtml()}
    ${getContextModalHtml()}
    ${getDecoSettingsHtml()}
    ${getExportModalHtml()}
    ${getEditModalHtml()}
    <div id="level-flyup">
        <div class="level-flyup-title">Level Filters</div>
        <div class="level-flyup-header">
            <a id="level-select-all" href="#" class="active">All</a>
            <a id="level-select-none" href="#">None</a>
        </div>
        <button id="level-info-toggle" class="level-circle active" title="Info" aria-label="Toggle Info level"><span class="level-emoji">🟢</span><span class="level-label">Info</span><span class="level-count"></span></button>
        <button id="level-warning-toggle" class="level-circle active" title="Warning" aria-label="Toggle Warning level"><span class="level-emoji">🟠</span><span class="level-label">Warning</span><span class="level-count"></span></button>
        <button id="level-error-toggle" class="level-circle active" title="Error" aria-label="Toggle Error level"><span class="level-emoji">🔴</span><span class="level-label">Error</span><span class="level-count"></span></button>
        <button id="level-performance-toggle" class="level-circle active" title="Performance" aria-label="Toggle Performance level"><span class="level-emoji">🟣</span><span class="level-label">Perf</span><span class="level-count"></span></button>
        <button id="level-todo-toggle" class="level-circle active" title="TODO/FIXME" aria-label="Toggle TODO level"><span class="level-emoji">⚪</span><span class="level-label">TODO</span><span class="level-count"></span></button>
        <button id="level-debug-toggle" class="level-circle active" title="Debug/Trace" aria-label="Toggle Debug level"><span class="level-emoji">🟤</span><span class="level-label">Debug</span><span class="level-count"></span></button>
        <button id="level-notice-toggle" class="level-circle active" title="Notice" aria-label="Toggle Notice level"><span class="level-emoji">🟦</span><span class="level-label">Notice</span><span class="level-count"></span></button>
        <div class="level-flyup-context">
            <span class="level-flyup-context-label">Context: <span id="context-lines-label">3 lines</span></span>
            <input type="range" id="context-lines-slider" min="0" max="10" value="3" title="Number of preceding context lines shown when filtering" aria-label="Context lines when filtering" />
        </div>
    </div>
    </div>
    ${getIconBarHtml()}
    ${scriptTag(nonce, getErrorHandlerScript())}
    ${scriptTag(nonce, getLayoutScript(), getViewerDataScript(), getViewerScript(opts.viewerMaxLines ?? MAX_VIEWER_LINES), getViewerVisibilityScript())}
    ${scriptTag(nonce, getScrollAnchorScript())}
    ${scriptTag(nonce, getFilterScript())}
    ${scriptTag(nonce, getWatchScript())}
    ${scriptTag(nonce, getPinScript())}
    ${scriptTag(nonce, getExclusionScript())}
    ${scriptTag(nonce, getCopyScript())}
    ${scriptTag(nonce, getHiddenLinesScript())}
    ${scriptTag(nonce, getAnnotationScript())}
    ${scriptTag(nonce, getTimingScript())}
    ${scriptTag(nonce, getReplayScript())}
    ${scriptTag(nonce, getDecorationsScript())}
    ${scriptTag(nonce, getDecoSettingsScript())}
    ${scriptTag(nonce, getStackDedupScript())}
    ${scriptTag(nonce, getStackFilterScript())}
    ${scriptTag(nonce, getSplitNavScript())}
    ${scriptTag(nonce, getSessionNavScript())}
    ${scriptTag(nonce, getJsonScript())}
    ${scriptTag(nonce, getSearchScript())}
    ${scriptTag(nonce, getSearchTogglesScript())}
    ${scriptTag(nonce, getSearchHistoryScript())}
    ${scriptTag(nonce, getLevelFilterScript())}
    ${scriptTag(nonce, getSourceTagsScript())}
    ${scriptTag(nonce, getClassTagsScript())}
    ${scriptTag(nonce, getHighlightScript())}
    ${scriptTag(nonce, getScopeFilterScript())}
    ${scriptTag(nonce, getPresetsScript())}
    ${scriptTag(nonce, getFilterBadgeScript())}
    ${scriptTag(nonce, getContextModalScript())}
    ${scriptTag(nonce, getContextPopoverScript())}
    ${scriptTag(nonce, getContextMenuScript())}
    ${scriptTag(nonce, getAudioScript(extensionUri || ''))}
    ${scriptTag(nonce, getSessionTransformsScript())}
    ${scriptTag(nonce, getSessionTagsScript())}
    ${scriptTag(nonce, getSessionPanelScript())}
    ${scriptTag(nonce, getSessionContextMenuScript())}
    ${scriptTag(nonce, getTrashPanelScript())}
    ${scriptTag(nonce, getFindPanelScript())}
    ${scriptTag(nonce, getBookmarkPanelScript())}
    ${scriptTag(nonce, getFiltersPanelScript())}
    ${scriptTag(nonce, getOptionsPanelScript())}
    ${scriptTag(nonce, getCrashlyticsPanelScript())}
    ${scriptTag(nonce, getRecurringPanelScript())}
    ${scriptTag(nonce, getPerformancePanelScript())}
    ${scriptTag(nonce, getAboutPanelScript())}
    ${scriptTag(nonce, getIconBarScript())}
    ${scriptTag(nonce, getErrorBreakpointScript())}
    ${scriptTag(nonce, getStatsScript())}
    ${scriptTag(nonce, getEditModalScript())}
    ${scriptTag(nonce, getScrollbarMinimapScript())}
    ${scriptTag(nonce, getSessionHeaderScript())}
    ${scriptTag(nonce, getExportScript())}
    ${scriptTag(nonce, getErrorClassificationScript())}
    ${scriptTag(nonce, getGotoLineScript())}
    ${scriptTag(nonce, getRunNavScript())}
</body>
</html>`;
}

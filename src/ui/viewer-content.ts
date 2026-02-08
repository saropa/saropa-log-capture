import { getViewerStyles } from './viewer-styles';
import { getViewerScript } from './viewer-script';
import { getFilterScript } from './viewer-filter';
import { getSearchScript, getSearchPanelHtml } from './viewer-search';
import { getSearchHistoryScript } from './viewer-search-history';
import { getSearchTogglesScript } from './viewer-search-toggles';
import { getWatchScript } from './viewer-watch';
import { getPinScript } from './viewer-pin';
import { getExclusionScript } from './viewer-exclusions';
import { getCopyScript } from './viewer-copy';
import { getAnnotationScript } from './viewer-annotations';
import { getTimingScript } from './viewer-timing';
import { getDecorationsScript } from './viewer-decorations';
import { getDecoSettingsScript, getDecoSettingsHtml } from './viewer-deco-settings';
import { getStackFilterScript } from './viewer-stack-filter';
import { getStackDedupScript } from './viewer-stack-dedup';
import { getSplitNavScript } from './viewer-split-nav';
import { getSessionNavScript } from './viewer-session-nav';
import { getJsonScript } from './viewer-json';
import { getHighlightScript } from './viewer-highlight';
import { getPresetsScript } from './viewer-presets';
import { getContextMenuScript, getContextMenuHtml } from './viewer-context-menu';
import { getLevelFilterScript } from './viewer-level-filter';
import { getContextModalScript, getContextModalHtml } from './viewer-context-modal';
import { getViewerDataScript } from './viewer-data';
import { getSourceTagsScript } from './viewer-source-tags';
import { getFilterBadgeScript } from './viewer-filter-badge';
import { getAudioScript } from './viewer-audio';
import { getOptionsPanelHtml, getOptionsPanelScript } from './viewer-options-panel';
import { getErrorBreakpointHtml, getErrorBreakpointScript } from './viewer-error-breakpoint';
import { getStatsScript } from './viewer-stats';
import { getEditModalHtml, getEditModalScript } from './viewer-edit-modal';
import { getScrollbarMinimapHtml, getScrollbarMinimapScript } from './viewer-scrollbar-minimap';
import { getSessionInfoPanelHtml, getSessionHeaderScript } from './viewer-session-header';
import { getExportModalHtml, getExportScript } from './viewer-export';
import { getLayoutScript } from './viewer-layout';
import { getScrollAnchorScript } from './viewer-scroll-anchor';
import { getErrorClassificationScript } from './viewer-error-classification';
import { getErrorHandlerScript } from './viewer-error-handler';
import { getIconBarHtml, getIconBarScript } from './viewer-icon-bar';
import { getSessionPanelHtml, getSessionPanelScript } from './viewer-session-panel';
// Must be loaded before session panel script — defines transform functions it calls.
import { getSessionTransformsScript } from './viewer-session-transforms';
import { getGotoLineHtml, getGotoLineStyles, getGotoLineScript } from './viewer-goto-line';
import { getFindPanelHtml, getFindPanelScript } from './viewer-find-panel';
import { getBookmarkPanelHtml, getBookmarkPanelScript } from './viewer-bookmark-panel';

/** Maximum lines retained in the viewer data array (file on disk keeps all). */
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

/** Build the complete HTML document for the log viewer webview. */
export function buildViewerHtml(nonce: string, extensionUri?: string, version?: string, cspSource?: string, codiconCssUri?: string): string {
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
    <div id="session-nav">
        <button id="session-prev" title="Previous session (older)" disabled>&#x25C0; Prev</button>
        <span class="nav-bar-label">Session <span id="session-nav-current">1</span> of <span id="session-nav-total">1</span></span>
        <button id="session-next" title="Next session (newer)" disabled>Next &#x25B6;</button>
    </div>
    <div id="split-breadcrumb">
        <button id="split-prev" title="Previous part" disabled>&#x25C0;</button>
        <span class="nav-bar-label">Part <span id="split-current">1</span> of <span id="split-total">1</span></span>
        <button id="split-next" title="Next part" disabled>&#x25B6;</button>
    </div>
    <div id="pinned-section"></div>
    <div id="log-content-wrapper">
    <div id="log-content" class="nowrap">
        <div id="spacer-top"></div>
        <div id="viewport"></div>
        <div id="spacer-bottom"></div>
        <button id="jump-btn" title="Scroll to bottom">⬇ Bottom</button>
    </div>
    ${getScrollbarMinimapHtml()}
    ${getGotoLineHtml()}
    </div>
    ${getContextMenuHtml()}
    ${getSearchPanelHtml()}
    ${getSessionPanelHtml()}
    ${getFindPanelHtml()}
    ${getBookmarkPanelHtml()}
    ${getSessionInfoPanelHtml()}
    ${getContextModalHtml()}
    ${getDecoSettingsHtml()}
    ${getOptionsPanelHtml()}
    ${getExportModalHtml()}
    ${getEditModalHtml()}
    <div id="footer">
        <span id="footer-text" data-version="${version ? `v${version}` : ''}">Waiting for debug session...${version ? ` \u00b7 v${version}` : ''}</span>
        ${getErrorBreakpointHtml()}
        <span id="level-menu-btn" class="level-summary">
            <span class="level-dot-group" data-level="info" title="Info"><span class="level-dot active level-dot-info"></span><span class="dot-count"></span></span>
            <span class="level-dot-group" data-level="warning" title="Warning"><span class="level-dot active level-dot-warning"></span><span class="dot-count"></span></span>
            <span class="level-dot-group" data-level="error" title="Error"><span class="level-dot active level-dot-error"></span><span class="dot-count"></span></span>
            <span class="level-dot-group" data-level="performance" title="Perf"><span class="level-dot active level-dot-performance"></span><span class="dot-count"></span></span>
            <span class="level-dot-group" data-level="todo" title="TODO"><span class="level-dot active level-dot-todo"></span><span class="dot-count"></span></span>
            <span class="level-dot-group" data-level="debug" title="Debug"><span class="level-dot active level-dot-debug"></span><span class="dot-count"></span></span>
            <span class="level-dot-group" data-level="notice" title="Notice"><span class="level-dot active level-dot-notice"></span><span class="dot-count"></span></span>
            <span id="level-trigger-label" class="level-trigger-label">All</span>
        </span>
        <div id="level-flyup">
            <div class="level-flyup-title">Level Filters</div>
            <div class="level-flyup-header">
                <a id="level-select-all" href="#" class="active">All</a>
                <a id="level-select-none" href="#">None</a>
            </div>
            <button id="level-info-toggle" class="level-circle active" title="Info"><span class="level-emoji">🟢</span><span class="level-label">Info</span><span class="level-count"></span></button>
            <button id="level-warning-toggle" class="level-circle active" title="Warning"><span class="level-emoji">🟠</span><span class="level-label">Warning</span><span class="level-count"></span></button>
            <button id="level-error-toggle" class="level-circle active" title="Error"><span class="level-emoji">🔴</span><span class="level-label">Error</span><span class="level-count"></span></button>
            <button id="level-performance-toggle" class="level-circle active" title="Performance"><span class="level-emoji">🟣</span><span class="level-label">Perf</span><span class="level-count"></span></button>
            <button id="level-todo-toggle" class="level-circle active" title="TODO/FIXME"><span class="level-emoji">⚪</span><span class="level-label">TODO</span><span class="level-count"></span></button>
            <button id="level-debug-toggle" class="level-circle active" title="Debug/Trace"><span class="level-emoji">🟤</span><span class="level-label">Debug</span><span class="level-count"></span></button>
            <button id="level-notice-toggle" class="level-circle active" title="Notice"><span class="level-emoji">🟦</span><span class="level-label">Notice</span><span class="level-count"></span></button>
            <div class="level-flyup-context">
                <span class="level-flyup-context-label">Context: <span id="context-lines-label">3 lines</span></span>
                <input type="range" id="context-lines-slider" min="0" max="10" value="3" title="Number of preceding context lines shown when filtering" />
            </div>
        </div>
        <span id="line-count"></span>
        <span id="filter-badge" class="filter-badge" title="Active filters — click to open options"></span>
    </div>
    </div>
    ${getIconBarHtml()}
    ${scriptTag(nonce, getErrorHandlerScript())}
    ${scriptTag(nonce, getLayoutScript(), getViewerDataScript(), getViewerScript(MAX_VIEWER_LINES))}
    ${scriptTag(nonce, getScrollAnchorScript())}
    ${scriptTag(nonce, getFilterScript())}
    ${scriptTag(nonce, getWatchScript())}
    ${scriptTag(nonce, getPinScript())}
    ${scriptTag(nonce, getExclusionScript())}
    ${scriptTag(nonce, getCopyScript())}
    ${scriptTag(nonce, getAnnotationScript())}
    ${scriptTag(nonce, getTimingScript())}
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
    ${scriptTag(nonce, getHighlightScript())}
    ${scriptTag(nonce, getPresetsScript())}
    ${scriptTag(nonce, getFilterBadgeScript())}
    ${scriptTag(nonce, getContextModalScript())}
    ${scriptTag(nonce, getContextMenuScript())}
    ${scriptTag(nonce, getAudioScript(extensionUri || ''))}
    ${scriptTag(nonce, getSessionTransformsScript())}
    ${scriptTag(nonce, getSessionPanelScript())}
    ${scriptTag(nonce, getFindPanelScript())}
    ${scriptTag(nonce, getBookmarkPanelScript())}
    ${scriptTag(nonce, getOptionsPanelScript())}
    ${scriptTag(nonce, getIconBarScript())}
    ${scriptTag(nonce, getErrorBreakpointScript())}
    ${scriptTag(nonce, getStatsScript())}
    ${scriptTag(nonce, getEditModalScript())}
    ${scriptTag(nonce, getScrollbarMinimapScript())}
    ${scriptTag(nonce, getSessionHeaderScript())}
    ${scriptTag(nonce, getExportScript())}
    ${scriptTag(nonce, getErrorClassificationScript())}
    ${scriptTag(nonce, getGotoLineScript())}
</body>
</html>`;
}

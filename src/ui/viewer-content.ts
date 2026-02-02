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
import { getSourcePreviewScript } from './viewer-source-preview';
import { getSplitNavScript } from './viewer-split-nav';
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
import { getErrorClassificationScript } from './viewer-error-classification';
import { getErrorHandlerScript } from './viewer-error-handler';
import { getIconBarHtml, getIconBarScript } from './viewer-icon-bar';
import { getSessionPanelHtml, getSessionPanelScript } from './viewer-session-panel';
// Must be loaded before session panel script — defines transform functions it calls.
import { getSessionTransformsScript } from './viewer-session-transforms';

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
          content="default-src 'none'; script-src 'nonce-${nonce}'; ${styleSrc} ${fontSrc} media-src ${extensionUri || 'vscode-resource:'};">
    ${codiconLink}
    <style nonce="${nonce}">
        ${getViewerStyles()}
    </style>
</head>
<body>
    <div id="main-content">
    <div id="split-breadcrumb">
        <button id="split-prev" title="Previous part" disabled>&#x25C0;</button>
        <span class="part-label">Part <span id="split-current">1</span> of <span id="split-total">1</span></span>
        <button id="split-next" title="Next part" disabled>&#x25B6;</button>
    </div>
    <div id="pinned-section" style="display:none"></div>
    <div id="log-content-wrapper">
    <div id="log-content">
        <div id="spacer-top"></div>
        <div id="viewport"></div>
        <div id="spacer-bottom"></div>
        <button id="jump-btn" title="Scroll to bottom">⬇ Bottom</button>
    </div>
    ${getScrollbarMinimapHtml()}
    </div>
    <div id="source-preview"></div>
    ${getContextMenuHtml()}
    ${getSearchPanelHtml()}
    ${getSessionPanelHtml()}
    ${getSessionInfoPanelHtml()}
    ${getContextModalHtml()}
    ${getDecoSettingsHtml()}
    ${getOptionsPanelHtml()}
    ${getExportModalHtml()}
    ${getEditModalHtml()}
    <div id="footer">
        <span id="footer-text" data-version="${version ? `v${version}` : ''}">Waiting for debug session...${version ? ` \u00b7 v${version}` : ''}</span>
        ${getErrorBreakpointHtml()}
        <span id="watch-counts"></span>
        <span id="level-menu-btn" class="level-summary" title="Level filters">
            <span class="level-dot active" data-level="info" style="background:#4caf50"></span>
            <span class="level-dot active" data-level="warning" style="background:#ff9800"></span>
            <span class="level-dot active" data-level="error" style="background:#f44336"></span>
            <span class="level-dot active" data-level="performance" style="background:#9c27b0"></span>
            <span class="level-dot active" data-level="todo" style="background:#bdbdbd"></span>
            <span class="level-dot active" data-level="debug" style="background:#795548"></span>
            <span class="level-dot active" data-level="notice" style="background:#2196f3"></span>
        </span>
        <div id="level-flyup">
            <div class="level-flyup-header">
                <a id="level-select-all" href="#">All</a>
                <a id="level-select-none" href="#">None</a>
            </div>
            <button id="level-info-toggle" class="level-circle active" title="Info">🟢</button>
            <button id="level-warning-toggle" class="level-circle active" title="Warning">🟠</button>
            <button id="level-error-toggle" class="level-circle active" title="Error">🔴</button>
            <button id="level-performance-toggle" class="level-circle active" title="Performance">🟣</button>
            <button id="level-todo-toggle" class="level-circle active" title="TODO/FIXME">⚪</button>
            <button id="level-debug-toggle" class="level-circle active" title="Debug/Trace">🟤</button>
            <button id="level-notice-toggle" class="level-circle active" title="Notice">🟦</button>
        </div>
        <span id="filter-badge" class="filter-badge" style="display:none" title="Active filters — click to open options"></span>
    </div>
    </div>
    ${getIconBarHtml()}
    ${scriptTag(nonce, getErrorHandlerScript())}
    ${scriptTag(nonce, getLayoutScript(), getViewerDataScript(), getViewerScript(MAX_VIEWER_LINES))}
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
    ${scriptTag(nonce, getSourcePreviewScript())}
    ${scriptTag(nonce, getSplitNavScript())}
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
    ${scriptTag(nonce, getOptionsPanelScript())}
    ${scriptTag(nonce, getIconBarScript())}
    ${scriptTag(nonce, getErrorBreakpointScript())}
    ${scriptTag(nonce, getStatsScript())}
    ${scriptTag(nonce, getEditModalScript())}
    ${scriptTag(nonce, getScrollbarMinimapScript())}
    ${scriptTag(nonce, getSessionHeaderScript())}
    ${scriptTag(nonce, getExportScript())}
    ${scriptTag(nonce, getErrorClassificationScript())}
</body>
</html>`;
}

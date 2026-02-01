import { getViewerStyles } from './viewer-styles';
import { getViewerScript } from './viewer-script';
import { getFilterScript } from './viewer-filter';
import { getSearchScript } from './viewer-search';
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
import { getSourceTagsScript, getSourceTagsHtml } from './viewer-source-tags';
import { getAudioScript } from './viewer-audio';
import { getOptionsPanelHtml, getOptionsPanelScript } from './viewer-options-panel';
import { getErrorBreakpointHtml, getErrorBreakpointScript } from './viewer-error-breakpoint';
import { getStatsHtml, getStatsScript } from './viewer-stats';
import { getEditModalHtml, getEditModalScript } from './viewer-edit-modal';
import { getScrollbarMinimapHtml, getScrollbarMinimapScript } from './viewer-scrollbar-minimap';
import { getSessionHeaderHtml, getSessionHeaderScript } from './viewer-session-header';
import { getExportModalHtml, getExportScript } from './viewer-export';
import { getLayoutScript } from './viewer-layout';
import { getErrorClassificationScript } from './viewer-error-classification';

/** Maximum lines retained in the viewer data array (file on disk keeps all). */
export const MAX_VIEWER_LINES = 50000;

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
export function buildViewerHtml(nonce: string, extensionUri?: string): string {
    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy"
          content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}' 'unsafe-inline'; media-src ${extensionUri || 'vscode-resource:'};">
    <style nonce="${nonce}">
        ${getViewerStyles()}
    </style>
</head>
<body>
    <div id="viewer-header">
        <span id="header-filename"></span>
        <button id="header-toggle" title="Toggle header">&#x25B2;</button>
    </div>
    <div id="split-breadcrumb">
        <button id="split-prev" title="Previous part" disabled>&#x25C0;</button>
        <span class="part-label">Part <span id="split-current">1</span> of <span id="split-total">1</span></span>
        <button id="split-next" title="Next part" disabled>&#x25B6;</button>
    </div>
    ${getSessionHeaderHtml()}
    <div id="pinned-section" style="display:none"></div>
    ${getSourceTagsHtml()}
    <div id="log-content">
        <div id="spacer-top"></div>
        <div id="viewport"></div>
        <div id="spacer-bottom"></div>
        <button id="jump-btn" title="Scroll to bottom">⬇ Bottom</button>
        ${getScrollbarMinimapHtml()}
    </div>
    <div id="source-preview"></div>
    ${getContextMenuHtml()}
    <div id="search-bar" style="display:none">
        <input id="search-input" type="text" placeholder="Search..." />
        <button id="search-regex-toggle" title="Literal mode (click for regex)">Aa</button>
        <button id="search-case-toggle" title="Case insensitive (click for case sensitive)">Aa</button>
        <button id="search-word-toggle" title="Match partial (click for whole word)">\b</button>
        <button id="search-mode-toggle" title="Toggle between highlight and filter mode">Mode: Highlight</button>
        <span id="match-count"></span>
        <button id="search-prev" title="Previous (Shift+F3)">&#x25B2;</button>
        <button id="search-next" title="Next (F3)">&#x25BC;</button>
        <button id="search-close" title="Close (Escape)">&#x2715;</button>
    </div>
    ${getContextModalHtml()}
    ${getDecoSettingsHtml()}
    ${getOptionsPanelHtml()}
    ${getErrorBreakpointHtml()}
    ${getExportModalHtml()}
    ${getEditModalHtml()}
    <div id="footer">
        <span id="footer-text">Waiting for debug session...</span>
        ${getErrorBreakpointHtml()}
        ${getStatsHtml()}
        <span id="watch-counts"></span>
        <span id="exclusion-count"></span>
        <button id="exclusion-toggle" style="display:none" title="Toggle exclusion filters">Excl: ON</button>
        <button id="app-only-toggle" title="Toggle capture all vs. app-only mode">App Only: OFF</button>
        <span class="level-filter-group">
            <button id="level-info-toggle" class="level-circle active" title="Info">🟢</button>
            <button id="level-warn-toggle" class="level-circle active" title="Warning">🟠</button>
            <button id="level-error-toggle" class="level-circle active" title="Error">🔴</button>
            <button id="level-perf-toggle" class="level-circle active" title="Performance">🟣</button>
            <button id="level-todo-toggle" class="level-circle active" title="TODO/FIXME">⚪</button>
            <button id="level-debug-toggle" class="level-circle active" title="Debug/Trace">🟤</button>
            <button id="level-notice-toggle" class="level-circle active" title="Notice">🟦</button>
        </span>
        <select id="preset-select" title="Filter Presets">
            <option value="">Preset: None</option>
        </select>
        <select id="filter-select" multiple title="Filter by category" style="display:none"></select>
        <button id="deco-toggle" title="Toggle line decorations (counter, timestamp, severity dot)">Deco: OFF</button>
        <button id="deco-settings-btn" title="Decoration settings">&#x2699;</button>
        <button id="audio-toggle" title="Toggle audio alerts for errors and warnings">Audio: OFF</button>
        <button id="minimap-toggle" title="Toggle scrollbar minimap">Minimap: ON</button>
        <button id="wrap-toggle" title="Toggle word wrap">No Wrap</button>
        <button id="export-btn" title="Export logs to file">&#x1F4BE;</button>
        <button id="options-panel-btn" title="All options">&#x2630;</button>
    </div>
    <script nonce="${nonce}">
        ${getLayoutScript()}
        ${getViewerDataScript()}
        ${getViewerScript(MAX_VIEWER_LINES)}
        ${getFilterScript()}
        ${getWatchScript()}
        ${getPinScript()}
        ${getExclusionScript()}
        ${getCopyScript()}
        ${getAnnotationScript()}
        ${getTimingScript()}
        ${getDecorationsScript()}
        ${getDecoSettingsScript()}
        ${getStackDedupScript()}
        ${getStackFilterScript()}
        ${getSourcePreviewScript()}
        ${getSplitNavScript()}
        ${getJsonScript()}
        ${getSearchScript()}
        ${getLevelFilterScript()}
        ${getSourceTagsScript()}
        ${getHighlightScript()}
        ${getPresetsScript()}
        ${getContextModalScript()}
        ${getContextMenuScript()}
        ${getAudioScript(extensionUri || '')}
        ${getOptionsPanelScript()}
        ${getErrorBreakpointScript()}
        ${getStatsScript()}
        ${getEditModalScript()}
        ${getScrollbarMinimapScript()}
        ${getSessionHeaderScript()}
        ${getExportScript()}
        ${getErrorClassificationScript()}
    </script>
</body>
</html>`;
}

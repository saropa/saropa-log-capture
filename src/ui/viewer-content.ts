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
export function buildViewerHtml(nonce: string): string {
    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy"
          content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}' 'unsafe-inline';">
    <style nonce="${nonce}">
        ${getViewerStyles()}
    </style>
</head>
<body>
    <div id="split-breadcrumb">
        <button id="split-prev" title="Previous part" disabled>&#x25C0;</button>
        <span class="part-label">Part <span id="split-current">1</span> of <span id="split-total">1</span></span>
        <button id="split-next" title="Next part" disabled>&#x25B6;</button>
    </div>
    <div id="pinned-section" style="display:none"></div>
    ${getSourceTagsHtml()}
    <div id="log-content">
        <div id="spacer-top"></div>
        <div id="viewport"></div>
        <div id="spacer-bottom"></div>
    </div>
    <button id="jump-btn">Jump to Bottom</button>
    <div id="source-preview"></div>
    ${getContextMenuHtml()}
    <div id="search-bar" style="display:none">
        <input id="search-input" type="text" placeholder="Search..." />
        <span id="match-count"></span>
        <button id="search-prev" title="Previous (Shift+F3)">&#x25B2;</button>
        <button id="search-next" title="Next (F3)">&#x25BC;</button>
        <button id="search-close" title="Close (Escape)">&#x2715;</button>
    </div>
    ${getContextModalHtml()}
    ${getDecoSettingsHtml()}
    <div id="footer">
        <span id="footer-text">Waiting for debug session...</span>
        <span id="watch-counts"></span>
        <span id="exclusion-count"></span>
        <button id="exclusion-toggle" style="display:none">Excl: ON</button>
        <button id="app-only-toggle">App Only: OFF</button>
        <span class="level-btn-group">
            <button id="level-all" class="level-btn active">All</button>
            <button id="level-error" class="level-btn">Errors</button>
            <button id="level-warn" class="level-btn">Warn+</button>
        </span>
        <select id="preset-select" title="Filter Presets">
            <option value="">Preset: None</option>
        </select>
        <select id="filter-select" multiple title="Filter by category"></select>
        <button id="deco-toggle">Deco: OFF</button>
        <button id="deco-settings-btn" title="Decoration settings">&#x2699;</button>
        <button id="wrap-toggle">No Wrap</button>
    </div>
    <script nonce="${nonce}">
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
    </script>
</body>
</html>`;
}

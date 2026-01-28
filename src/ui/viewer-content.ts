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
import { getStackFilterScript } from './viewer-stack-filter';

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
          content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}';">
    <style nonce="${nonce}">
        ${getViewerStyles()}
    </style>
</head>
<body>
    <div id="pinned-section" style="display:none"></div>
    <div id="log-content">
        <div id="spacer-top"></div>
        <div id="viewport"></div>
        <div id="spacer-bottom"></div>
    </div>
    <button id="jump-btn" onclick="jumpToBottom()">Jump to Bottom</button>
    <div id="search-bar" style="display:none">
        <input id="search-input" type="text" placeholder="Search..." />
        <span id="match-count"></span>
        <button id="search-prev" title="Previous (Shift+F3)">&#x25B2;</button>
        <button id="search-next" title="Next (F3)">&#x25BC;</button>
        <button id="search-close" title="Close (Escape)">&#x2715;</button>
    </div>
    <div id="footer">
        <span id="footer-text">Waiting for debug session...</span>
        <span id="watch-counts"></span>
        <span id="exclusion-count"></span>
        <button id="exclusion-toggle" style="display:none" onclick="toggleExclusions()">Excl: ON</button>
        <button id="app-only-toggle" onclick="toggleAppOnly()">App Only: OFF</button>
        <select id="filter-select" multiple title="Filter by category" onchange="handleFilterChange()"></select>
        <button id="wrap-toggle">No Wrap</button>
    </div>
    <script nonce="${nonce}">
        ${getViewerScript(MAX_VIEWER_LINES)}
        ${getFilterScript()}
        ${getWatchScript()}
        ${getPinScript()}
        ${getExclusionScript()}
        ${getCopyScript()}
        ${getAnnotationScript()}
        ${getTimingScript()}
        ${getStackFilterScript()}
        ${getSearchScript()}
    </script>
</body>
</html>`;
}

"use strict";
/**
 * Assembles HTML, CSS, and script bundles for the log viewer webview. Composes
 * viewer-script, filter/search/presets, decorations, panels, and nav into a single
 * HTML document; used by LogViewerProvider and PopOutPanel when creating the webview.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_VIEWER_LINES = void 0;
exports.getNonce = getNonce;
exports.getEffectiveViewerLines = getEffectiveViewerLines;
exports.buildViewerHtml = buildViewerHtml;
const viewer_styles_1 = require("../viewer-styles/viewer-styles");
const viewer_goto_line_1 = require("../viewer/viewer-goto-line");
const viewer_error_hover_styles_1 = require("../viewer-decorations/viewer-error-hover-styles");
const viewer_styles_quality_1 = require("../viewer-styles/viewer-styles-quality");
const viewer_content_body_1 = require("./viewer-content-body");
const viewer_content_scripts_1 = require("./viewer-content-scripts");
/** Fallback viewer cap when buildViewerHtml is called without explicit viewerMaxLines. */
exports.DEFAULT_VIEWER_LINES = 100000;
/** Generate a random nonce for Content Security Policy. */
function getNonce() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 32; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}
/**
 * Effective viewer line cap from config.
 * Used when building viewer HTML (getViewerScript) and when slicing file content in the provider.
 * @param maxLines - Max lines per log file (config).
 * @param viewerMaxLines - Max lines to show in viewer (0 = use maxLines).
 * @returns Cap to use; never exceeds maxLines.
 */
function getEffectiveViewerLines(maxLines, viewerMaxLines) {
    return (viewerMaxLines > 0 ? Math.min(viewerMaxLines, maxLines) : maxLines);
}
/** Build the complete HTML document for the log viewer webview. */
function buildViewerHtml(opts) {
    const { nonce, extensionUri, version, cspSource, codiconCssUri } = opts;
    const fontSrc = cspSource ? `font-src ${cspSource};` : '';
    const styleSrc = cspSource
        ? `style-src 'nonce-${nonce}' ${cspSource};`
        : `style-src 'nonce-${nonce}';`;
    const codiconLink = codiconCssUri ? `<link rel="stylesheet" href="${codiconCssUri}">` : '';
    const bodyHtml = (0, viewer_content_body_1.getViewerBodyHtml)({ version });
    const scriptTags = (0, viewer_content_scripts_1.getViewerScriptTags)({
        nonce,
        extensionUri,
        viewerMaxLines: opts.viewerMaxLines ?? exports.DEFAULT_VIEWER_LINES,
        viewerPreserveAsciiBoxArt: opts.viewerPreserveAsciiBoxArt,
        viewerRepeatThresholds: opts.viewerRepeatThresholds,
        viewerDbInsightsEnabled: opts.viewerDbInsightsEnabled,
        staticSqlFromFingerprintEnabled: opts.staticSqlFromFingerprintEnabled,
        viewerSlowBurstThresholds: opts.viewerSlowBurstThresholds,
        viewerDbDetectorToggles: opts.viewerDbDetectorToggles,
        viewerSqlPatternChipMinCount: opts.viewerSqlPatternChipMinCount,
        viewerSqlPatternMaxChips: opts.viewerSqlPatternMaxChips,
    });
    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy"
          content="default-src 'none'; script-src 'nonce-${nonce}'; ${styleSrc} ${fontSrc} media-src ${cspSource || extensionUri || 'vscode-resource:'};">
    ${codiconLink}
    <style nonce="${nonce}">
        ${(0, viewer_styles_1.getViewerStyles)()}
        ${(0, viewer_goto_line_1.getGotoLineStyles)()}
        ${(0, viewer_error_hover_styles_1.getErrorHoverStyles)()}
        ${(0, viewer_styles_quality_1.getQualityBadgeStyles)()}
    </style>
</head>
<body>
    ${bodyHtml}
    ${scriptTags}
</body>
</html>`;
}
//# sourceMappingURL=viewer-content.js.map
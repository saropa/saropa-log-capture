/**
 * Assembles HTML, CSS, and script bundles for the log viewer webview. Composes
 * viewer-script, filter/search/presets, decorations, panels, and nav into a single
 * HTML document; used by LogViewerProvider and PopOutPanel when creating the webview.
 */

import { getViewerStyles } from '../viewer-styles/viewer-styles';
import { getGotoLineStyles } from '../viewer/viewer-goto-line';
import { getErrorHoverStyles } from '../viewer-decorations/viewer-error-hover-styles';
import { getQualityBadgeStyles } from '../viewer-styles/viewer-styles-quality';
import { getViewerBodyHtml } from './viewer-content-body';
import { getViewerScriptTags } from './viewer-content-scripts';

/** Fallback viewer cap when buildViewerHtml is called without explicit viewerMaxLines. */
export const DEFAULT_VIEWER_LINES = 100000;

/** Generate a random nonce for Content Security Policy. */
export function getNonce(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 32; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

export interface ViewerHtmlOptions {
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
 * @param viewerMaxLines - Max lines to show in viewer (0 = use maxLines).
 * @returns Cap to use; never exceeds maxLines.
 */
export function getEffectiveViewerLines(maxLines: number, viewerMaxLines: number): number {
    return (viewerMaxLines > 0 ? Math.min(viewerMaxLines, maxLines) : maxLines);
}

/** Build the complete HTML document for the log viewer webview. */
export function buildViewerHtml(opts: ViewerHtmlOptions): string {
    const { nonce, extensionUri, version, cspSource, codiconCssUri } = opts;
    const fontSrc = cspSource ? `font-src ${cspSource};` : '';
    const styleSrc = cspSource
        ? `style-src 'nonce-${nonce}' ${cspSource};`
        : `style-src 'nonce-${nonce}';`;
    const codiconLink = codiconCssUri ? `<link rel="stylesheet" href="${codiconCssUri}">` : '';
    const bodyHtml = getViewerBodyHtml({ version });
    const scriptTags = getViewerScriptTags({
        nonce,
        extensionUri,
        viewerMaxLines: opts.viewerMaxLines ?? DEFAULT_VIEWER_LINES,
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
        ${getViewerStyles()}
        ${getGotoLineStyles()}
        ${getErrorHoverStyles()}
        ${getQualityBadgeStyles()}
    </style>
</head>
<body>
    ${bodyHtml}
    ${scriptTags}
</body>
</html>`;
}

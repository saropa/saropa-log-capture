/**
 * Assembles HTML, CSS, and script bundles for the log viewer webview. Composes
 * viewer-script, filter/search/presets, decorations, panels, and nav into a single
 * HTML document; used by LogViewerProvider and PopOutPanel when creating the webview.
 */

import { getViewerStyles } from '../viewer-styles/viewer-styles';
import { getGotoLineStyles } from '../viewer/viewer-goto-line';
import { getErrorHoverStyles } from '../viewer-decorations/viewer-error-hover-styles';
import { getQualityBadgeStyles } from '../viewer-styles/viewer-styles-quality';
import { getLintBadgeStyles } from '../viewer-styles/viewer-styles-lint-badge';
import type { ViewerRepeatThresholds } from '../../modules/db/drift-db-repeat-thresholds';
import type { ViewerSlowBurstThresholds } from '../../modules/db/drift-db-slow-burst-thresholds';
import type { ViewerDbDetectorToggles } from '../../modules/config/config-types';
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
    /** When true, paired `│ … │` lines are normal log lines, not stack frames (default true). */
    readonly viewerPreserveAsciiBoxArt?: boolean;
    /** When true, consecutive separator lines with the same timestamp are grouped visually (default true). */
    readonly viewerGroupAsciiArt?: boolean;
    /** Experimental: detect pixel-based ASCII art via entropy heuristics (default false). */
    readonly viewerDetectAsciiArt?: boolean;
    /** Repeat-collapse thresholds baked into the viewer script at HTML build time. */
    readonly viewerRepeatThresholds?: Partial<ViewerRepeatThresholds>;
    /** Slow-query burst detector thresholds (DB_08) baked into the viewer script. */
    readonly viewerSlowBurstThresholds?: Partial<ViewerSlowBurstThresholds>;
  /** Master toggle for DB insight detectors + rollup (default true). */
  readonly viewerDbInsightsEnabled?: boolean;
  /** DB_12: “Static sources” from SQL fingerprints (default true). */
  readonly staticSqlFromFingerprintEnabled?: boolean;
  /** N+1 / slow-burst / baseline-hint sub-toggles when DB insights are on. */
  readonly viewerDbDetectorToggles?: Partial<ViewerDbDetectorToggles>;
  /** Minimum duration (ms) for a slow-operation signal (default 500). */
  readonly signalSlowOpThresholdMs?: number;
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
        viewerPreserveAsciiBoxArt: opts.viewerPreserveAsciiBoxArt,
        viewerGroupAsciiArt: opts.viewerGroupAsciiArt,
        viewerDetectAsciiArt: opts.viewerDetectAsciiArt,
        viewerRepeatThresholds: opts.viewerRepeatThresholds,
        viewerDbInsightsEnabled: opts.viewerDbInsightsEnabled,
        staticSqlFromFingerprintEnabled: opts.staticSqlFromFingerprintEnabled,
        viewerSlowBurstThresholds: opts.viewerSlowBurstThresholds,
        viewerDbDetectorToggles: opts.viewerDbDetectorToggles,
        signalSlowOpThresholdMs: opts.signalSlowOpThresholdMs,
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
        ${getLintBadgeStyles()}
    </style>
</head>
<body>
    ${bodyHtml}
    ${scriptTags}
</body>
</html>`;
}

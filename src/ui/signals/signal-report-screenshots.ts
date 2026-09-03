/**
 * Screenshot evidence section for the signal report (plan 114, workstream D).
 *
 * Shows the captures nearest the signal's first evidence line — visual "what the
 * screen showed" beside the textual evidence. Up to three thumbnails render as a
 * strip (each opens full size), which covers the multi-capture case without the
 * stateful prev/next navigation the plan first sketched.
 *
 * bug_031 (sub-issue 2): thumbnails used to be embedded as base64 data URIs, which
 * bloated the section HTML (up to MAX_STRIP * MAX_IMAGE_BYTES) and got re-persisted
 * whole via setState on every sectionReady event. They now stream via
 * `webview.asWebviewUri()` — the panel's localResourceRoots is set to the log's
 * screenshot directory (signal-report-panel.ts createPanel) so this resolves. The
 * before/after diff pair is the one exception: the shell script reads its pixels off
 * a <canvas> to compute the change-heat overlay, which needs a same-origin/data-URI
 * source (a vscode-webview-resource: URI would taint the canvas for pixel reads), so
 * it stays base64-inlined and capped per image.
 */

import * as vscode from 'vscode';
import { t } from '../../l10n';
import { escapeHtml } from '../../modules/capture/ansi';
import {
    readScreenshotSidecar,
    screenshotDirUri,
    type ScreenshotMetaEntry,
} from '../../modules/screenshot/screenshot-store';

/** Same inline-image ceiling as the viewer/gallery handlers — still applies to the
 *  diff pair, which remains base64-inlined (see file header comment). */
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

/** At most this many thumbnails in the strip. */
const MAX_STRIP = 3;

/** A before/after capture pair for the pixel-diff block. */
export interface ScreenshotDiffPair {
    readonly before: ScreenshotMetaEntry;
    readonly after: ScreenshotMetaEntry;
}

/**
 * Pick the before/after pair for the diff block, or undefined when the log cannot
 * support one. `after` is the error-triggered capture nearest the signal's anchor line;
 * `before` is the latest EARLIER capture of any trigger (navigation shots are the
 * intended source, but a manual or prior-error capture works too). Exported pure for
 * unit tests.
 */
export function selectDiffPair(
    entries: readonly ScreenshotMetaEntry[],
    targetLine: number,
): ScreenshotDiffPair | undefined {
    const errors = entries.filter((e) => e.trigger === 'error');
    if (errors.length === 0) { return undefined; }
    const after = [...errors].sort((a, b) => Math.abs(a.logLine - targetLine) - Math.abs(b.logLine - targetLine))[0];
    const earlier = entries.filter((e) => e !== after && e.timestamp < after.timestamp);
    if (earlier.length === 0) { return undefined; }
    const before = [...earlier].sort((a, b) => b.timestamp - a.timestamp)[0];
    return { before, after };
}

/** Build the Screenshots section HTML; a no-data div when the log has no captures. */
export async function buildScreenshotSectionHtml(
    webview: vscode.Webview,
    fileUri: vscode.Uri | undefined,
    evidenceLineIds: readonly number[],
): Promise<string> {
    if (!fileUri) { return noData(); }
    const entries = await readScreenshotSidecar(fileUri.fsPath);
    if (entries.length === 0) { return noData(); }

    // Evidence ids are 0-based; sidecar logLine is 1-based. Nearest-first to the signal's anchor.
    const target = (evidenceLineIds[0] ?? 0) + 1;
    const nearest = [...entries]
        .sort((a, b) => Math.abs(a.logLine - target) - Math.abs(b.logLine - target))
        .slice(0, MAX_STRIP);

    // Before/after pixel diff: when the log holds a capture from BEFORE the error (screen
    // navigation shots are the intended source), show what changed on screen leading into
    // the failure. The heat overlay is computed client-side on a canvas by the shell script
    // (see signal-report-diff-script.ts) — the extension host has no image decoder. This
    // pair stays base64 (canvas pixel reads need a same-origin/data-URI source).
    const pair = selectDiffPair(entries, target);
    const diffHtml = pair ? await buildDiffBlockHtml(fileUri, pair) : '';

    // Thumbnails stream via webview.asWebviewUri() instead of base64 (bug_031) — no
    // disk read or MAX_IMAGE_BYTES check needed here, the <img> tag loads them lazily.
    const cards = nearest.map((e) => buildThumbHtml(webview, fileUri, e));
    const strip = cards.filter((c) => c.length > 0).join('');
    if (diffHtml.length === 0 && strip.length === 0) { return noData(); }
    return diffHtml + (strip.length > 0 ? `<div class="screenshot-strip">${strip}</div>` : '');
}

/**
 * The three-cell diff block: before image, at-error image, and a canvas the shell script
 * fills with the after frame plus a magenta change-heat overlay. Empty string when either
 * image fails to inline (the plain strip still renders).
 */
async function buildDiffBlockHtml(fileUri: vscode.Uri, pair: ScreenshotDiffPair): Promise<string> {
    const beforeUri = await readImageDataUri(fileUri, pair.before);
    const afterUri = await readImageDataUri(fileUri, pair.after);
    if (!beforeUri || !afterUri) { return ''; }
    const beforeTime = new Date(pair.before.timestamp).toLocaleTimeString();
    const afterTime = new Date(pair.after.timestamp).toLocaleTimeString();
    return `<div class="screenshot-diff">
        <figure class="diff-cell">
            <img class="diff-img diff-before" src="${beforeUri}" alt="">
            <figcaption>${escapeHtml(t('signals.screenshots.diff.before', beforeTime))}</figcaption>
        </figure>
        <figure class="diff-cell">
            <img class="diff-img diff-after" src="${afterUri}" alt="">
            <figcaption>${escapeHtml(t('signals.screenshots.diff.atError', afterTime))}</figcaption>
        </figure>
        <figure class="diff-cell">
            <canvas class="diff-canvas"></canvas>
            <figcaption>${escapeHtml(t('signals.screenshots.diff.changes'))}</figcaption>
        </figure>
    </div>`;
}

/** Read one screenshot as a data URI, or undefined on missing/oversized files. */
async function readImageDataUri(fileUri: vscode.Uri, entry: ScreenshotMetaEntry): Promise<string | undefined> {
    try {
        const bytes = await vscode.workspace.fs.readFile(vscode.Uri.joinPath(screenshotDirUri(fileUri.fsPath), entry.file));
        if (bytes.byteLength > MAX_IMAGE_BYTES) { return undefined; }
        return `data:image/png;base64,${Buffer.from(bytes).toString('base64')}`;
    } catch {
        return undefined;
    }
}

function noData(): string {
    return `<div class="no-data">${escapeHtml(t('signals.screenshots.noData'))}</div>`;
}

/** One clickable thumbnail (reuses the shell's .overview-file-link openFile delegate).
 *  bug_031: src is now a webview.asWebviewUri() resource reference, not an inlined
 *  base64 data URI — the browser streams the PNG from disk instead of it round-tripping
 *  through postMessage + the panel's persisted webview state on every section refresh. */
function buildThumbHtml(webview: vscode.Webview, fileUri: vscode.Uri, entry: ScreenshotMetaEntry): string {
    const pngUri = vscode.Uri.joinPath(screenshotDirUri(fileUri.fsPath), entry.file);
    const webviewSrc = webview.asWebviewUri(pngUri).toString();
    const when = new Date(entry.timestamp).toLocaleTimeString();
    const caption = t('signals.screenshots.caption', String(entry.logLine), when);
    return `<a class="overview-file-link screenshot-card" href="#" data-uri="${escapeHtml(pngUri.toString())}" data-kind="image" title="${escapeHtml(t('signals.screenshots.openFull'))}">
        <img class="screenshot-thumb" src="${escapeHtml(webviewSrc)}" alt="">
        <span class="screenshot-caption">${escapeHtml(caption)}</span>
    </a>`;
}

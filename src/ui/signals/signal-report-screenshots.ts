/**
 * Screenshot evidence section for the signal report (plan 114, workstream D).
 *
 * Shows the captures nearest the signal's first evidence line — visual "what the
 * screen showed" beside the textual evidence. Up to three thumbnails render as a
 * strip (each opens full size), which covers the multi-capture case without the
 * stateful prev/next navigation the plan first sketched.
 *
 * Thumbnails are embedded as data URIs: the report panel has localResourceRoots []
 * and a one-shot HTML build, so lazy loading would buy nothing here. Reads are
 * capped per image and to three images.
 */

import * as vscode from 'vscode';
import { t } from '../../l10n';
import { escapeHtml } from '../../modules/capture/ansi';
import {
    readScreenshotSidecar,
    screenshotDirUri,
    type ScreenshotMetaEntry,
} from '../../modules/screenshot/screenshot-store';

/** Same inline-image ceiling as the viewer/gallery handlers. */
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

/** At most this many thumbnails in the strip. */
const MAX_STRIP = 3;

/** Build the Screenshots section HTML; a no-data div when the log has no captures. */
export async function buildScreenshotSectionHtml(
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

    const cards = await Promise.all(nearest.map((e) => buildThumbHtml(fileUri, e)));
    const strip = cards.filter((c) => c.length > 0).join('');
    return strip.length > 0 ? `<div class="screenshot-strip">${strip}</div>` : noData();
}

function noData(): string {
    return `<div class="no-data">${escapeHtml(t('signals.screenshots.noData'))}</div>`;
}

/** One clickable thumbnail (reuses the shell's .overview-file-link openFile delegate). */
async function buildThumbHtml(fileUri: vscode.Uri, entry: ScreenshotMetaEntry): Promise<string> {
    const pngUri = vscode.Uri.joinPath(screenshotDirUri(fileUri.fsPath), entry.file);
    let dataUri: string;
    try {
        const bytes = await vscode.workspace.fs.readFile(pngUri);
        if (bytes.byteLength > MAX_IMAGE_BYTES) { return ''; }
        dataUri = `data:image/png;base64,${Buffer.from(bytes).toString('base64')}`;
    } catch {
        return '';
    }
    const when = new Date(entry.timestamp).toLocaleTimeString();
    const caption = t('signals.screenshots.caption', String(entry.logLine), when);
    return `<a class="overview-file-link screenshot-card" href="#" data-uri="${escapeHtml(pngUri.toString())}" data-kind="image" title="${escapeHtml(t('signals.screenshots.openFull'))}">
        <img class="screenshot-thumb" src="${dataUri}" alt="">
        <span class="screenshot-caption">${escapeHtml(caption)}</span>
    </a>`;
}

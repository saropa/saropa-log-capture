/**
 * Download a log file from a URL into the extension's temp storage and load it in the viewer.
 *
 * Shared by the "Open Log from URL…" command and by dragging a web URL onto the viewer. Uses the
 * Node 22 global `fetch` (no new dependency). Only http/https are accepted; the download is bounded
 * by a timeout and a size cap so a hostile or runaway URL can't hang the host or exhaust memory.
 * The bytes are staged to globalStorage/downloaded/<name> so the normal file-load pipeline (header
 * parse, sidecars, tailing) runs unchanged — there is no in-memory load path.
 */

import * as vscode from 'vscode';
import { t } from '../../l10n';
import { logExtensionError } from '../../modules/misc/extension-logger';

/** Hard ceiling on a downloaded log. A reports archive can be huge, but a single log streamed over
 *  the network into memory must stay bounded; above this we abort rather than risk an OOM. */
const maxDownloadBytes = 50 * 1024 * 1024;
/** Abort a stalled download so a dead URL never hangs the gesture. */
const downloadTimeoutMs = 30_000;

/** True for an http/https URL we are willing to fetch. Other schemes (file:, data:, ftp:) are rejected. */
export function isDownloadableUrl(raw: string): boolean {
    const s = raw.trim();
    return /^https?:\/\/\S+$/i.test(s);
}

/**
 * Fetch `url`, stage it to temp, and load it in the viewer. Surfaces a toast on success and a
 * warning on any failure (bad scheme, network error, too large) — never throws to the caller.
 */
export async function downloadAndLoadUrl(
    url: string,
    load: (uri: vscode.Uri) => Promise<void>,
    context: vscode.ExtensionContext,
): Promise<void> {
    if (!isDownloadableUrl(url)) {
        void vscode.window.showWarningMessage(t('msg.urlLog.badUrl'));
        return;
    }
    try {
        const bytes = await fetchBounded(url);
        const target = await stageDownload(url, bytes, context);
        await vscode.commands.executeCommand('saropaLogCapture.logViewer.focus');
        await load(target);
        void vscode.window.showInformationMessage(t('msg.urlLog.loaded', fileNameFromUrl(url)));
    } catch (err) {
        logExtensionError('openLogFromUrl', err instanceof Error ? err : new Error(String(err)));
        const reason = err instanceof Error ? err.message : String(err);
        void vscode.window.showWarningMessage(t('msg.urlLog.failed', fileNameFromUrl(url), reason));
    }
}

/** GET the URL with a timeout and size cap; rejects on non-2xx, oversize, or network error. */
async function fetchBounded(url: string): Promise<Uint8Array> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), downloadTimeoutMs);
    try {
        const res = await fetch(url, { signal: controller.signal, redirect: 'follow' });
        if (!res.ok) { throw new Error(`HTTP ${res.status}`); }
        // Reject early when the server declares an oversize body, before buffering it.
        const declared = Number(res.headers.get('content-length') ?? '0');
        if (declared > maxDownloadBytes) { throw new Error(t('msg.urlLog.tooLargeReason')); }
        const buf = new Uint8Array(await res.arrayBuffer());
        if (buf.byteLength > maxDownloadBytes) { throw new Error(t('msg.urlLog.tooLargeReason')); }
        return buf;
    } finally {
        clearTimeout(timer);
    }
}

/** Write the downloaded bytes under globalStorage/downloaded/<sanitized-name> and return its URI. */
async function stageDownload(
    url: string, bytes: Uint8Array, context: vscode.ExtensionContext,
): Promise<vscode.Uri> {
    const dir = vscode.Uri.joinPath(context.globalStorageUri, 'downloaded');
    await vscode.workspace.fs.createDirectory(dir);
    const target = vscode.Uri.joinPath(dir, fileNameFromUrl(url));
    await vscode.workspace.fs.writeFile(target, bytes);
    return target;
}

/** Derive a safe filename from the URL path; fall back to a default when the path has no basename. */
function fileNameFromUrl(url: string): string {
    let base = '';
    try {
        const path = new URL(url).pathname;
        base = decodeURIComponent(path.split('/').filter(Boolean).pop() ?? '');
    } catch { base = ''; }
    // Sanitize so the untrusted name can't escape the temp dir; default keeps the .log loader path.
    const safe = base.replace(/[^\w.\-]+/g, '_');
    return safe || 'downloaded.log';
}

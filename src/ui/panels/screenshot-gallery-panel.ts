/**
 * Screenshot gallery panel (plan 114, workstream E): every screenshot for one log,
 * newest first — thumbnail, datetime, trigger, and the log lines around the capture
 * ("why it was taken"), with click-to-jump into the viewer.
 *
 * Same lifecycle pattern as timeline-panel.ts: one module-level panel, revealed on
 * re-open, disposed on deactivate. Images are NOT inlined into the HTML (50 captures
 * × ~hundreds of KB would balloon the document); cards lazy-request each PNG as a
 * data URI when scrolled into view (IntersectionObserver → requestImage message).
 */

import * as vscode from 'vscode';
import { t } from '../../l10n';
import { escapeHtml } from '../../modules/capture/ansi';
import { getNonce } from '../provider/viewer-content';
import { getTokenStyles } from '../viewer-styles/viewer-styles-tokens';
import { openLogAtLine } from '../../modules/search/log-search';
import { locateLine } from '../shared/handlers/trouble-detail-handler';
import {
    readScreenshotSidecar,
    screenshotDirUri,
    type ScreenshotMetaEntry,
} from '../../modules/screenshot/screenshot-store';

let panel: vscode.WebviewPanel | undefined;
let currentUri: vscode.Uri | undefined;

/** Skip the log-excerpt context for logs beyond this — one whole-file read per open. */
const MAX_LOG_BYTES_FOR_CONTEXT = 20 * 1024 * 1024;

/** Context lines shown either side of the triggering line. */
const CONTEXT_RADIUS = 2;

/** Same data-URI ceiling as the viewer image handler. */
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

const SAFE_FILE = /^[\w-]+\.png$/;

export async function showScreenshotGallery(fileUri: vscode.Uri): Promise<void> {
    currentUri = fileUri;
    ensurePanel();
    const entries = await readScreenshotSidecar(fileUri.fsPath);
    const logLines = await readLogLines(fileUri);
    if (!panel || currentUri !== fileUri) { return; }
    panel.webview.html = buildGalleryHtml(entries, logLines, fileUri.fsPath.split(/[\\/]/).pop() ?? '');
}

export function disposeScreenshotGalleryPanel(): void { panel?.dispose(); panel = undefined; currentUri = undefined; }

function ensurePanel(): void {
    if (panel) { panel.reveal(); return; }
    panel = vscode.window.createWebviewPanel(
        'saropaLogCapture.screenshotGallery', t('panel.screenshotGallery.title'),
        vscode.ViewColumn.Beside, { enableScripts: true, localResourceRoots: [] },
    );
    panel.webview.onDidReceiveMessage(handleMessage);
    panel.onDidDispose(() => { panel = undefined; currentUri = undefined; });
}

function handleMessage(msg: Record<string, unknown>): void {
    if (msg.type === 'requestImage') { void postImage(msg.file); return; }
    if (msg.type === 'openImage') { void openImage(msg.file); return; }
    if (msg.type === 'openLine' && currentUri && typeof msg.line === 'number' && Number.isFinite(msg.line)) {
        openLogAtLine({ uri: currentUri, filename: '', lineNumber: Number(msg.line), lineText: '', matchStart: 0, matchEnd: 0 }).catch(() => {});
    }
}

function resolveImageUri(file: unknown): vscode.Uri | undefined {
    if (!currentUri || typeof file !== 'string' || !SAFE_FILE.test(file)) { return undefined; }
    return vscode.Uri.joinPath(screenshotDirUri(currentUri.fsPath), file);
}

async function postImage(file: unknown): Promise<void> {
    const uri = resolveImageUri(file);
    if (!uri || !panel) { return; }
    try {
        const bytes = await vscode.workspace.fs.readFile(uri);
        if (bytes.byteLength > MAX_IMAGE_BYTES) { return; }
        void panel.webview.postMessage({ type: 'image', file, dataUri: `data:image/png;base64,${Buffer.from(bytes).toString('base64')}` });
    } catch { /* image gone — card keeps its placeholder */ }
}

async function openImage(file: unknown): Promise<void> {
    const uri = resolveImageUri(file);
    if (uri) { await vscode.commands.executeCommand('vscode.open', uri, { preview: true }); }
}

/** Whole-log line array for the excerpt blocks, or undefined when too large/missing. */
async function readLogLines(fileUri: vscode.Uri): Promise<string[] | undefined> {
    try {
        const stat = await vscode.workspace.fs.stat(fileUri);
        if (stat.size > MAX_LOG_BYTES_FOR_CONTEXT) { return undefined; }
        const bytes = await vscode.workspace.fs.readFile(fileUri);
        return new TextDecoder().decode(bytes).split(/\r?\n/);
    } catch { return undefined; }
}

function triggerLabel(trigger: string): string {
    switch (trigger) {
        case 'error': return t('panel.screenshotGallery.trigger.error');
        case 'warning': return t('panel.screenshotGallery.trigger.warning');
        case 'nav': return t('panel.screenshotGallery.trigger.nav');
        default: return t('panel.screenshotGallery.trigger.manual');
    }
}

/**
 * The "why" block: the triggering line ± context, triggering line marked.
 *
 * `entry.logLine` counts CAPTURED lines (the session header block is uncounted, and the
 * count is session-cumulative across file splits), so it is treated as a hint only —
 * locateLine (the trouble-detail pattern) trusts it just when the line actually contains
 * the stored trigger text, and otherwise searches the file for the text.
 */
function buildExcerptHtml(entry: ScreenshotMetaEntry, logLines: string[] | undefined): string {
    const anchor0 = logLines ? locateLine(logLines, entry.logLine, entry.text) : -1;
    if (!logLines || anchor0 < 0) {
        return entry.text ? `<pre class="excerpt"><span class="hit">${escapeHtml(entry.text)}</span></pre>` : '';
    }
    const anchor = anchor0 + 1;
    const from = Math.max(1, anchor - CONTEXT_RADIUS);
    const to = Math.min(logLines.length, anchor + CONTEXT_RADIUS);
    const rows: string[] = [];
    for (let n = from; n <= to; n++) {
        const cls = n === anchor ? ' class="hit"' : '';
        rows.push(`<span${cls}>${String(n).padStart(6)}  ${escapeHtml(logLines[n - 1] ?? '')}</span>`);
    }
    return `<pre class="excerpt" data-line="${anchor}" title="${escapeHtml(t('panel.screenshotGallery.jump', String(anchor)))}">${rows.join('\n')}</pre>`;
}

function buildCardHtml(entry: ScreenshotMetaEntry, logLines: string[] | undefined): string {
    const when = new Date(entry.timestamp).toLocaleString();
    const file = escapeHtml(entry.file);
    return `<div class="card">
        <div class="thumb-wrap"><img class="thumb" data-file="${file}" alt="" title="${escapeHtml(t('panel.screenshotGallery.openFull'))}"></div>
        <div class="card-meta">
            <span class="badge badge-${escapeHtml(entry.trigger)}">${escapeHtml(triggerLabel(entry.trigger))}</span>
            <span class="when">${escapeHtml(when)}</span>
        </div>
        ${buildExcerptHtml(entry, logLines)}
    </div>`;
}

function buildGalleryHtml(entries: ScreenshotMetaEntry[], logLines: string[] | undefined, filename: string): string {
    const nonce = getNonce();
    const newestFirst = [...entries].sort((a, b) => b.timestamp - a.timestamp);
    const body = newestFirst.length === 0
        ? `<div class="empty">${escapeHtml(t('panel.screenshotGallery.empty'))}</div>`
        : newestFirst.map((e) => buildCardHtml(e, logLines)).join('\n');
    return `<!DOCTYPE html><html><head>
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}'; img-src data:;">
<style nonce="${nonce}">${getTokenStyles()}${galleryCss()}</style>
</head><body>
<h1>${escapeHtml(t('panel.screenshotGallery.title'))} — ${escapeHtml(filename)}</h1>
${body}
<script nonce="${nonce}">${galleryScript()}</script>
</body></html>`;
}

function galleryCss(): string {
    return /* css */ `
body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); background: var(--vscode-editor-background); padding: var(--space-3); }
h1 { font-size: 1.1em; margin-bottom: var(--space-3); }
.empty { color: var(--vscode-descriptionForeground); padding: 24px 0; }
.card { border: 1px solid var(--vscode-editorWidget-border); border-radius: 6px; padding: 10px; margin-bottom: 14px; max-width: 720px; }
.thumb-wrap { min-height: 60px; }
.thumb { max-width: 100%; max-height: 240px; border-radius: 4px; cursor: pointer; display: block; }
.card-meta { display: flex; gap: 10px; align-items: center; margin: 8px 0 6px; }
.badge { font-size: 0.8em; padding: 1px 8px; border-radius: var(--radius); border: 1px solid var(--vscode-editorWidget-border); }
.badge-error { color: var(--vscode-errorForeground); border-color: var(--vscode-errorForeground); }
.badge-warning { color: var(--vscode-editorWarning-foreground); border-color: var(--vscode-editorWarning-foreground); }
.when { color: var(--vscode-descriptionForeground); font-size: 0.9em; }
.excerpt { font-family: var(--vscode-editor-font-family); font-size: 0.85em; background: var(--vscode-textCodeBlock-background); border-radius: 4px; padding: 6px 8px; overflow-x: auto; cursor: pointer; }
.excerpt .hit { color: var(--vscode-errorForeground); font-weight: bold; }
`;
}

function galleryScript(): string {
    return /* javascript */ `
const vscodeApi = acquireVsCodeApi();
/* Lazy image loading: request each PNG only when its card scrolls into view. */
const io = new IntersectionObserver((es) => {
    for (const e of es) {
        if (!e.isIntersecting) continue;
        const img = e.target;
        io.unobserve(img);
        vscodeApi.postMessage({ type: 'requestImage', file: img.getAttribute('data-file') });
    }
});
document.querySelectorAll('img.thumb').forEach((img) => io.observe(img));
window.addEventListener('message', (ev) => {
    const msg = ev.data;
    if (msg && msg.type === 'image') {
        document.querySelectorAll('img.thumb[data-file="' + msg.file + '"]').forEach((img) => { img.src = msg.dataUri; });
    }
});
document.addEventListener('click', (ev) => {
    const img = ev.target.closest ? ev.target.closest('img.thumb') : null;
    if (img) { vscodeApi.postMessage({ type: 'openImage', file: img.getAttribute('data-file') }); return; }
    const ex = ev.target.closest ? ev.target.closest('pre.excerpt[data-line]') : null;
    if (ex) { vscodeApi.postMessage({ type: 'openLine', line: Number(ex.getAttribute('data-line')) }); }
});
`;
}

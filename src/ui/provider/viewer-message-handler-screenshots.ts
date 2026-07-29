/**
 * Screenshot-related webview messages (plan 114): sidecar listing, image bytes,
 * open-full-size, the footer quick toggle, and the gallery panel.
 *
 * Images travel as base64 data URIs instead of asWebviewUri because the viewer
 * webviews restrict localResourceRoots to extension dirs (audio/codicons) — workspace
 * PNGs are unreachable by URI, and widening the roots to the (user-configurable,
 * changeable-at-runtime) log directory would outlive the setting it was derived from.
 */

import * as vscode from 'vscode';
import { readScreenshotSidecar, screenshotDirUri } from '../../modules/screenshot/screenshot-store';
import { showScreenshotGallery } from '../panels/screenshot-gallery-panel';
import type { ViewerMessageContext } from './viewer-message-types';

/** Refuse to inline images beyond this (a data URI ~4/3 the size lands in webview memory). */
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

/** PNG filenames the store generates (`NNN_trigger_epochms.png`) — anything else is rejected. */
const SAFE_FILE = /^[\w-]+\.png$/;

/** Route screenshot messages; returns true when handled. */
export function dispatchScreenshotMessage(msg: Record<string, unknown>, ctx: ViewerMessageContext): boolean {
    switch (msg.type) {
        case "requestScreenshots":
            void postScreenshotList(ctx);
            return true;
        case "requestScreenshotImage":
            void postScreenshotImage(ctx, msg.file);
            return true;
        case "openScreenshotFile":
            void openScreenshotFullSize(ctx, msg.file);
            return true;
        case "toggleScreenshots": {
            // Footer camera icon quick toggle — same boolean the Integrations checkbox binds to.
            // The config-change listener re-broadcasts merged adapter state, which flips the icon.
            const cfg = vscode.workspace.getConfiguration('saropaLogCapture');
            const current = cfg.get<boolean>('integrations.screenshots.enabled', true);
            void cfg.update('integrations.screenshots.enabled', !current, vscode.ConfigurationTarget.Workspace);
            return true;
        }
        case "openScreenshotGallery":
            if (ctx.currentFileUri) { void showScreenshotGallery(ctx.currentFileUri); }
            return true;
        default:
            return false;
    }
}

/** Send the sidecar's entry list for the currently loaded log (empty when none). */
async function postScreenshotList(ctx: ViewerMessageContext): Promise<void> {
    if (!ctx.currentFileUri) { return; }
    const logFsPath = ctx.currentFileUri.fsPath;
    const screenshots = await readScreenshotSidecar(logFsPath);
    ctx.post({ type: 'screenshotList', logFsPath, screenshots });
}

/** Resolve a sidecar-relative PNG name against the current log, rejecting traversal. */
function resolveScreenshotUri(ctx: ViewerMessageContext, file: unknown): vscode.Uri | undefined {
    if (!ctx.currentFileUri || typeof file !== 'string' || !SAFE_FILE.test(file)) { return undefined; }
    return vscode.Uri.joinPath(screenshotDirUri(ctx.currentFileUri.fsPath), file);
}

/** Reply with the PNG as a data URI (lazy-loaded by the popover/gallery on demand). */
async function postScreenshotImage(ctx: ViewerMessageContext, file: unknown): Promise<void> {
    const uri = resolveScreenshotUri(ctx, file);
    if (!uri) { return; }
    try {
        const bytes = await vscode.workspace.fs.readFile(uri);
        if (bytes.byteLength > MAX_IMAGE_BYTES) { return; }
        const dataUri = `data:image/png;base64,${Buffer.from(bytes).toString('base64')}`;
        ctx.post({ type: 'screenshotImage', file, dataUri });
    } catch {
        // Missing/unreadable image: the popover keeps its loading state; nothing to crash over.
    }
}

/** Open the full-resolution PNG in a normal editor tab (VS Code's image preview). */
async function openScreenshotFullSize(ctx: ViewerMessageContext, file: unknown): Promise<void> {
    const uri = resolveScreenshotUri(ctx, file);
    if (!uri) { return; }
    await vscode.commands.executeCommand('vscode.open', uri, { preview: true });
}

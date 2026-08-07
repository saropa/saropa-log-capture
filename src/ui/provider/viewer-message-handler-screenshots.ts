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
import { getConfig } from '../../modules/config/config';
import { readScreenshotSidecar, screenshotDirUri } from '../../modules/screenshot/screenshot-store';
import { showScreenshotGallery } from '../panels/screenshot-gallery-panel';
import type { ViewerMessageContext } from './viewer-message-types';

/** Refuse to inline images beyond this (a data URI ~4/3 the size lands in webview memory). */
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

/** PNG filenames the store generates (`NNN_trigger_epochms.png`) — anything else is rejected. */
const SAFE_FILE = /^[\w-]+\.png$/;

/** Booleans the footer camera menu may write (suffixes of integrations.screenshots.*). */
const SCREENSHOT_TRIGGER_KEYS = ['enabled', 'onError', 'onWarning', 'onNavigation'];

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
        case "setScreenshotTrigger": {
            // Footer camera menu checkbox → the matching integrations.screenshots.* boolean.
            // Key is allowlisted so the webview cannot write arbitrary settings. The config-change
            // listener re-broadcasts screenshotSettings, which re-syncs every open menu/checkbox.
            const key = msg.key;
            if (typeof key === 'string' && SCREENSHOT_TRIGGER_KEYS.includes(key)) {
                const cfg = vscode.workspace.getConfiguration('saropaLogCapture');
                void cfg.update(`integrations.screenshots.${key}`, msg.value === true, vscode.ConfigurationTarget.Workspace);
            }
            return true;
        }
        case "captureScreenshotNow":
            // Menu "Capture now" — routes through the command so toasts/outcomes stay identical.
            void vscode.commands.executeCommand('saropaLogCapture.captureScreenshot');
            return true;
        case "openScreenshotGallery":
            if (ctx.currentFileUri) { void showScreenshotGallery(ctx.currentFileUri); }
            return true;
        default:
            return false;
    }
}

/**
 * The screenshotSettings payload driving the footer camera menu. Sent at webview setup
 * and re-broadcast on every integrations.screenshots.* change so menu checkboxes, the
 * Integrations panel, and Settings JSON never disagree.
 *
 * The `type` literal stays at each post site (not in here) so the outbound-catalog
 * generator's post-call scan window can see it.
 */
export function buildScreenshotSettingsPayload(): Record<string, unknown> {
    const s = getConfig().integrationsScreenshots;
    return {
        enabled: s.enabled,
        onError: s.onError,
        onWarning: s.onWarning,
        onNavigation: s.onNavigation,
        cooldownMs: s.cooldownMs,
        maxPerLog: s.maxPerLog,
    };
}

/**
 * The capture directory and the separator to join filenames to it. Exported so every message that
 * badges a capture carries the same pair — a popover opened from a LIVE capture (which arrives
 * before any list) would otherwise have no directory and fall back to a bare filename.
 */
export function screenshotDirPayload(logFsPath: string): { dir: string; sep: string } {
    const dir = screenshotDirUri(logFsPath).fsPath;
    return { dir, sep: dir.includes('\\') ? '\\' : '/' };
}

/** Send the sidecar's entry list for the currently loaded log (empty when none). */
async function postScreenshotList(ctx: ViewerMessageContext): Promise<void> {
    if (!ctx.currentFileUri) { return; }
    const logFsPath = ctx.currentFileUri.fsPath;
    const screenshots = await readScreenshotSidecar(logFsPath);
    // The capture directory rides along so the popover can show a reader the FULL path of the PNG
    // it is previewing. The sidecar stores bare filenames, and a filename alone is not something the
    // reader can act on — they need the path to open, copy, or attach the file. The separator is
    // sent explicitly rather than inferred webview-side: the webview has no platform of its own, and
    // a path this host had already normalized to forward slashes would fool any inference rule.
    ctx.post({ type: 'screenshotList', logFsPath, ...screenshotDirPayload(logFsPath), screenshots });
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
        if (bytes.byteLength > MAX_IMAGE_BYTES) {
            // Oversized reads reply as errors too — the popover must never sit on its
            // loading placeholder forever (no silent async).
            ctx.post({ type: 'screenshotImage', file, error: true });
            return;
        }
        const dataUri = `data:image/png;base64,${Buffer.from(bytes).toString('base64')}`;
        ctx.post({ type: 'screenshotImage', file, dataUri });
    } catch {
        // Missing/unreadable image: tell the webview so it shows a visible failure state.
        ctx.post({ type: 'screenshotImage', file, error: true });
    }
}

/** Open the full-resolution PNG in a normal editor tab (VS Code's image preview). */
async function openScreenshotFullSize(ctx: ViewerMessageContext, file: unknown): Promise<void> {
    const uri = resolveScreenshotUri(ctx, file);
    if (!uri) { return; }
    await vscode.commands.executeCommand('vscode.open', uri, { preview: true });
}

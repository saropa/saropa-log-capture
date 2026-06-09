/**
 * Host handler for files dropped onto the viewer from the OS (see viewer-drop-to-open.ts).
 * Prefers the real filesystem path; when the sandbox hides it, the transferred text is
 * staged to a temp file so the standard load pipeline (header parse, sidecars, tailing)
 * runs unchanged — there is no in-memory load path.
 */

import * as vscode from 'vscode';
import { t } from '../../l10n';
import type { ViewerMessageContext } from './viewer-message-types';
import { logExtensionError } from '../../modules/misc/extension-logger';

/** Route a dropped-log message to the right load path, or surface a warning. */
export async function handleOpenDroppedLog(
    msg: Record<string, unknown>, ctx: ViewerMessageContext,
): Promise<void> {
    const name = typeof msg.name === 'string' ? msg.name : '';
    if (msg.tooLarge === true) {
        void vscode.window.showWarningMessage(t('msg.droppedLogTooLarge', name));
        return;
    }
    if (msg.error === true) {
        void vscode.window.showWarningMessage(t('msg.droppedLogReadFailed', name));
        return;
    }
    const path = typeof msg.path === 'string' ? msg.path : '';
    if (path) {
        await focusAndLoad(vscode.Uri.file(path), ctx);
        return;
    }
    if (typeof msg.content === 'string') {
        await openFromContent(name || 'dropped.log', msg.content, ctx);
    }
}

async function focusAndLoad(uri: vscode.Uri, ctx: ViewerMessageContext): Promise<void> {
    await vscode.commands.executeCommand('saropaLogCapture.logViewer.focus');
    await ctx.load(uri);
}

/** Stage dropped text under globalStorage/dropped/ and load it by URI. */
async function openFromContent(name: string, content: string, ctx: ViewerMessageContext): Promise<void> {
    try {
        const dir = vscode.Uri.joinPath(ctx.context.globalStorageUri, 'dropped');
        await vscode.workspace.fs.createDirectory(dir);
        // Sanitize: a dropped name is untrusted and must not escape the temp dir.
        const safe = name.replace(/[^\w.\-]+/g, '_') || 'dropped.log';
        const target = vscode.Uri.joinPath(dir, safe);
        await vscode.workspace.fs.writeFile(target, Buffer.from(content, 'utf-8'));
        await focusAndLoad(target, ctx);
    } catch (err) {
        logExtensionError('openDroppedLog', err instanceof Error ? err : new Error(String(err)));
    }
}

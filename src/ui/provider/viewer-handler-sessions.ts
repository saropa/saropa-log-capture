/**
 * Session action dispatch for viewer targets.
 * Extracted from viewer-handler-wiring.ts for file-length compliance.
 */

import * as vscode from "vscode";
import type { SessionHistoryProvider } from "../session/session-history-provider";

/** Context for dispatching session actions. */
export interface SessionActionContext {
    readonly historyProvider: SessionHistoryProvider;
    readonly refreshList: () => Promise<void>;
    readonly openSessionForReplay?: (uri: vscode.Uri) => Promise<void>;
}

/** Dispatch a session action (open, trash, export, etc.) from the webview session panel. */
export async function handleSessionAction(
    action: string, uriString: string, filename: string, ctx: SessionActionContext,
): Promise<void> {
    const uri = uriString ? vscode.Uri.parse(uriString) : undefined;
    const item = uri ? { uri, filename } : undefined;
    const mutating = ['trash', 'restore', 'emptyTrash', 'deletePermanently', 'rename', 'tag'];
    switch (action) {
        case 'open':
            if (item) { await vscode.commands.executeCommand('saropaLogCapture.openSession', item); }
            break;
        case 'replay':
            if (uri && ctx.openSessionForReplay) {
                await ctx.openSessionForReplay(uri);
            } else if (item) {
                await vscode.commands.executeCommand('saropaLogCapture.openSession', item);
            }
            break;
        case 'trash':
            if (item) { await vscode.commands.executeCommand('saropaLogCapture.trashSession', item); }
            break;
        case 'restore':
            if (item) { await vscode.commands.executeCommand('saropaLogCapture.restoreSession', item); }
            break;
        case 'emptyTrash':
            await vscode.commands.executeCommand('saropaLogCapture.emptyTrash');
            break;
        case 'deletePermanently':
            if (item) { await vscode.commands.executeCommand('saropaLogCapture.deleteSession', item); }
            break;
        case 'rename':
            if (item) { await vscode.commands.executeCommand('saropaLogCapture.renameSession', item); }
            break;
        case 'tag':
            if (item) { await vscode.commands.executeCommand('saropaLogCapture.tagSession', item); }
            break;
        case 'exportHtml':
            if (item) { await vscode.commands.executeCommand('saropaLogCapture.exportHtml', item); }
            break;
        case 'exportCsv':
            if (item) { await vscode.commands.executeCommand('saropaLogCapture.exportCsv', item); }
            break;
        case 'exportJson':
            if (item) { await vscode.commands.executeCommand('saropaLogCapture.exportJson', item); }
            break;
        case 'exportJsonl':
            if (item) { await vscode.commands.executeCommand('saropaLogCapture.exportJsonl', item); }
            break;
        case 'exportSlc':
            if (item) { await vscode.commands.executeCommand('saropaLogCapture.exportSlc', item); }
            break;
        case 'exportToLoki':
            if (item) { await vscode.commands.executeCommand('saropaLogCapture.exportToLoki', item); }
            break;
        case 'copyDeepLink':
            if (item) { await vscode.commands.executeCommand('saropaLogCapture.copyDeepLink', item); }
            break;
        case 'copyFilePath':
            if (item) { await vscode.commands.executeCommand('saropaLogCapture.copyFilePath', item); }
            break;
    }
    if (mutating.includes(action)) { await ctx.refreshList(); }
}

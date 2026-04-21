/**
 * Session action dispatch for viewer targets.
 * Extracted from viewer-handler-wiring.ts for file-length compliance.
 */

import * as vscode from "vscode";
import { t } from "../../l10n";
import { generateDeepLink } from "../../modules/features/deep-links";
import type { SessionHistoryProvider } from "../session/session-history-provider";

/** Context for dispatching session actions. */
export interface SessionActionContext {
    readonly historyProvider: SessionHistoryProvider;
    readonly refreshList: () => Promise<void>;
    readonly openSessionForReplay?: (uri: vscode.Uri) => Promise<void>;
}

/**
 * Dispatch a session action (open, trash, export, etc.) from the webview session panel.
 * Supports multi-select: when multiple sessions are selected, actions run per session
 * (sequentially for open/export/tag/trash to avoid overlapping dialogs).
 */
export async function handleSessionAction(
    action: string, uriStrings: string[], filenames: string[], ctx: SessionActionContext,
): Promise<void> {
    const n = Math.max(uriStrings.length, filenames.length);
    const items = Array.from({ length: n }, (_, i) => {
        const uri = uriStrings[i] ? vscode.Uri.parse(uriStrings[i]) : undefined;
        const filename = filenames[i] ?? '';
        return uri ? { uri, filename } : undefined;
    }).filter((x): x is { uri: vscode.Uri; filename: string } => x !== undefined);

    const mutating = ['trash', 'restore', 'emptyTrash', 'deletePermanently', 'rename', 'tag'];
    switch (action) {
        case 'open':
            for (const item of items) {
                await vscode.commands.executeCommand('saropaLogCapture.openSession', item);
            }
            break;
        case 'replay':
            if (items.length > 0 && ctx.openSessionForReplay) {
                await ctx.openSessionForReplay(items[0].uri);
            } else if (items.length > 0) {
                await vscode.commands.executeCommand('saropaLogCapture.openSession', items[0]);
            }
            break;
        case 'trash':
            for (const item of items) {
                await vscode.commands.executeCommand('saropaLogCapture.trashSession', item);
            }
            break;
        case 'restore':
            for (const item of items) {
                await vscode.commands.executeCommand('saropaLogCapture.restoreSession', item);
            }
            break;
        case 'emptyTrash':
            await vscode.commands.executeCommand('saropaLogCapture.emptyTrash');
            break;
        case 'deletePermanently':
            for (const item of items) {
                await vscode.commands.executeCommand('saropaLogCapture.deleteSession', item);
            }
            break;
        case 'rename':
            for (const item of items) {
                await vscode.commands.executeCommand('saropaLogCapture.renameSession', item);
            }
            break;
        case 'tag':
            for (const item of items) {
                await vscode.commands.executeCommand('saropaLogCapture.tagSession', item);
            }
            break;
        case 'exportHtml':
            for (const item of items) {
                await vscode.commands.executeCommand('saropaLogCapture.exportHtml', item);
            }
            break;
        case 'exportCsv':
            for (const item of items) {
                await vscode.commands.executeCommand('saropaLogCapture.exportCsv', item);
            }
            break;
        case 'exportJson':
            for (const item of items) {
                await vscode.commands.executeCommand('saropaLogCapture.exportJson', item);
            }
            break;
        case 'exportJsonl':
            for (const item of items) {
                await vscode.commands.executeCommand('saropaLogCapture.exportJsonl', item);
            }
            break;
        case 'exportSlc':
            for (const item of items) {
                await vscode.commands.executeCommand('saropaLogCapture.exportSlc', item);
            }
            break;
        case 'exportToLoki':
            for (const item of items) {
                await vscode.commands.executeCommand('saropaLogCapture.exportToLoki', item);
            }
            break;
        case 'copyDeepLink': {
            const lines = items.map((it) => generateDeepLink(it.filename)).filter(Boolean);
            if (lines.length > 0) {
                await vscode.env.clipboard.writeText(lines.join('\n'));
                vscode.window.showInformationMessage(
                    lines.length === 1 ? t('msg.deepLinkCopied', '') : t('msg.deepLinksCopied', String(lines.length)),
                );
            }
            break;
        }
        case 'copyFilePath': {
            const paths = items.map((it) => it.uri.fsPath);
            if (paths.length > 0) {
                await vscode.env.clipboard.writeText(paths.join('\n'));
                vscode.window.showInformationMessage(
                    paths.length === 1 ? t('msg.filePathCopied') : t('msg.filePathsCopied', String(paths.length)),
                );
            }
            break;
        }
        // Reveal each selected log in the OS file explorer (Explorer/Finder/containing folder).
        // Runs the built-in VS Code command per item; failures are swallowed because the native
        // OS call may not be available in restricted/remote contexts and a thrown error would
        // be surfaced as a modal that isn't actionable.
        case 'revealInOS': {
            for (const item of items) {
                await vscode.commands.executeCommand('revealFileInOS', item.uri).then(() => {}, () => {});
            }
            break;
        }
        case 'addToCollection':
            for (const item of items) {
                await vscode.commands.executeCommand('saropaLogCapture.addToCollection', { uri: item.uri });
            }
            break;
        // Session groups: Group, Ungroup, and Open-as-Merged-Group take the full selection in a
        // single invocation (not one command per item) because they operate on the group as a
        // whole. Running them per-item would produce N singletons for Group, and N separate
        // viewer loads for Open, defeating the point.
        case 'group':
            if (items.length > 0) {
                await vscode.commands.executeCommand('saropaLogCapture.groupSelectedSessions', items[0], items);
            }
            break;
        case 'ungroup':
            if (items.length > 0) {
                await vscode.commands.executeCommand('saropaLogCapture.ungroupSession', items[0], items);
            }
            break;
        case 'openGroup':
            if (items.length > 0) {
                await vscode.commands.executeCommand('saropaLogCapture.openSessionGroup', items[0], items);
            }
            break;
        case 'addGroupToCollection':
            if (items.length > 0) {
                await vscode.commands.executeCommand('saropaLogCapture.addGroupToCollection', items[0], items);
            }
            break;
    }
    if (mutating.includes(action) || action === 'group' || action === 'ungroup') { await ctx.refreshList(); }
}

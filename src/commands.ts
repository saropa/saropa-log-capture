/** Command registration for the Saropa Log Capture extension. */

import * as vscode from 'vscode';
import { getLogDirectoryUri } from './modules/config';
import { SessionManagerImpl } from './modules/session-manager';
import { handleDeleteCommand } from './modules/delete-command';
import { showSearchQuickPick } from './modules/log-search-ui';
import { openLogAtLine } from './modules/log-search';
import { LogViewerProvider } from './ui/log-viewer-provider';
import { SessionHistoryProvider } from './ui/session-history-provider';
import { exportToHtml } from './modules/html-export';
import { exportToInteractiveHtml } from './modules/html-export-interactive';
import { copyDeepLinkToClipboard } from './modules/deep-links';
import { loadPresets, promptSavePreset, pickPreset } from './modules/filter-presets';
import { InlineDecorationsProvider } from './ui/inline-decorations';
import { getComparisonPanel } from './ui/session-comparison';
import { applyTemplate } from './modules/session-templates';
import { pickTemplate, promptSaveTemplate } from './modules/session-templates-ui';
import { exportToCsv, exportToJson, exportToJsonl } from './modules/export-formats';

/** Dependencies needed by command registrations. */
export interface CommandDeps {
    readonly context: vscode.ExtensionContext;
    readonly sessionManager: SessionManagerImpl;
    readonly viewerProvider: LogViewerProvider;
    readonly historyProvider: SessionHistoryProvider;
    readonly inlineDecorations: InlineDecorationsProvider;
}

/** URI of session marked for comparison (first selection). */
let comparisonMarkUri: vscode.Uri | undefined;

/** Register all extension commands. */
export function registerCommands(deps: CommandDeps): void {
    const { context } = deps;
    context.subscriptions.push(
        ...sessionLifecycleCommands(deps),
        ...sessionActionCommands(deps),
        ...historyBrowseCommands(deps),
        ...historyEditCommands(deps),
        ...exportCommands(),
        ...comparisonCommands(deps),
        ...toolCommands(deps),
    );
}

function sessionLifecycleCommands(deps: CommandDeps): vscode.Disposable[] {
    const { context, sessionManager, viewerProvider } = deps;
    return [
        vscode.commands.registerCommand('saropaLogCapture.start', () => {
            const active = vscode.debug.activeDebugSession;
            if (active && !sessionManager.hasSession(active.id)) {
                sessionManager.startSession(active, context);
            }
        }),
        vscode.commands.registerCommand('saropaLogCapture.stop', async () => {
            const active = vscode.debug.activeDebugSession;
            if (active) { await sessionManager.stopSession(active); }
        }),
        vscode.commands.registerCommand('saropaLogCapture.pause', () => {
            const paused = sessionManager.togglePause();
            if (paused !== undefined) { viewerProvider.setPaused(paused); }
        }),
        vscode.commands.registerCommand('saropaLogCapture.open', async () => {
            const s = sessionManager.getActiveSession();
            if (s) { await vscode.window.showTextDocument(s.fileUri); }
        }),
        vscode.commands.registerCommand('saropaLogCapture.openFolder', async () => {
            const folder = vscode.workspace.workspaceFolders?.[0];
            if (folder) {
                await vscode.commands.executeCommand('revealFileInOS', getLogDirectoryUri(folder));
            }
        }),
        vscode.commands.registerCommand('saropaLogCapture.clear', () => {
            sessionManager.clearActiveSession();
        }),
    ];
}

function sessionActionCommands(deps: CommandDeps): vscode.Disposable[] {
    const { sessionManager, historyProvider } = deps;
    return [
        vscode.commands.registerCommand('saropaLogCapture.delete', async () => { await handleDeleteCommand(); }),
        vscode.commands.registerCommand('saropaLogCapture.insertMarker', async () => {
            const text = await vscode.window.showInputBox({
                prompt: 'Marker text (leave empty for timestamp only)',
                placeHolder: 'e.g. before refactor, test attempt 2',
            });
            if (text !== undefined) { sessionManager.insertMarker(text || undefined); }
        }),
        vscode.commands.registerCommand('saropaLogCapture.splitNow', async () => {
            const session = sessionManager.getActiveSession();
            if (!session) {
                vscode.window.showWarningMessage('No active debug session to split.');
                return;
            }
            await session.splitNow();
            historyProvider.refresh();
            vscode.window.showInformationMessage(`Log file split. Now on part ${session.partNumber + 1}.`);
        }),
    ];
}

function historyBrowseCommands(deps: CommandDeps): vscode.Disposable[] {
    const { viewerProvider, historyProvider } = deps;
    return [
        vscode.commands.registerCommand('saropaLogCapture.refreshHistory', () => {
            historyProvider.refresh();
        }),
        vscode.commands.registerCommand('saropaLogCapture.openSession', async (item: { uri: vscode.Uri }) => {
            if (!item?.uri) { return; }
            await vscode.commands.executeCommand('saropaLogCapture.logViewer.focus');
            await viewerProvider.loadFromFile(item.uri);
        }),
        vscode.commands.registerCommand('saropaLogCapture.deleteSession',
          async (item: { uri: vscode.Uri; filename: string }) => {
            if (!item?.uri) { return; }
            const answer = await vscode.window.showWarningMessage(
                `Delete ${item.filename}?`, { modal: true }, 'Delete',
            );
            if (answer === 'Delete') {
                await vscode.workspace.fs.delete(item.uri);
                historyProvider.refresh();
            }
        }),
    ];
}

function historyEditCommands(deps: CommandDeps): vscode.Disposable[] {
    const { historyProvider } = deps;
    return [
        vscode.commands.registerCommand('saropaLogCapture.renameSession',
          async (item: { uri: vscode.Uri; filename: string }) => {
            if (!item?.uri) { return; }
            const name = await vscode.window.showInputBox({
                prompt: 'Enter new name for this session (also renames file)',
                value: item.filename.replace(/\.log$/, '').replace(/^\d{8}_\d{2}-\d{2}_/, ''),
            });
            if (!name || name.trim() === '') { return; }
            const metaStore = historyProvider.getMetaStore();
            const newUri = await metaStore.renameLogFile(item.uri, name.trim());
            await metaStore.setDisplayName(newUri, name.trim());
            historyProvider.refresh();
        }),
        vscode.commands.registerCommand('saropaLogCapture.tagSession',
          async (item: { uri: vscode.Uri }) => {
            if (!item?.uri) { return; }
            const meta = await historyProvider.getMetaStore().loadMetadata(item.uri);
            const input = await vscode.window.showInputBox({
                prompt: 'Enter tags (comma-separated)',
                value: (meta.tags ?? []).join(', '),
            });
            if (input === undefined) { return; }
            const tags = input.split(',').map(t => t.trim()).filter(t => t.length > 0);
            await historyProvider.getMetaStore().setTags(item.uri, tags);
            historyProvider.refresh();
        }),
    ];
}

function exportCommands(): vscode.Disposable[] {
    return [
        htmlExportCmd('exportHtml', exportToHtml),
        htmlExportCmd('exportHtmlInteractive', exportToInteractiveHtml),
        fileExportCmd('exportCsv', exportToCsv),
        fileExportCmd('exportJson', exportToJson),
        fileExportCmd('exportJsonl', exportToJsonl),
    ];
}

function htmlExportCmd(
    name: string,
    fn: (uri: vscode.Uri) => Promise<vscode.Uri>,
): vscode.Disposable {
    return vscode.commands.registerCommand(`saropaLogCapture.${name}`,
      async (item: { uri: vscode.Uri }) => {
        if (!item?.uri) { return; }
        await vscode.env.openExternal(await fn(item.uri));
    });
}

function fileExportCmd(
    name: string,
    fn: (uri: vscode.Uri) => Promise<vscode.Uri>,
): vscode.Disposable {
    return vscode.commands.registerCommand(`saropaLogCapture.${name}`,
      async (item: { uri: vscode.Uri }) => {
        if (!item?.uri) { return; }
        const outUri = await fn(item.uri);
        const action = await vscode.window.showInformationMessage(
            `Exported to ${outUri.fsPath.split(/[\\/]/).pop()}`, 'Open',
        );
        if (action === 'Open') { await vscode.window.showTextDocument(outUri); }
    });
}

function comparisonCommands(deps: CommandDeps): vscode.Disposable[] {
    const { context } = deps;
    return [
        vscode.commands.registerCommand('saropaLogCapture.markForComparison',
          (item: { uri: vscode.Uri; filename: string }) => {
            if (!item?.uri) { return; }
            comparisonMarkUri = item.uri;
            vscode.window.showInformationMessage(
                `Marked "${item.filename}" for comparison. Select another session to compare.`,
            );
        }),
        vscode.commands.registerCommand('saropaLogCapture.compareWithMarked',
          async (item: { uri: vscode.Uri }) => {
            if (!item?.uri) { return; }
            if (!comparisonMarkUri) {
                vscode.window.showWarningMessage(
                    'No session marked. Right-click a session and "Mark for Comparison" first.',
                );
                return;
            }
            if (comparisonMarkUri.fsPath === item.uri.fsPath) {
                vscode.window.showWarningMessage('Cannot compare a session with itself.');
                return;
            }
            const panel = getComparisonPanel(context.extensionUri);
            await panel.compare(comparisonMarkUri, item.uri);
            comparisonMarkUri = undefined;
        }),
        vscode.commands.registerCommand('saropaLogCapture.compareSessions', async () => {
            const sessions = await pickTwoSessions();
            if (sessions) {
                const panel = getComparisonPanel(context.extensionUri);
                await panel.compare(sessions[0], sessions[1]);
            }
        }),
    ];
}

function toolCommands(deps: CommandDeps): vscode.Disposable[] {
    const { viewerProvider, inlineDecorations } = deps;
    return [
        vscode.commands.registerCommand('saropaLogCapture.searchLogs', async () => {
            const match = await showSearchQuickPick();
            if (match) { await openLogAtLine(match); }
        }),
        vscode.commands.registerCommand('saropaLogCapture.copyDeepLink',
          async (item: { uri: vscode.Uri; filename: string }) => {
            if (item?.filename) { await copyDeepLinkToClipboard(item.filename); }
        }),
        vscode.commands.registerCommand('saropaLogCapture.applyPreset', async () => {
            const preset = await pickPreset();
            if (preset) { viewerProvider.applyPreset(preset.name); }
        }),
        vscode.commands.registerCommand('saropaLogCapture.savePreset', async () => {
            const preset = await promptSavePreset({});
            if (preset) { viewerProvider.setPresets(loadPresets()); }
        }),
        vscode.commands.registerCommand('saropaLogCapture.toggleInlineDecorations', () => {
            const enabled = inlineDecorations.toggle();
            vscode.window.showInformationMessage(
                `Inline log decorations ${enabled ? 'enabled' : 'disabled'}`,
            );
        }),
        vscode.commands.registerCommand('saropaLogCapture.applyTemplate', async () => {
            const template = await pickTemplate();
            if (template) {
                await applyTemplate(template);
                vscode.window.showInformationMessage(`Template "${template.name}" applied.`);
            }
        }),
        vscode.commands.registerCommand('saropaLogCapture.saveTemplate', async () => { await promptSaveTemplate(); }),
    ];
}

/** Show Quick Pick to select two sessions for comparison. */
async function pickTwoSessions(): Promise<[vscode.Uri, vscode.Uri] | undefined> {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) { return undefined; }
    const logDir = getLogDirectoryUri(folder);
    let entries: [string, vscode.FileType][];
    try {
        entries = await vscode.workspace.fs.readDirectory(logDir);
    } catch {
        vscode.window.showWarningMessage('No log sessions found.');
        return undefined;
    }
    const files = entries
        .filter(([n, t]) => t === vscode.FileType.File && n.endsWith('.log'))
        .map(([n]) => ({ label: n, uri: vscode.Uri.joinPath(logDir, n) }))
        .sort((a, b) => b.label.localeCompare(a.label));
    if (files.length < 2) {
        vscode.window.showWarningMessage('Need at least 2 sessions to compare.');
        return undefined;
    }
    const first = await vscode.window.showQuickPick(files, {
        placeHolder: 'Select FIRST session to compare', title: 'Compare Sessions (1/2)',
    });
    if (!first) { return undefined; }
    const second = await vscode.window.showQuickPick(
        files.filter(f => f.uri.fsPath !== first.uri.fsPath),
        { placeHolder: 'Select SECOND session to compare', title: 'Compare Sessions (2/2)' },
    );
    return second ? [first.uri, second.uri] : undefined;
}

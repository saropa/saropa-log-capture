/** Command registration for the Saropa Log Capture extension. */

import * as vscode from 'vscode';
import { getConfig, getLogDirectoryUri } from './modules/config/config';
import { SessionManagerImpl } from './modules/session/session-manager';
import { handleDeleteCommand } from './modules/features/delete-command';
import { showSearchQuickPick } from './modules/search/log-search-ui';
import { openLogAtLine } from './modules/search/log-search';
import { LogViewerProvider } from './ui/provider/log-viewer-provider';
import { SessionHistoryProvider } from './ui/session/session-history-provider';
import { scanForCorrelationTags } from './modules/analysis/correlation-scanner';
import { exportToHtml } from './modules/export/html-export';
import { exportToInteractiveHtml } from './modules/export/html-export-interactive';
import { copyDeepLinkToClipboard } from './modules/features/deep-links';
import { loadPresets, promptSavePreset, pickPreset } from './modules/storage/filter-presets';
import { InlineDecorationsProvider } from './ui/viewer-decorations/inline-decorations';
import { PopOutPanel } from './ui/viewer-panels/pop-out-panel';
import { comparisonCommands } from './commands-comparison';
import { applyTemplate } from './modules/session/session-templates';
import { pickTemplate, promptSaveTemplate } from './modules/misc/session-templates-ui';
import { exportToCsv, exportToJson, exportToJsonl } from './modules/export/export-formats';
import { insightsCommands } from './commands-insights';
import { bugReportCommands } from './commands-bug-report';
import { timelineCommands } from './commands-timeline';
import { trashCommands } from './commands-trash';
import { getGlobalProjectIndexer } from './modules/project-indexer/project-indexer';
import { showIntegrationsPicker } from './modules/integrations/integrations-ui';
import { logExtensionWarn } from './modules/misc/extension-logger';

/** Dependencies needed by command registrations. */
export interface CommandDeps {
    readonly context: vscode.ExtensionContext;
    readonly sessionManager: SessionManagerImpl;
    readonly viewerProvider: LogViewerProvider;
    readonly historyProvider: SessionHistoryProvider;
    readonly inlineDecorations: InlineDecorationsProvider;
    readonly popOutPanel: PopOutPanel;
}

/** Register all extension commands. */
export function registerCommands(deps: CommandDeps): void {
    const { context } = deps;
    context.subscriptions.push(
        ...sessionLifecycleCommands(deps),
        ...sessionActionCommands(deps),
        ...historyBrowseCommands(deps),
        ...historyEditCommands(deps),
        ...exportCommands(),
        ...comparisonCommands(context.extensionUri),
        ...correlationCommands(deps),
        ...insightsCommands(),
        ...bugReportCommands(),
        ...timelineCommands(),
        ...trashCommands(deps.historyProvider, () => deps.viewerProvider.getCurrentFileUri()),
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
                prompt: vscode.l10n.t('msg.markerPrompt'),
                placeHolder: vscode.l10n.t('msg.markerPlaceholder'),
            });
            if (text !== undefined) { sessionManager.insertMarker(text || undefined); }
        }),
        vscode.commands.registerCommand('saropaLogCapture.splitNow', async () => {
            const session = sessionManager.getActiveSession();
            if (!session) {
                vscode.window.showWarningMessage(vscode.l10n.t('msg.noActiveSessionToSplit'));
                return;
            }
            await session.splitNow();
            historyProvider.refresh();
            vscode.window.showInformationMessage(vscode.l10n.t('msg.logFileSplit', String(session.partNumber + 1)));
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
        vscode.commands.registerCommand('saropaLogCapture.openTailedFile', async () => {
            const folder = vscode.workspace.workspaceFolders?.[0];
            if (!folder) {
                void vscode.window.showWarningMessage(vscode.l10n.t('msg.openWorkspaceFirst', 'Open a workspace folder first.'));
                return;
            }
            const cfg = getConfig();
            const patterns = cfg.tailPatterns.length > 0 ? cfg.tailPatterns : ['**/*.log'];
            const exclude = '**/node_modules/**';
            const uris = new Map<string, vscode.Uri>();
            for (const pattern of patterns) {
                const found = await vscode.workspace.findFiles(new vscode.RelativePattern(folder, pattern), exclude, 500);
                for (const u of found) { uris.set(u.fsPath, u); }
            }
            const list = [...uris.values()].sort((a, b) => a.fsPath.localeCompare(b.fsPath));
            if (list.length === 0) {
                void vscode.window.showInformationMessage(vscode.l10n.t('msg.noTailedFiles', 'No files match tail patterns. Check saropaLogCapture.tailPatterns.'));
                return;
            }
            const rel = (u: vscode.Uri) => vscode.workspace.asRelativePath(u, false);
            const picked = await vscode.window.showQuickPick(
                list.map((u) => ({ label: rel(u), uri: u })),
                { placeHolder: vscode.l10n.t('msg.selectTailedFile', 'Select a file to open and tail') },
            );
            if (picked?.uri) {
                await vscode.commands.executeCommand('saropaLogCapture.logViewer.focus');
                await viewerProvider.loadFromFile(picked.uri, { tail: true });
            }
        }),
        vscode.commands.registerCommand('saropaLogCapture.deleteSession',
          async (item: { uri: vscode.Uri; filename: string }) => {
            if (!item?.uri) { return; }
            const answer = await vscode.window.showWarningMessage(
                vscode.l10n.t('msg.deleteFileConfirm', item.filename),
                { modal: true },
                vscode.l10n.t('action.delete'),
            );
            if (answer === vscode.l10n.t('action.delete')) {
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
                prompt: vscode.l10n.t('msg.renameSessionPrompt'),
                value: item.filename.replace(/\.log$/, '').replace(/^\d{8}_(?:\d{6}|\d{2}-\d{2}(?:-\d{2})?)_/, ''),
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
                prompt: vscode.l10n.t('msg.enterTagsPrompt'),
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
            vscode.l10n.t('msg.exportedTo', outUri.fsPath.split(/[\\/]/).pop() ?? ''),
            vscode.l10n.t('action.open'),
        );
        if (action === vscode.l10n.t('action.open')) { await vscode.window.showTextDocument(outUri); }
    });
}

function correlationCommands(deps: CommandDeps): vscode.Disposable[] {
    const { historyProvider } = deps;
    return [
        vscode.commands.registerCommand('saropaLogCapture.rescanTags', async (item: { uri: vscode.Uri }) => {
            if (!item?.uri) { return; }
            const tags = await scanForCorrelationTags(item.uri);
            await historyProvider.getMetaStore().setCorrelationTags(item.uri, tags);
            historyProvider.refresh();
            vscode.window.showInformationMessage(
            vscode.l10n.t('msg.foundCorrelationTags', String(tags.length), tags.length !== 1 ? 's' : ''),
        );
        }),
    ];
}


function toolCommands(deps: CommandDeps): vscode.Disposable[] {
    const { viewerProvider, inlineDecorations, popOutPanel, sessionManager } = deps;
    return [
        vscode.commands.registerCommand('saropaLogCapture.rebuildProjectIndex', async () => {
            const indexer = getGlobalProjectIndexer();
            if (!indexer) {
                logExtensionWarn('rebuildProjectIndex', 'Project index not available (no workspace folder)');
                vscode.window.showWarningMessage('Project index is not available (no workspace folder).');
                return;
            }
            await vscode.window.withProgress(
                { location: vscode.ProgressLocation.Notification, title: 'Rebuilding project index', cancellable: true },
                async (_progress, _token) => {
                    const getActiveLogUri = () => sessionManager.getActiveSession()?.fileUri;
                    await indexer.build(getActiveLogUri);
                },
            );
            vscode.window.showInformationMessage('Project index rebuilt.');
        }),
        vscode.commands.registerCommand('saropaLogCapture.popOutViewer', async () => { await popOutPanel.open(); }),
        vscode.commands.registerCommand('saropaLogCapture.searchLogs', async () => {
            const match = await showSearchQuickPick();
            if (match) { await openLogAtLine(match); }
        }),
        vscode.commands.registerCommand('saropaLogCapture.copyDeepLink',
          async (item: { uri: vscode.Uri; filename: string }) => {
            if (item?.filename) { await copyDeepLinkToClipboard(item.filename); }
        }),
        vscode.commands.registerCommand('saropaLogCapture.copyFilePath', async (item: { uri: vscode.Uri }) => {
            if (!item?.uri) { return; }
            await vscode.env.clipboard.writeText(item.uri.fsPath);
            vscode.window.showInformationMessage(vscode.l10n.t('msg.filePathCopied'));
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
                enabled ? vscode.l10n.t('msg.inlineDecorationsEnabled') : vscode.l10n.t('msg.inlineDecorationsDisabled'),
            );
        }),
        vscode.commands.registerCommand('saropaLogCapture.applyTemplate', async () => {
            const template = await pickTemplate();
            if (template) {
                await applyTemplate(template);
                vscode.window.showInformationMessage(vscode.l10n.t('msg.templateApplied', template.name));
            }
        }),
        vscode.commands.registerCommand('saropaLogCapture.saveTemplate', async () => { await promptSaveTemplate(); }),
        vscode.commands.registerCommand('saropaLogCapture.resetAllSettings', resetAllSettings),
        vscode.commands.registerCommand('saropaLogCapture.configureIntegrations', () => showIntegrationsPicker()),
    ];
}

const extensionId = 'saropa.saropa-log-capture';
const settingsSection = 'saropaLogCapture';

/** Reset all extension settings to their package.json defaults. */
async function resetAllSettings(): Promise<void> {
    const answer = await vscode.window.showWarningMessage(
        vscode.l10n.t('msg.resetSettingsConfirm'),
        { modal: true },
        vscode.l10n.t('action.reset'),
    );
    if (answer !== vscode.l10n.t('action.reset')) { return; }

    const ext = vscode.extensions.getExtension(extensionId);
    const props: Record<string, unknown> | undefined =
        ext?.packageJSON?.contributes?.configuration?.properties;
    if (!props) { return; }

    const cfg = vscode.workspace.getConfiguration(settingsSection);
    const prefix = `${settingsSection}.`;
    const keys = Object.keys(props)
        .filter(k => k.startsWith(prefix))
        .map(k => k.slice(prefix.length));

    const { Global, Workspace } = vscode.ConfigurationTarget;
    await Promise.all(keys.flatMap(k => [
        cfg.update(k, undefined, Global),
        cfg.update(k, undefined, Workspace),
    ]));

    vscode.window.showInformationMessage(
        vscode.l10n.t('msg.settingsReset', String(keys.length)),
    );
}

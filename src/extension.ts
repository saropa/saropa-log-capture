import * as vscode from 'vscode';
import { getConfig, getLogDirectoryUri } from './modules/config';
import { SaropaTrackerFactory } from './modules/tracker';
import { SessionManagerImpl } from './modules/session-manager';
import { handleDeleteCommand } from './modules/delete-command';
import { resolveSourceUri } from './modules/source-resolver';
import { showSearchQuickPick, openLogAtLine } from './modules/log-search';
import { StatusBar } from './ui/status-bar';
import { LogViewerProvider } from './ui/log-viewer-provider';
import { SessionHistoryProvider } from './ui/session-history-provider';
import { exportToHtml } from './modules/html-export';
import { exportToInteractiveHtml } from './modules/html-export-interactive';
import { createUriHandler, copyDeepLinkToClipboard } from './modules/deep-links';
import { loadPresets, promptSavePreset, pickPreset } from './modules/filter-presets';
import { InlineDecorationsProvider } from './ui/inline-decorations';
import { extractSourceReference } from './modules/source-linker';
import { getComparisonPanel, disposeComparisonPanel } from './ui/session-comparison';
import { pickTemplate, promptSaveTemplate, applyTemplate } from './modules/session-templates';
import { exportToCsv, exportToJson, exportToJsonl } from './modules/export-formats';

let sessionManager: SessionManagerImpl;
/** URI of session marked for comparison (first selection). */
let comparisonMarkUri: vscode.Uri | undefined;
let inlineDecorations: InlineDecorationsProvider;
let viewerProvider: LogViewerProvider;
let historyProvider: SessionHistoryProvider;

export function activate(context: vscode.ExtensionContext): void {
    const outputChannel = vscode.window.createOutputChannel('Saropa Log Capture');
    const statusBar = new StatusBar();
    context.subscriptions.push(statusBar, outputChannel);

    sessionManager = new SessionManagerImpl(statusBar, outputChannel);

    // Inline code decorations.
    inlineDecorations = new InlineDecorationsProvider();
    context.subscriptions.push(inlineDecorations);

    // Sidebar viewer.
    viewerProvider = new LogViewerProvider(context.extensionUri);
    context.subscriptions.push(viewerProvider);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('saropaLogCapture.logViewer', viewerProvider),
    );
    // Session history tree.
    historyProvider = new SessionHistoryProvider();
    context.subscriptions.push(historyProvider);
    context.subscriptions.push(
        vscode.window.registerTreeDataProvider('saropaLogCapture.sessionHistory', historyProvider),
    );

    // Deep links URI handler.
    context.subscriptions.push(
        vscode.window.registerUriHandler(createUriHandler()),
    );

    // Initialize filter presets eagerly so they're available before first debug session.
    viewerProvider.setPresets(loadPresets());

    sessionManager.addLineListener((data) => {
        viewerProvider.addLine(data);
        if (data.watchHits && data.watchHits.length > 0) {
            viewerProvider.updateWatchCounts(sessionManager.getWatcher().getCounts());
        }
        // Extract source reference for inline decorations
        if (!data.isMarker) {
            const sourceRef = extractSourceReference(data.text);
            if (sourceRef) {
                inlineDecorations.recordLogLine(
                    sourceRef.filePath,
                    sourceRef.line,
                    data.text,
                    data.category,
                );
            }
        }
    });
    sessionManager.addSplitListener((_newUri, _partNumber, totalParts) => {
        viewerProvider.setSplitInfo(totalParts, totalParts);
        const filename = sessionManager.getActiveFilename();
        if (filename) {
            viewerProvider.setFilename(filename);
        }
        historyProvider.refresh();
    });
    viewerProvider.setMarkerHandler(() => {
        sessionManager.insertMarker();
    });
    viewerProvider.setLinkClickHandler((filePath, line, col, split) => {
        openSourceFile(filePath, line, col, split);
    });
    viewerProvider.setTogglePauseHandler(() => {
        const paused = sessionManager.togglePause();
        if (paused !== undefined) {
            viewerProvider.setPaused(paused);
        }
    });
    viewerProvider.setExclusionAddedHandler(async (pattern) => {
        const cfg = vscode.workspace.getConfiguration('saropaLogCapture');
        const current = cfg.get<string[]>('exclusions', []);
        if (!current.includes(pattern)) {
            await cfg.update('exclusions', [...current, pattern], vscode.ConfigurationTarget.Workspace);
        }
    });
    viewerProvider.setAnnotationPromptHandler(async (lineIndex, current) => {
        const text = await vscode.window.showInputBox({
            prompt: `Annotate line ${lineIndex + 1}`,
            value: current,
        });
        if (text === undefined) {
            return;
        }
        viewerProvider.setAnnotation(lineIndex, text);
        const logSession = sessionManager.getActiveSession();
        if (logSession) {
            const store = historyProvider.getMetaStore();
            await store.addAnnotation(logSession.fileUri, {
                lineIndex,
                text,
                timestamp: new Date().toISOString(),
            });
        }
    });
    viewerProvider.setSavePresetRequestHandler(async (filters) => {
        const preset = await promptSavePreset(filters as {
            categories?: string[];
            searchPattern?: string;
            exclusionsEnabled?: boolean;
        });
        if (preset) {
            // Refresh presets in the viewer
            viewerProvider.setPresets(loadPresets());
        }
    });
    viewerProvider.setSearchCodebaseHandler(async (text) => {
        // Open VS Code's built-in search with the text
        await vscode.commands.executeCommand('workbench.action.findInFiles', { query: text });
    });
    viewerProvider.setSearchSessionsHandler(async (text) => {
        const match = await showSearchQuickPick(text);
        if (match) {
            await openLogAtLine(match);
        }
    });
    viewerProvider.setAddToWatchHandler(async (text) => {
        const cfg = vscode.workspace.getConfiguration('saropaLogCapture');
        const current = cfg.get<{ pattern: string; alertType?: string }[]>('watchPatterns', []);
        // Check if pattern already exists
        if (current.some(p => p.pattern === text)) {
            vscode.window.showInformationMessage(`"${text}" is already in watch list.`);
            return;
        }
        await cfg.update('watchPatterns', [...current, { pattern: text }], vscode.ConfigurationTarget.Workspace);
        vscode.window.showInformationMessage(`Added "${text}" to watch list.`);
    });

    // DAP tracker for all debug adapters.
    context.subscriptions.push(
        vscode.debug.registerDebugAdapterTrackerFactory(
            '*',
            new SaropaTrackerFactory(sessionManager),
        ),
    );

    // Debug session lifecycle.
    context.subscriptions.push(
        vscode.debug.onDidStartDebugSession(async (session) => {
            viewerProvider.setPaused(false);
            await sessionManager.startSession(session, context);
            const activeSession = sessionManager.getActiveSession();
            const filename = sessionManager.getActiveFilename();
            if (filename) {
                viewerProvider.setFilename(filename);
            }
            // Initialize split info (part 1 of 1)
            viewerProvider.setSplitInfo(1, 1);
            const cfg = getConfig();
            if (cfg.exclusions.length > 0) {
                viewerProvider.setExclusions(cfg.exclusions);
            }
            if (cfg.showElapsedTime) {
                viewerProvider.setShowElapsed(true);
            }
            if (cfg.showDecorations) {
                viewerProvider.setShowDecorations(true);
            }
            // Initialize highlight rules from config
            if (cfg.highlightRules.length > 0) {
                viewerProvider.setHighlightRules(cfg.highlightRules);
            }
            // Initialize level filter and context view settings
            viewerProvider.setContextLines(cfg.filterContextLines);
            viewerProvider.setContextViewLines(cfg.contextViewLines);
            // Initialize filter presets
            viewerProvider.setPresets(loadPresets());
            historyProvider.setActiveUri(activeSession?.fileUri);
            historyProvider.refresh();
        }),
        vscode.debug.onDidTerminateDebugSession(async (session) => {
            await sessionManager.stopSession(session);
            historyProvider.setActiveUri(undefined);
            historyProvider.refresh();
            // Clear inline decorations when session ends
            inlineDecorations.clearAll();
        }),
    );

    // Commands.
    registerCommands(context);

    outputChannel.appendLine('Saropa Log Capture activated.');
}

function registerCommands(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
        vscode.commands.registerCommand('saropaLogCapture.start', () => {
            const active = vscode.debug.activeDebugSession;
            if (active && !sessionManager.hasSession(active.id)) {
                sessionManager.startSession(active, context);
            }
        }),

        vscode.commands.registerCommand('saropaLogCapture.stop', async () => {
            const active = vscode.debug.activeDebugSession;
            if (active) {
                await sessionManager.stopSession(active);
            }
        }),

        vscode.commands.registerCommand('saropaLogCapture.pause', () => {
            const paused = sessionManager.togglePause();
            if (paused !== undefined) {
                viewerProvider.setPaused(paused);
            }
        }),

        vscode.commands.registerCommand('saropaLogCapture.open', async () => {
            const logSession = sessionManager.getActiveSession();
            if (logSession) {
                await vscode.window.showTextDocument(logSession.fileUri);
            }
        }),

        vscode.commands.registerCommand('saropaLogCapture.openFolder', async () => {
            const folder = vscode.workspace.workspaceFolders?.[0];
            if (folder) {
                const logDir = getLogDirectoryUri(folder);
                await vscode.commands.executeCommand('revealFileInOS', logDir);
            }
        }),

        vscode.commands.registerCommand('saropaLogCapture.clear', () => {
            sessionManager.clearActiveSession();
        }),

        vscode.commands.registerCommand('saropaLogCapture.delete', async () => {
            await handleDeleteCommand();
        }),

        vscode.commands.registerCommand('saropaLogCapture.insertMarker', async () => {
            const text = await vscode.window.showInputBox({
                prompt: 'Marker text (leave empty for timestamp only)',
                placeHolder: 'e.g. before refactor, test attempt 2',
            });
            if (text === undefined) {
                return; // User pressed Escape.
            }
            sessionManager.insertMarker(text || undefined);
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

        vscode.commands.registerCommand('saropaLogCapture.refreshHistory', () => {
            historyProvider.refresh();
        }),

        vscode.commands.registerCommand('saropaLogCapture.openSession', async (item: { uri: vscode.Uri }) => {
            if (item?.uri) {
                await vscode.commands.executeCommand('saropaLogCapture.logViewer.focus');
                await viewerProvider.loadFromFile(item.uri);
            }
        }),

        vscode.commands.registerCommand('saropaLogCapture.deleteSession', async (item: { uri: vscode.Uri; filename: string }) => {
            if (!item?.uri) {
                return;
            }
            const answer = await vscode.window.showWarningMessage(
                `Delete ${item.filename}?`, { modal: true }, 'Delete',
            );
            if (answer === 'Delete') {
                await vscode.workspace.fs.delete(item.uri);
                historyProvider.refresh();
            }
        }),

        vscode.commands.registerCommand('saropaLogCapture.exportHtml', async (item: { uri: vscode.Uri }) => {
            if (!item?.uri) {
                return;
            }
            const htmlUri = await exportToHtml(item.uri);
            await vscode.env.openExternal(htmlUri);
        }),

        vscode.commands.registerCommand('saropaLogCapture.exportHtmlInteractive', async (item: { uri: vscode.Uri }) => {
            if (!item?.uri) {
                return;
            }
            const htmlUri = await exportToInteractiveHtml(item.uri);
            await vscode.env.openExternal(htmlUri);
        }),

        vscode.commands.registerCommand('saropaLogCapture.renameSession', async (item: { uri: vscode.Uri; filename: string }) => {
            if (!item?.uri) {
                return;
            }
            const name = await vscode.window.showInputBox({
                prompt: 'Enter new name for this session (also renames file)',
                value: item.filename.replace(/\.log$/, '').replace(/^\d{8}_\d{2}-\d{2}_/, ''),
            });
            if (name === undefined || name.trim() === '') {
                return;
            }
            // Rename the file on disk
            const metaStore = historyProvider.getMetaStore();
            const newUri = await metaStore.renameLogFile(item.uri, name.trim());
            // Update display name in metadata (uses new URI if renamed)
            await metaStore.setDisplayName(newUri, name.trim());
            historyProvider.refresh();
        }),

        vscode.commands.registerCommand('saropaLogCapture.tagSession', async (item: { uri: vscode.Uri }) => {
            if (!item?.uri) {
                return;
            }
            const meta = await historyProvider.getMetaStore().loadMetadata(item.uri);
            const current = (meta.tags ?? []).join(', ');
            const input = await vscode.window.showInputBox({
                prompt: 'Enter tags (comma-separated)',
                value: current,
            });
            if (input === undefined) {
                return;
            }
            const tags = input.split(',').map(t => t.trim()).filter(t => t.length > 0);
            await historyProvider.getMetaStore().setTags(item.uri, tags);
            historyProvider.refresh();
        }),

        vscode.commands.registerCommand('saropaLogCapture.searchLogs', async () => {
            const match = await showSearchQuickPick();
            if (match) {
                await openLogAtLine(match);
            }
        }),

        vscode.commands.registerCommand('saropaLogCapture.copyDeepLink', async (item: { uri: vscode.Uri; filename: string }) => {
            if (!item?.filename) {
                return;
            }
            await copyDeepLinkToClipboard(item.filename);
        }),

        vscode.commands.registerCommand('saropaLogCapture.applyPreset', async () => {
            const preset = await pickPreset();
            if (preset) {
                viewerProvider.applyPreset(preset.name);
            }
        }),

        vscode.commands.registerCommand('saropaLogCapture.savePreset', async () => {
            const preset = await promptSavePreset({});
            if (preset) {
                viewerProvider.setPresets(loadPresets());
            }
        }),

        vscode.commands.registerCommand('saropaLogCapture.toggleInlineDecorations', () => {
            const enabled = inlineDecorations.toggle();
            vscode.window.showInformationMessage(
                `Inline log decorations ${enabled ? 'enabled' : 'disabled'}`,
            );
        }),

        vscode.commands.registerCommand('saropaLogCapture.markForComparison', (item: { uri: vscode.Uri; filename: string }) => {
            if (!item?.uri) {
                return;
            }
            comparisonMarkUri = item.uri;
            vscode.window.showInformationMessage(`Marked "${item.filename}" for comparison. Select another session to compare.`);
        }),

        vscode.commands.registerCommand('saropaLogCapture.compareWithMarked', async (item: { uri: vscode.Uri; filename: string }) => {
            if (!item?.uri) {
                return;
            }
            if (!comparisonMarkUri) {
                vscode.window.showWarningMessage('No session marked for comparison. Right-click a session and select "Mark for Comparison" first.');
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
            // Quick pick to select two sessions
            const sessions = await pickTwoSessions();
            if (sessions) {
                const panel = getComparisonPanel(context.extensionUri);
                await panel.compare(sessions[0], sessions[1]);
            }
        }),

        vscode.commands.registerCommand('saropaLogCapture.applyTemplate', async () => {
            const template = await pickTemplate();
            if (template) {
                await applyTemplate(template);
                vscode.window.showInformationMessage(`Template "${template.name}" applied.`);
            }
        }),

        vscode.commands.registerCommand('saropaLogCapture.saveTemplate', async () => {
            await promptSaveTemplate();
        }),

        vscode.commands.registerCommand('saropaLogCapture.exportCsv', async (item: { uri: vscode.Uri }) => {
            if (!item?.uri) {
                return;
            }
            const csvUri = await exportToCsv(item.uri);
            const action = await vscode.window.showInformationMessage(
                `Exported to ${csvUri.fsPath.split(/[\\/]/).pop()}`,
                'Open',
            );
            if (action === 'Open') {
                await vscode.window.showTextDocument(csvUri);
            }
        }),

        vscode.commands.registerCommand('saropaLogCapture.exportJson', async (item: { uri: vscode.Uri }) => {
            if (!item?.uri) {
                return;
            }
            const jsonUri = await exportToJson(item.uri);
            const action = await vscode.window.showInformationMessage(
                `Exported to ${jsonUri.fsPath.split(/[\\/]/).pop()}`,
                'Open',
            );
            if (action === 'Open') {
                await vscode.window.showTextDocument(jsonUri);
            }
        }),

        vscode.commands.registerCommand('saropaLogCapture.exportJsonl', async (item: { uri: vscode.Uri }) => {
            if (!item?.uri) {
                return;
            }
            const jsonlUri = await exportToJsonl(item.uri);
            const action = await vscode.window.showInformationMessage(
                `Exported to ${jsonlUri.fsPath.split(/[\\/]/).pop()}`,
                'Open',
            );
            if (action === 'Open') {
                await vscode.window.showTextDocument(jsonlUri);
            }
        }),
    );
}

export function deactivate(): void {
    sessionManager?.stopAll();
    disposeComparisonPanel();
}

/**
 * Show Quick Pick to select two sessions for comparison.
 */
async function pickTwoSessions(): Promise<[vscode.Uri, vscode.Uri] | undefined> {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) {
        return undefined;
    }

    const logDir = getLogDirectoryUri(folder);
    let entries: [string, vscode.FileType][];
    try {
        entries = await vscode.workspace.fs.readDirectory(logDir);
    } catch {
        vscode.window.showWarningMessage('No log sessions found.');
        return undefined;
    }

    const logFiles = entries
        .filter(([name, type]) => type === vscode.FileType.File && name.endsWith('.log'))
        .map(([name]) => ({ label: name, uri: vscode.Uri.joinPath(logDir, name) }))
        .sort((a, b) => b.label.localeCompare(a.label));

    if (logFiles.length < 2) {
        vscode.window.showWarningMessage('Need at least 2 sessions to compare.');
        return undefined;
    }

    const first = await vscode.window.showQuickPick(logFiles, {
        placeHolder: 'Select FIRST session to compare',
        title: 'Compare Sessions (1/2)',
    });
    if (!first) {
        return undefined;
    }

    const remaining = logFiles.filter(f => f.uri.fsPath !== first.uri.fsPath);
    const second = await vscode.window.showQuickPick(remaining, {
        placeHolder: 'Select SECOND session to compare',
        title: 'Compare Sessions (2/2)',
    });
    if (!second) {
        return undefined;
    }

    return [first.uri, second.uri];
}

/** Open a source file at a specific line, optionally in a split editor. */
async function openSourceFile(filePath: string, line: number, col: number, split: boolean): Promise<void> {
    const uri = resolveSourceUri(filePath);
    if (!uri) {
        return;
    }
    const pos = new vscode.Position(Math.max(0, line - 1), Math.max(0, col - 1));
    const viewColumn = split ? vscode.ViewColumn.Beside : vscode.ViewColumn.Active;
    try {
        const doc = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(doc, { selection: new vscode.Range(pos, pos), viewColumn });
    } catch {
        // File may not exist on disk — ignore silently.
    }
}


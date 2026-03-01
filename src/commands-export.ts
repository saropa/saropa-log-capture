/** Export-related commands (HTML, CSV, JSON, SLC). */

import * as vscode from 'vscode';
import type { CommandDeps } from './commands-deps';
import { exportToHtml } from './modules/export/html-export';
import { exportToInteractiveHtml } from './modules/export/html-export-interactive';
import { exportToCsv, exportToJson, exportToJsonl } from './modules/export/export-formats';
import { exportSessionToSlc, importSlcBundle } from './modules/export/slc-bundle';

export function exportCommands(deps: CommandDeps): vscode.Disposable[] {
    const { viewerProvider, historyProvider } = deps;
    return [
        htmlExportCmd('exportHtml', exportToHtml),
        htmlExportCmd('exportHtmlInteractive', exportToInteractiveHtml),
        fileExportCmd('exportCsv', exportToCsv),
        fileExportCmd('exportJson', exportToJson),
        fileExportCmd('exportJsonl', exportToJsonl),
        vscode.commands.registerCommand('saropaLogCapture.exportSlc',
            async (item: { uri: vscode.Uri } | undefined) => {
                const uri = item?.uri ?? viewerProvider.getCurrentFileUri();
                if (!uri) {
                    void vscode.window.showWarningMessage(vscode.l10n.t('msg.openLogFirst', 'Open a log file first.'));
                    return;
                }
                const outUri = await vscode.window.withProgress(
                    { location: vscode.ProgressLocation.Notification, title: vscode.l10n.t('progress.exportSlc') },
                    () => exportSessionToSlc(uri),
                );
                if (outUri) {
                    const action = await vscode.window.showInformationMessage(
                        vscode.l10n.t('msg.exportedTo', outUri.fsPath.split(/[\\/]/).pop() ?? ''),
                        vscode.l10n.t('action.open'),
                    );
                    if (action === vscode.l10n.t('action.open')) { await vscode.window.showTextDocument(outUri); }
                }
            }),
        vscode.commands.registerCommand('saropaLogCapture.importSlc', async () => {
            const uris = await vscode.window.showOpenDialog({
                filters: { [vscode.l10n.t('filter.slcBundles')]: ['slc'] },
                canSelectMany: true,
                title: vscode.l10n.t('title.importSlc', 'Import .slc session bundle(s)'),
            });
            if (!uris?.length) { return; }
            let lastResult: { mainLogUri: vscode.Uri } | undefined;
            await vscode.window.withProgress(
                { location: vscode.ProgressLocation.Notification, title: vscode.l10n.t('progress.importSlc') },
                async () => {
                    for (const uri of uris) {
                        const result = await importSlcBundle(uri);
                        if (result) { lastResult = result; }
                    }
                },
            );
            if (lastResult) {
                historyProvider.refresh();
                await vscode.commands.executeCommand('saropaLogCapture.logViewer.focus');
                await viewerProvider.loadFromFile(lastResult.mainLogUri);
            }
        }),
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

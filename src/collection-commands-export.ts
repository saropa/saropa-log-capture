/**
 * Investigation export command: export active investigation to .slc file.
 */

import * as vscode from 'vscode';
import { t } from './l10n';
import { exportInvestigationToSlc } from './modules/export/slc-bundle';
import type { InvestigationStore } from './modules/investigation/investigation-store';

export function registerExportInvestigationCommand(investigationStore: InvestigationStore): vscode.Disposable {
    return vscode.commands.registerCommand('saropaLogCapture.exportInvestigation', async () => {
        const investigation = await investigationStore.getActiveInvestigation();
        if (!investigation) {
            vscode.window.showWarningMessage(t('msg.noActiveInvestigation'));
            return;
        }

        if (investigation.sources.length === 0) {
            vscode.window.showWarningMessage(t('msg.noSourcesInInvestigation'));
            return;
        }

        const folder = vscode.workspace.workspaceFolders?.[0];
        if (!folder) {
            vscode.window.showWarningMessage(t('msg.slcImportNoWorkspace'));
            return;
        }

        try {
            const outUri = await vscode.window.withProgress(
                { location: vscode.ProgressLocation.Notification, title: t('progress.exportInvestigation') },
                () => exportInvestigationToSlc(investigation, folder.uri),
            );
            if (outUri) {
                const action = await vscode.window.showInformationMessage(
                    t('msg.exportedTo', outUri.fsPath.split(/[\\/]/).pop() ?? ''),
                    t('action.open'),
                );
                if (action === t('action.open')) {
                    await vscode.window.showTextDocument(outUri);
                }
            }
        } catch (e) {
            vscode.window.showErrorMessage(e instanceof Error ? e.message : String(e));
        }
    });
}

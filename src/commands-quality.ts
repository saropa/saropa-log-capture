/**
 * Command registration for code quality: Show code quality for frame (palette hint),
 * Open quality report (opens the .quality.json sidecar for the current log).
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { t } from './l10n';

/** Dependencies for quality commands. */
export interface QualityCommandDeps {
    readonly getFileUri: () => vscode.Uri | undefined;
}

/** Register code quality commands. */
export function qualityCommands(deps: QualityCommandDeps): vscode.Disposable[] {
    return [
        vscode.commands.registerCommand('saropaLogCapture.showCodeQualityForFrame', () => {
            vscode.window.showInformationMessage(
                t('msg.rightClickShowCodeQuality'),
            );
        }),
        vscode.commands.registerCommand('saropaLogCapture.openQualityReport', () => {
            const fileUri = deps.getFileUri();
            if (!fileUri) {
                vscode.window.showInformationMessage(t('msg.noActiveSession'));
                return;
            }
            const logDir = path.dirname(fileUri.fsPath);
            const baseFileName = path.basename(fileUri.fsPath);
            const qualityPath = path.join(logDir, `${baseFileName}.quality.json`);
            const qualityUri = vscode.Uri.file(qualityPath);
            vscode.workspace.fs.stat(qualityUri).then(
                () => {
                    vscode.window.showTextDocument(qualityUri, { preview: false });
                },
                () => {
                    vscode.window.showInformationMessage(
                        t('msg.noQualityReportFound'),
                    );
                },
            );
        }),
    ];
}

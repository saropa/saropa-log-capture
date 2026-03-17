/**
 * Extension-side handlers for error action bar messages in the analysis panel.
 *
 * Routes user actions (triage toggle, export, bug report, AI explain)
 * to existing infrastructure.
 */

import * as vscode from 'vscode';
import { setErrorStatus, type ErrorStatus } from '../../modules/misc/error-status-store';

/** Handle triage status toggle from the analysis panel. */
export async function handleTriageToggle(
    hash: string, status: string,
): Promise<void> {
    const validStatuses: ErrorStatus[] = ['open', 'closed', 'muted'];
    const s = validStatuses.includes(status as ErrorStatus) ? status as ErrorStatus : 'open';
    await setErrorStatus(hash, s);
}

/** Copy error context to clipboard. */
export async function handleCopyContext(
    errorText: string, hash: string,
): Promise<void> {
    const context = [
        `Error: ${errorText}`,
        `Fingerprint: #${hash}`,
        `Date: ${new Date().toISOString()}`,
    ].join('\n');
    await vscode.env.clipboard.writeText(context);
    vscode.window.showInformationMessage('Error context copied to clipboard');
}

/** Trigger bug report generation via existing command. */
export async function handleBugReport(
    errorText: string, lineIndex: number, fileUri: vscode.Uri | undefined,
    extensionContext?: vscode.ExtensionContext,
): Promise<void> {
    if (!fileUri) {
        vscode.window.showWarningMessage('No log file available for bug report');
        return;
    }
    const { showBugReport } = await import('../panels/bug-report-panel.js');
    await showBugReport(errorText, lineIndex, fileUri, extensionContext);
}

/** Trigger export via existing commands. */
export function handleExportAction(format: string): void {
    const commandMap: Record<string, string> = {
        slc: 'saropaLogCapture.exportSlc',
        json: 'saropaLogCapture.exportJson',
        csv: 'saropaLogCapture.exportCsv',
    };
    const cmd = commandMap[format];
    if (cmd) { vscode.commands.executeCommand(cmd).then(undefined, () => {}); }
}

/** Trigger AI explanation via existing command. */
export function handleAiExplain(errorText: string): void {
    vscode.commands.executeCommand('saropaLogCapture.explainError', errorText).then(undefined, () => {
        vscode.window.showWarningMessage('AI explanation is not available');
    });
}

/**
 * Extension-side handlers for error action bar messages in the analysis panel.
 *
 * Routes user actions (triage toggle, export, bug report, AI explain)
 * to existing infrastructure.
 */

import * as vscode from 'vscode';
import { t } from '../../l10n';
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
    vscode.window.showInformationMessage(t('viewer.analysis.errorContextCopied'));
}

/** Trigger bug report generation via existing command. */
export async function handleBugReport(
    errorText: string, lineIndex: number, fileUri: vscode.Uri | undefined,
    extensionContext?: vscode.ExtensionContext,
): Promise<void> {
    if (!fileUri) {
        vscode.window.showWarningMessage(t('viewer.analysis.noLogForBugReport'));
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

// handleAiExplain() removed (bug_005): it called executeCommand on
// 'saropaLogCapture.explainError', a command that was never registered with
// vscode.commands.registerCommand anywhere in the extension, so every call
// failed silently and the UI always reported "AI unavailable". The caller
// (the "Explain with AI" button in analysis-error-render.ts) was removed at
// the same time. Reintroduce both together once a real command handler
// exists — see `src/modules/ai/ai-context-builder.ts` for the groundwork.

/** Command registration for the Session Flow Map report (plan 056, S1). */

import * as vscode from 'vscode';
import { t } from './l10n';
import { parseLog } from './modules/flow-map/flow-map-log-parser';
import { buildGraph } from './modules/flow-map/flow-map-builder';
import { buildReport } from './modules/flow-map/flow-map-report';
import { scanProjectScreens } from './modules/flow-map/flow-map-source-scan';

/** Callbacks the flow-map command needs. */
export interface FlowMapCommandDeps {
    readonly getFileUri: () => vscode.Uri | undefined;
}

/** Default output URI: `<log-basename>-flow-map.md` next to the source log. */
function defaultReportUri(logUri: vscode.Uri): vscode.Uri {
    const dir = vscode.Uri.joinPath(logUri, '..');
    const base = (logUri.path.split('/').pop() ?? 'session').replace(/\.[^.]+$/, '');
    return vscode.Uri.joinPath(dir, `${base}-flow-map.md`);
}

/** Read the log, build the report markdown. Separated so it is easy to test/observe in isolation. */
async function generateReportMarkdown(logUri: vscode.Uri): Promise<string> {
    const bytes = await vscode.workspace.fs.readFile(logUri);
    const lines = Buffer.from(bytes).toString('utf-8').split(/\r?\n/);
    const parsed = parseLog(lines);
    // Source 3 — non-fatal; empty index yields a runtime-only map.
    const scan = await scanProjectScreens(parsed.header.projectRoot);
    const graph = buildGraph(parsed, scan);
    return buildReport(parsed, graph);
}

/** Register the export-flow-map command. */
export function flowMapCommands(deps: FlowMapCommandDeps): vscode.Disposable[] {
    return [
        vscode.commands.registerCommand('saropaLogCapture.exportFlowMap', () => runExport(deps)),
    ];
}

/** Generate the report, prompt for a save location, write it, and offer to open it. */
async function runExport(deps: FlowMapCommandDeps): Promise<void> {
    const logUri = deps.getFileUri();
    if (!logUri) {
        void vscode.window.showInformationMessage(t('msg.noActiveSession'));
        return;
    }
    try {
        const markdown = await vscode.window.withProgress(
            { location: vscode.ProgressLocation.Notification, title: t('flowMap.progress') },
            () => generateReportMarkdown(logUri),
        );
        const target = await vscode.window.showSaveDialog({
            defaultUri: defaultReportUri(logUri),
            filters: { Markdown: ['md'] },
            title: t('flowMap.saveTitle'),
        });
        if (!target) {
            return;
        }
        await vscode.workspace.fs.writeFile(target, Buffer.from(markdown, 'utf-8'));
        const open = await vscode.window.showInformationMessage(
            t('msg.exportedTo', target.fsPath.split(/[\\/]/).pop() ?? ''),
            t('action.open'),
        );
        if (open === t('action.open')) {
            await vscode.window.showTextDocument(target);
        }
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        void vscode.window.showWarningMessage(t('flowMap.failed', msg));
    }
}

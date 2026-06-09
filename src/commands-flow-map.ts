/** Command registration for the Session Flow Map report (plan 056, S1). */

import * as vscode from 'vscode';
import { t } from './l10n';
import { parseLog } from './modules/flow-map/flow-map-log-parser';
import { buildGraph } from './modules/flow-map/flow-map-builder';
import { buildReport } from './modules/flow-map/flow-map-report';
import { scanProjectScreens } from './modules/flow-map/flow-map-source-scan';
import { showFlowMapPanel, type FlowMapPanelParams } from './ui/panels/flow-map-panel';

/** Callbacks the flow-map command needs. */
export interface FlowMapCommandDeps {
    readonly getFileUri: () => vscode.Uri | undefined;
    /** Scroll the open log viewer to a 1-based line (used by the report's log links). */
    readonly revealLine: (line: number) => void;
}

/** Default save URI: `<log-basename>-flow-map.md` next to the source log. */
function defaultReportUri(logUri: vscode.Uri): vscode.Uri {
    const dir = vscode.Uri.joinPath(logUri, '..');
    const base = (logUri.path.split('/').pop() ?? 'session').replace(/\.[^.]+$/, '');
    return vscode.Uri.joinPath(dir, `${base}-flow-map.md`);
}

/** The report params minus `refresh` (the command supplies the refresh closure). */
type ReportData = Omit<FlowMapPanelParams, 'refresh'>;

/** Read the log and build the report model + markdown. Separated for isolated testing/observation. */
async function generateReport(logUri: vscode.Uri, revealLine: (line: number) => void): Promise<ReportData> {
    const bytes = await vscode.workspace.fs.readFile(logUri);
    const lines = Buffer.from(bytes).toString('utf-8').split(/\r?\n/);
    const parsed = parseLog(lines);
    // Source 3 — non-fatal; empty index yields a runtime-only map.
    const scan = await scanProjectScreens(parsed.header.projectRoot);
    const graph = buildGraph(parsed, scan);
    return {
        parsed, graph,
        markdown: buildReport(parsed, graph),
        defaultUri: defaultReportUri(logUri),
        logUri,
        revealLine,
    };
}

/** Register the export-flow-map command. */
export function flowMapCommands(deps: FlowMapCommandDeps): vscode.Disposable[] {
    return [
        vscode.commands.registerCommand('saropaLogCapture.exportFlowMap', () => runExport(deps)),
    ];
}

/** Build the report and open it in the native flow-map webview (Save-as-Markdown lives there). */
async function runExport(deps: FlowMapCommandDeps): Promise<void> {
    const logUri = deps.getFileUri();
    if (!logUri) {
        void vscode.window.showInformationMessage(t('msg.noActiveSession'));
        return;
    }
    // `render` re-reads the log each call, so the Refresh button picks up new content; it passes
    // itself as the panel's `refresh` callback.
    const render = async (): Promise<void> => {
        try {
            const report = await vscode.window.withProgress(
                { location: vscode.ProgressLocation.Notification, title: t('flowMap.progress') },
                () => generateReport(logUri, deps.revealLine),
            );
            showFlowMapPanel({ ...report, refresh: () => { void render(); } });
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            void vscode.window.showWarningMessage(t('flowMap.failed', msg));
        }
    };
    await render();
}

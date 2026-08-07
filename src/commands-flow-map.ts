/** Command registration for the Session Flow Map report (plan 056, S1). */

import * as vscode from 'vscode';
import { t } from './l10n';
import { parseLog } from './modules/flow-map/flow-map-log-parser';
import { compileCustomPatterns } from './modules/flow-map/flow-map-custom-patterns';
import { buildGraph } from './modules/flow-map/flow-map-builder';
import { buildReport } from './modules/flow-map/flow-map-report';
import { scanProjectScreens } from './modules/flow-map/flow-map-source-scan';
import { showFlowMapPanel, type FlowMapPanelParams } from './ui/panels/flow-map-panel';
import { readScreenshotSidecar, screenshotDirUri } from './modules/screenshot/screenshot-store';
import { joinShotsToScreens, shotBudgetVerdict, type ShotWithDataUri } from './modules/flow-map/flow-map-screenshots';
import { suggestBreadcrumbPatterns } from './modules/flow-map/flow-map-empty-diagnostic';

/** Bound how many screenshots the webview embeds as data URIs — keeps panel HTML weight sane. */
const MAX_REPORT_SHOTS = 12;

/**
 * Second, independent bound: total base64 bytes the report may embed. The count cap alone assumes a
 * capture's size, and a device screenshotting at 3x can be an order of magnitude larger than the one
 * that cap was chosen against. Panel HTML is parsed synchronously by the webview, so weight here buys
 * a frozen panel, not a slow one — and nothing else measures it (`verify:dist-size` watches the
 * BUNDLE, not generated HTML). A captured screen's shown shot is embedded twice in the report (card
 * thumbnail + gallery figure), so the effective document weight is up to ~2x this number — a bound
 * that holds because no single capture may exceed the budget either (see `shotBudgetVerdict`).
 */
const MAX_REPORT_SHOT_BYTES = 6 * 1024 * 1024;

/** The viewer surface the flow map drives to reveal log lines. */
export interface FlowMapViewer {
    loadFromFile(uri: vscode.Uri): Promise<void>;
    scrollToLine(line: number): void;
    getCurrentFileUri(): vscode.Uri | undefined;
}

/** Callbacks the flow-map command needs. */
export interface FlowMapCommandDeps {
    readonly getFileUri: () => vscode.Uri | undefined;
    /** The log viewer — used to load the report's source log before scrolling to a line. */
    readonly viewer: FlowMapViewer;
}

/** Default save URI: `<log-basename>-flow-map.md` next to the source log. */
function defaultReportUri(logUri: vscode.Uri): vscode.Uri {
    const dir = vscode.Uri.joinPath(logUri, '..');
    const base = (logUri.path.split('/').pop() ?? 'session').replace(/\.[^.]+$/, '');
    return vscode.Uri.joinPath(dir, `${base}-flow-map.md`);
}

/** The report params minus `refresh` (the command supplies the refresh closure). */
type ReportData = Omit<FlowMapPanelParams, 'refresh'>;

/** Read one screenshot PNG and encode it as a data URI; undefined when the file is unreadable. */
async function readShotDataUri(logFsPath: string, file: string): Promise<string | undefined> {
    try {
        const uri = vscode.Uri.joinPath(screenshotDirUri(logFsPath), file);
        const bytes = await vscode.workspace.fs.readFile(uri);
        return `data:image/png;base64,${Buffer.from(bytes).toString('base64')}`;
    } catch {
        // Non-fatal — a moved/deleted PNG just drops out of the gallery instead of failing the report.
        return undefined;
    }
}

/**
 * Load sidecar screenshots as data URIs and join them to the screen active at capture time. Stops at
 * whichever bound hits first — `MAX_REPORT_SHOTS` captures or `MAX_REPORT_SHOT_BYTES` of base64 — and
 * reports every entry it did not embed as `omitted`, so the gallery's "+N more" note stays truthful
 * however the budget was spent. Unreadable PNGs are skipped without consuming budget.
 */
async function loadFlowShots(logFsPath: string): Promise<{ shots: ShotWithDataUri[]; omitted: number }> {
    const entries = await readScreenshotSidecar(logFsPath);
    const capped = entries.slice(0, MAX_REPORT_SHOTS);
    const withUris: ShotWithDataUri[] = [];
    let bytes = 0;
    for (const entry of capped) {
        const dataUri = await readShotDataUri(logFsPath, entry.file);
        if (!dataUri) { continue; }
        // Checked BEFORE pushing, so the budget is a ceiling on what ships rather than one the last
        // capture is allowed to blow through. See `shotBudgetVerdict` for why skip and stop differ.
        const verdict = shotBudgetVerdict(dataUri.length, bytes, MAX_REPORT_SHOT_BYTES);
        if (verdict === 'stop') { break; }
        if (verdict === 'skip') { continue; }
        bytes += dataUri.length;
        withUris.push({ ...entry, dataUri });
    }
    return { shots: withUris, omitted: Math.max(0, entries.length - withUris.length) };
}

/** Read the log and build the report model + markdown. Separated for isolated testing/observation. */
async function generateReport(logUri: vscode.Uri, revealLine: (line: number) => void): Promise<ReportData> {
    const bytes = await vscode.workspace.fs.readFile(logUri);
    const lines = Buffer.from(bytes).toString('utf-8').split(/\r?\n/);
    // Read fresh per call (not cached) so a settings change is picked up by the Refresh button
    // without reloading the panel — same fresh-read rule the rest of the config surface follows.
    const cfg = vscode.workspace.getConfiguration('saropaLogCapture');
    const custom = compileCustomPatterns(
        cfg.get('flowMap.customBreadcrumbs'),
        cfg.get('flowMap.customIssues'),
    );
    const parsed = parseLog(lines, undefined, custom);
    // Source 3 — non-fatal; empty index yields a runtime-only map.
    const scan = await scanProjectScreens(parsed.header.projectRoot);
    const graph = buildGraph(parsed, scan);
    const { shots, omitted } = await loadFlowShots(logUri.fsPath);
    // Only worth computing when the diagram is empty — a populated graph already has its own story,
    // and running the heuristic against a huge log is otherwise wasted work.
    const suggestions = graph.nodes.length === 0 ? suggestBreadcrumbPatterns(lines) : [];
    return {
        parsed, graph,
        markdown: buildReport(parsed, graph),
        defaultUri: defaultReportUri(logUri),
        logUri,
        revealLine,
        screenshots: joinShotsToScreens(shots, parsed.events),
        screenshotsOmitted: omitted,
        suggestions,
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
    // Reveal a log line, first loading the report's source log into the viewer if a different log
    // (or none) is currently shown — otherwise scrollToLine would scroll the wrong content (#5).
    const revealLine = async (line: number): Promise<void> => {
        if (deps.viewer.getCurrentFileUri()?.toString() !== logUri.toString()) {
            await deps.viewer.loadFromFile(logUri);
        }
        deps.viewer.scrollToLine(line);
    };
    // `render` re-reads the log each call, so the Refresh button picks up new content; it passes
    // itself as the panel's `refresh` callback.
    const render = async (): Promise<void> => {
        try {
            const report = await vscode.window.withProgress(
                { location: vscode.ProgressLocation.Notification, title: t('flowMap.progress') },
                () => generateReport(logUri, revealLine),
            );
            showFlowMapPanel({ ...report, refresh: () => { void render(); } });
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            void vscode.window.showWarningMessage(t('flowMap.failed', msg));
        }
    };
    await render();
}

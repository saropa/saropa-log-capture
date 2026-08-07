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
import { joinShotsToScreens, type ShotWithSource } from './modules/flow-map/flow-map-screenshots';
import { suggestBreadcrumbPatterns } from './modules/flow-map/flow-map-empty-diagnostic';
import { findCompareSessions } from './modules/flow-map/flow-map-cross-session';

/**
 * Bound how many screenshots the report renders. Captures are referenced by URL rather than embedded,
 * so this is a readability cap on the gallery, not a weight cap on the document — a hundred figures
 * is noise no reader scrolls through. The byte budget the data-URI era needed is gone with it.
 */
const MAX_REPORT_SHOTS = 12;

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

/**
 * PNG filenames the store generates (`NNN_trigger_epochms.png`) — anything else is refused. The
 * sidecar is a file on disk that a user can edit, and `Uri.joinPath` would happily walk `../../` out
 * of the capture directory, handing the panel a path outside the one root its CSP opens.
 * Deliberately duplicates the viewer's own `SAFE_FILE`: two independent read paths, each of which
 * must refuse traversal on its own rather than trusting the other to have done it.
 */
const SAFE_SHOT_FILE = /^[\w-]+\.png$/;

/**
 * Locate one capture on disk, or undefined when the PNG is gone. `stat` rather than `readFile`: the
 * panel only needs a URL, and a missing capture must drop out quietly instead of rendering a
 * broken-image box the reader cannot act on. Both forms travel on: `src` is what the sandbox fetches
 * (after the panel rewrites it), `path` is what the reader copies.
 */
async function resolveShotFile(
    logFsPath: string, file: string,
): Promise<{ src: string; path: string } | undefined> {
    if (!SAFE_SHOT_FILE.test(file)) { return undefined; }
    const uri = vscode.Uri.joinPath(screenshotDirUri(logFsPath), file);
    try {
        await vscode.workspace.fs.stat(uri);
        return { src: uri.toString(), path: uri.fsPath };
    } catch {
        // Non-fatal — a moved/deleted PNG just drops out of the gallery instead of failing the report.
        return undefined;
    }
}

/**
 * Resolve sidecar screenshots to `file:` URIs and join them to the screen active at capture time.
 * Every entry beyond `MAX_REPORT_SHOTS`, plus any whose PNG has vanished, is counted as `omitted` so
 * the gallery's "+N more" note stays truthful.
 *
 * The panel rewrites each `src` to a webview URI before render — see `FlowShot.src`.
 */
async function loadFlowShots(logFsPath: string): Promise<{ shots: ShotWithSource[]; omitted: number }> {
    const entries = await readScreenshotSidecar(logFsPath);
    const capped = entries.slice(0, MAX_REPORT_SHOTS);
    const withUris: ShotWithSource[] = [];
    for (const entry of capped) {
        const found = await resolveShotFile(logFsPath, entry.file);
        if (!found) { continue; }
        withUris.push({ ...entry, ...found });
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
    // Cheap: a directory read plus one stat per candidate. Resolving a session's captures is the
    // expensive half and only happens if the reader actually picks one.
    const sessions = shots.length > 0 ? await findCompareSessions(logUri) : [];
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
        // Always passed, even with no captures: the panel is reused across refreshes, so its resource
        // roots must follow the log currently shown rather than whichever log first had screenshots.
        // Comparable sessions' directories are opened up front because a webview cannot be granted a
        // new root mid-render — the picker only offers sessions whose captures are already loadable.
        shotRoots: [screenshotDirUri(logUri.fsPath), ...sessions.map(s => screenshotDirUri(s.logFsPath))],
        compareSessions: sessions,
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

/**
 * Signal report webview panel — shows a rich diagnostic report for a single signal.
 *
 * Each click opens a NEW tab so previous reports stay accessible.
 * Progressive section rendering via postMessage.
 */

import * as vscode from 'vscode';
import type { RootCauseHypothesis, RootCauseHintBundle } from '../../modules/root-cause-hints/root-cause-hint-types';
import { getNonce } from '../provider/viewer-content';
import {
  buildSignalReportShell,
  renderEvidenceSection,
  renderRecommendations,
  type EvidenceGroup,
} from './signal-report-render';
import { describeTimelinePosition, findPrecedingAction, parseSessionHeader } from './signal-report-context';
import { buildRelatedHtml } from './signal-report-related';
import { buildOverviewHtml, buildOtherSignalsHtml } from './signal-report-overview';
import { buildDetailsHtml } from './signal-report-details';
import { buildFullMarkdownReport } from './signal-report-markdown';
import { getLogDirectoryUri } from '../../modules/config/config';
import { logExtensionError } from '../../modules/misc/extension-logger';
import { loadSignalHistory, loadLastCleanSessionUri } from './signal-report-history-loader';
import { buildHistoryHtml } from './signal-report-history';
import { buildEcosystemHtml } from './signal-report-ecosystem';

/** Per-panel state for save/copy actions. Includes bundle for full markdown export. */
interface PanelState {
  readonly hypothesis: RootCauseHypothesis;
  readonly bundle: RootCauseHintBundle;
  readonly fileUri: vscode.Uri | undefined;
}

/** All open signal report panels, so they can be disposed on deactivation. */
const openPanels = new Set<vscode.WebviewPanel>();

/**
 * Show a signal report for the given hypothesis.
 * Each call opens a new tab so previous reports remain accessible.
 */
export async function showSignalReport(
  hypothesis: RootCauseHypothesis,
  bundle: RootCauseHintBundle,
  fileUri: vscode.Uri | undefined,
): Promise<void> {
  const state: PanelState = { hypothesis, bundle, fileUri };
  const panel = createPanel(hypothesis);
  panel.webview.onDidReceiveMessage(
    (msg) => handleMessage(msg, state),
  );
  panel.webview.html = buildSignalReportShell({
    nonce: getNonce(),
    hypothesis,
  });
  await populateSections(panel, state);
}

/** Build a short panel title from the hypothesis template ID. */
function panelTitle(hypothesis: RootCauseHypothesis): string {
  return `Signal: ${hypothesis.templateId}`;
}

function createPanel(hypothesis: RootCauseHypothesis): vscode.WebviewPanel {
  const panel = vscode.window.createWebviewPanel(
    'saropaLogCapture.signalReport',
    panelTitle(hypothesis),
    vscode.ViewColumn.Beside,
    { enableScripts: true, localResourceRoots: [] },
  );
  openPanels.add(panel);
  panel.onDidDispose(() => { openPanels.delete(panel); });
  return panel;
}

/** Populate all report sections — reads the log file once and shares across all builders. */
async function populateSections(
  panel: vscode.WebviewPanel,
  state: PanelState,
): Promise<void> {
  const { hypothesis, bundle, fileUri } = state;
  const logLines = fileUri ? await readLogLines(fileUri) : [];

  // 1. Session overview — aggregate stats, timing, outcome, all errors
  const overviewHtml = buildOverviewHtml({
    bundle,
    logLineCount: logLines.length,
    logFilePath: fileUri?.fsPath,
    logLines,
  });
  postSection(panel, 'overview', 'Session Overview', overviewHtml);

  // 2. Evidence — target lines with 10 lines of context and stack trace extension
  const evidenceHtml = buildEvidenceHtml(hypothesis, logLines);
  postSection(panel, 'evidence', 'Evidence', evidenceHtml);

  // 3. Signal-type-specific details (N+1, SQL burst, ANR, distribution analysis)
  const detailsHtml = buildDetailsHtml(hypothesis, bundle);
  const detailsFallback = '<div class="no-data">No additional details for this signal type</div>';
  postSection(panel, 'details', 'Signal Details', detailsHtml || detailsFallback);

  // 4. Related lines — all matching items with excerpts and line numbers
  const relatedHtml = buildRelatedHtml(hypothesis, bundle, logLines);
  postSection(panel, 'related', 'Related Lines', relatedHtml);

  // 5. Other signals detected in the same session
  const otherHtml = buildOtherSignalsHtml(hypothesis, bundle);
  postSection(panel, 'other-signals', 'Other Signals', otherHtml);

  // 6. Recommendations — template-based advice, category-tailored for error-recent
  const firstErrorCat = bundle.errors?.find(e => e?.category)?.category;
  const recsHtml = renderRecommendations(hypothesis.templateId, firstErrorCat);
  postSection(panel, 'recommendations', 'Recommendations', recsHtml);

  // 7. Companion extensions — Drift Advisor + Saropa Lints status / install prompts
  const ecosystemHtml = buildEcosystemHtml(bundle);
  postSection(panel, 'ecosystem', 'Companion Extensions', ecosystemHtml);

  // 8. Cross-session history + "what changed" diff
  const history = await loadSignalHistory(hypothesis.templateId);
  const currentHeader = logLines.length > 0 ? parseSessionHeader(logLines) : undefined;
  // Read the last clean session header for comparison
  let cleanHeader: ReturnType<typeof parseSessionHeader> | undefined;
  const cleanUri = await loadLastCleanSessionUri(hypothesis.templateId);
  if (cleanUri) {
    const cleanLines = await readLogLines(cleanUri);
    if (cleanLines.length > 0) { cleanHeader = parseSessionHeader(cleanLines); }
  }
  const historyHtml = buildHistoryHtml({
    sessions: history.sessions,
    totalSessionCount: history.totalSessionCount,
    currentHeader,
    cleanHeader,
  });
  postSection(panel, 'history', 'Cross-Session History', historyHtml);
}

/**
 * Build evidence HTML from hypothesis line indices and pre-read log lines.
 * Shows 10 lines of preceding context and extends past stack trace frames.
 */
function buildEvidenceHtml(
  hypothesis: RootCauseHypothesis,
  logLines: readonly string[],
): string {
  const ids = hypothesis.evidenceLineIds;
  if (ids.length === 0) {
    return '<div class="no-data">No evidence lines to display</div>';
  }
  if (logLines.length === 0) {
    // Log file unreadable — still show which lines were referenced
    const idList = ids.map(i => `Line ${i + 1}`).join(', ');
    return `<div class="no-data">Could not read log file. Evidence at: ${idList}</div>`;
  }
  const contextRadius = 10;
  const maxStackExtend = 30;
  const groups: EvidenceGroup[] = [];
  for (const targetIdx of ids) {
    if (targetIdx < 0 || targetIdx >= logLines.length) { continue; }
    const start = Math.max(0, targetIdx - contextRadius);
    let end = Math.min(logLines.length - 1, targetIdx + contextRadius);
    // Extend past stack trace frames that follow the target line — captures the
    // full trace even when it exceeds the normal context radius.
    while (end < logLines.length - 1 && end < targetIdx + maxStackExtend) {
      if (!isStackTraceLine(logLines[end + 1])) { break; }
      end++;
    }
    const lines: { lineIndex: number; text: string; isTarget: boolean }[] = [];
    for (let i = start; i <= end; i++) {
      lines.push({ lineIndex: i, text: logLines[i], isTarget: i === targetIdx });
    }
    // Timeline position and preceding action metadata
    const action = findPrecedingAction(logLines, targetIdx);
    groups.push({
      lines,
      meta: {
        timelinePosition: describeTimelinePosition(targetIdx, logLines.length),
        precedingAction: action,
      },
    });
  }
  if (groups.length === 0) {
    // All indices were out of range — the log file may have been modified since signals ran
    const idList = ids.map(i => `Line ${i + 1}`).join(', ');
    return `<div class="no-data">Evidence lines out of range (file may have changed). Referenced: ${idList}</div>`;
  }
  return renderEvidenceSection(groups);
}

/** Check if a line looks like a stack trace frame (Dart, Java, or generic). */
function isStackTraceLine(line: string): boolean {
  const t = line.trimStart();
  // Dart/Flutter: #0  main (package:app/main.dart:42)
  if (/^#\d+\s/.test(t)) { return true; }
  // Java/Kotlin: at com.example.Class.method(File.java:42)
  if (/^at\s+\S/.test(t)) { return true; }
  // Indented continuation common in stack traces (tab + method reference)
  if (line.startsWith('\t') && /\.\w+\(/.test(line)) { return true; }
  return false;
}

/** Read all lines from a log file URI. */
async function readLogLines(fileUri: vscode.Uri): Promise<string[]> {
  try {
    const raw = await vscode.workspace.fs.readFile(fileUri);
    return Buffer.from(raw).toString('utf-8').split('\n');
  } catch {
    return [];
  }
}

function postSection(panel: vscode.WebviewPanel, id: string, title: string, html: string): void {
  panel.webview.postMessage({ type: 'sectionReady', id, title, html });
}

function handleMessage(msg: Record<string, unknown>, state: PanelState): void {
  if (msg.type === 'copyReport') { copyReport(state); }
  if (msg.type === 'saveReport') { saveReport(state); }
  if (msg.type === 'openSessionFromHistory') {
    const uri = msg.uriString as string;
    if (uri) { vscode.commands.executeCommand('saropaLogCapture.openLog', vscode.Uri.parse(uri)); }
  }
  if (msg.type === 'openUrl') {
    const url = msg.url as string;
    // Only allow marketplace URLs from ecosystem install links
    if (url && url.startsWith('https://marketplace.visualstudio.com/')) {
      vscode.env.openExternal(vscode.Uri.parse(url)).then(undefined, () => {});
    }
  }
}

function copyReport(state: PanelState): void {
  buildMarkdownReport(state).then(
    (md) => {
      if (!md) { return; }
      vscode.env.clipboard.writeText(md).then(
        () => { vscode.window.setStatusBarMessage('Signal report copied', 2000); },
        () => { vscode.window.setStatusBarMessage('Failed to copy signal report', 3000); },
      );
    },
  ).catch(() => { vscode.window.setStatusBarMessage('Failed to build report', 3000); });
}

function saveReport(state: PanelState): void {
  buildMarkdownReport(state).then((md) => {
    if (!md) { return; }
    const wsFolder = vscode.workspace.workspaceFolders?.[0];
    const logDirUri = getLogDirectoryUri(wsFolder);
    const filename = buildSaveFilename(state, new Date());
    const destUri = vscode.Uri.joinPath(logDirUri, filename);
    return vscode.workspace.fs.createDirectory(logDirUri)
      .then(() => vscode.workspace.fs.writeFile(destUri, Buffer.from(md, 'utf-8')))
      .then(() => { vscode.window.setStatusBarMessage(`Signal report saved to ${filename}`, 3000); });
  }).catch((err) => {
    logExtensionError('saveSignalReport', err instanceof Error ? err : new Error(String(err)));
    vscode.window.setStatusBarMessage('Failed to save signal report', 3000);
  });
}

function buildSaveFilename(state: PanelState, now: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0');
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const safe = state.hypothesis.templateId.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `${stamp}_signal_${safe}.md`;
}

/** Build full markdown report by reading log file fresh and delegating to markdown module. */
async function buildMarkdownReport(state: PanelState): Promise<string> {
  const logLines = state.fileUri ? await readLogLines(state.fileUri) : [];
  const wsRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  // Load clean session header for "what changed" diff in markdown export
  let cleanHeader: ReturnType<typeof parseSessionHeader> | undefined;
  const cleanUri = await loadLastCleanSessionUri(state.hypothesis.templateId);
  if (cleanUri) {
    const cleanLines = await readLogLines(cleanUri);
    if (cleanLines.length > 0) { cleanHeader = parseSessionHeader(cleanLines); }
  }
  return buildFullMarkdownReport({
    hypothesis: state.hypothesis,
    bundle: state.bundle,
    logLines,
    filePath: state.fileUri?.fsPath,
    wsRoot,
    cleanHeader,
  });
}

/** Dispose all open signal report panels. */
export function disposeSignalReportPanel(): void {
  // Snapshot the set — dispose() triggers onDidDispose which mutates it
  for (const p of [...openPanels]) {
    p.dispose();
  }
  openPanels.clear();
}

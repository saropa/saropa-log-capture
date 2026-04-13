/**
 * Signal report webview panel — shows a rich diagnostic report for a single signal.
 *
 * Follows the `analysis-panel.ts` pattern: singleton WebviewPanel in ViewColumn.Beside,
 * progressive section rendering via postMessage.
 */

import * as vscode from 'vscode';
import type { RootCauseHypothesis, RootCauseHintBundle } from '../../modules/root-cause-hints/root-cause-hint-types';
import { getNonce } from '../provider/viewer-content';
import { buildSignalReportShell, renderEvidenceSection, renderRecommendations, resolveSourcePaths } from './signal-report-render';
import { excerptKey } from '../../modules/root-cause-hints/build-hypotheses-text';
import { getLogDirectoryUri } from '../../modules/config/config';
import { logExtensionError } from '../../modules/misc/extension-logger';

let panel: vscode.WebviewPanel | undefined;

/** Show a signal report for the given hypothesis. */
export async function showSignalReport(
  hypothesis: RootCauseHypothesis,
  bundle: RootCauseHintBundle,
  fileUri: vscode.Uri | undefined,
): Promise<void> {
  lastReportHypothesis = hypothesis;
  lastReportFileUri = fileUri;
  ensurePanel();
  panel!.webview.html = buildSignalReportShell({
    nonce: getNonce(),
    hypothesis,
  });
  await populateSections(hypothesis, bundle, fileUri);
}

function ensurePanel(): void {
  if (panel) { panel.reveal(); return; }
  panel = vscode.window.createWebviewPanel(
    'saropaLogCapture.signalReport',
    'Saropa Signal Report',
    vscode.ViewColumn.Beside,
    { enableScripts: true, localResourceRoots: [] },
  );
  panel.webview.onDidReceiveMessage(handleMessage);
  panel.onDidDispose(() => { panel = undefined; });
}

/** Populate sections with evidence data. */
async function populateSections(
  hypothesis: RootCauseHypothesis,
  bundle: RootCauseHintBundle,
  fileUri: vscode.Uri | undefined,
): Promise<void> {
  // Evidence section — read context around each evidence line
  const evidenceHtml = await buildEvidenceHtml(hypothesis, fileUri);
  postSection('evidence', 'Evidence', evidenceHtml);

  // Related lines — look for other lines matching the same pattern
  const relatedHtml = buildRelatedHtml(hypothesis, bundle);
  postSection('related', 'Related Lines', relatedHtml);

  // Recommendations
  const recsHtml = renderRecommendations(hypothesis.templateId);
  postSection('recommendations', 'Recommendations', recsHtml);
}

/** Read the log file and extract context around each evidence line index. */
async function buildEvidenceHtml(
  hypothesis: RootCauseHypothesis,
  fileUri: vscode.Uri | undefined,
): Promise<string> {
  const ids = hypothesis.evidenceLineIds;
  if (ids.length === 0 || !fileUri) {
    return '<div class="no-data">No evidence lines to display</div>';
  }
  const lines = await readLogLines(fileUri);
  if (lines.length === 0) {
    return '<div class="no-data">Could not read log file</div>';
  }
  const contextRadius = 5;
  const groups: { lineIndex: number; text: string; isTarget: boolean }[][] = [];
  for (const targetIdx of ids) {
    if (targetIdx < 0 || targetIdx >= lines.length) { continue; }
    const start = Math.max(0, targetIdx - contextRadius);
    const end = Math.min(lines.length - 1, targetIdx + contextRadius);
    const group: { lineIndex: number; text: string; isTarget: boolean }[] = [];
    for (let i = start; i <= end; i++) {
      group.push({ lineIndex: i, text: lines[i], isTarget: i === targetIdx });
    }
    groups.push(group);
  }
  return renderEvidenceSection(groups);
}

/** Build related lines HTML from bundle data using hypothesis key prefix. */
function buildRelatedHtml(hypothesis: RootCauseHypothesis, bundle: RootCauseHintBundle): string {
  const parts: string[] = [];
  const key = hypothesis.hypothesisKey;
  if (key.startsWith('err::') && bundle.errors && bundle.errors.length > 0) {
    parts.push(`<div>${bundle.errors.length} error(s) in this session match this pattern.</div>`);
  }
  if (key.startsWith('warn::') && bundle.warningGroups) {
    const warnKey = key.slice(6); // strip 'warn::' prefix
    for (const g of bundle.warningGroups) {
      if (!g) { continue; }
      const gKey = excerptKey(g.excerpt);
      if (gKey === warnKey) {
        parts.push(`<div>Warning repeated ${g.count} times across ${g.lineIndices.length} distinct locations.</div>`);
      }
    }
  }
  if (key.startsWith('net::') && bundle.networkFailures && bundle.networkFailures.length > 0) {
    parts.push(`<div>${bundle.networkFailures.length} network failure(s) detected in this session.</div>`);
  }
  if (parts.length === 0) {
    return '<div class="no-data">No additional related lines found</div>';
  }
  return parts.join('');
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

function postSection(id: string, title: string, html: string): void {
  panel?.webview.postMessage({ type: 'sectionReady', id, title, html });
}

function handleMessage(msg: Record<string, unknown>): void {
  if (msg.type === 'copyReport') { copyReport(); }
  if (msg.type === 'saveReport') { saveReport(); }
}

/** Stored for save/copy — set when showSignalReport is called. */
let lastReportHypothesis: RootCauseHypothesis | undefined;
let lastReportFileUri: vscode.Uri | undefined;

function copyReport(): void {
  buildMarkdownReport().then(
    (md) => {
      if (!md) { return; }
      vscode.env.clipboard.writeText(md).then(
        () => { vscode.window.setStatusBarMessage('Signal report copied', 2000); },
        () => { vscode.window.setStatusBarMessage('Failed to copy signal report', 3000); },
      );
    },
  ).catch(() => { vscode.window.setStatusBarMessage('Failed to build report', 3000); });
}

function saveReport(): void {
  buildMarkdownReport().then((md) => {
    if (!md) { return; }
    const wsFolder = vscode.workspace.workspaceFolders?.[0];
    const logDirUri = getLogDirectoryUri(wsFolder);
    const filename = buildSaveFilename(new Date());
    const destUri = vscode.Uri.joinPath(logDirUri, filename);
    return vscode.workspace.fs.createDirectory(logDirUri)
      .then(() => vscode.workspace.fs.writeFile(destUri, Buffer.from(md, 'utf-8')))
      .then(() => { vscode.window.setStatusBarMessage(`Signal report saved to ${filename}`, 3000); });
  }).catch((err) => {
    logExtensionError('saveSignalReport', err instanceof Error ? err : new Error(String(err)));
    vscode.window.setStatusBarMessage('Failed to save signal report', 3000);
  });
}

function buildSaveFilename(now: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0');
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const safe = (lastReportHypothesis?.templateId ?? 'signal').replace(/[^a-zA-Z0-9_-]/g, '_');
  return `${stamp}_signal_${safe}.md`;
}

async function buildMarkdownReport(): Promise<string | undefined> {
  if (!lastReportHypothesis) { return undefined; }
  const h = lastReportHypothesis;
  const conf = h.confidence ?? 'low';
  const wsRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  const out: string[] = [
    '# Saropa Signal Report',
    '',
    `**Signal:** ${h.text}`,
    `**Confidence:** ${conf}`,
    `**Template:** ${h.templateId}`,
  ];
  if (lastReportFileUri) {
    out.push(`**Log file:** \`${lastReportFileUri.fsPath}\``);
  }
  out.push('', '---', '');
  // Evidence lines — appended in-place by helper to stay within nesting limit
  await appendEvidenceLines(out, h.evidenceLineIds, wsRoot);
  return out.join('\n');
}

/** Append markdown evidence lines to `out`, reading from the last-reported log file. */
async function appendEvidenceLines(
  out: string[],
  evidenceLineIds: readonly number[],
  wsRoot: string | undefined,
): Promise<void> {
  if (!lastReportFileUri || evidenceLineIds.length === 0) { return; }
  const logLines = await readLogLines(lastReportFileUri);
  if (logLines.length === 0) { return; }
  out.push('## Evidence', '');
  for (const idx of evidenceLineIds) {
    if (idx < 0 || idx >= logLines.length) { continue; }
    const raw = logLines[idx];
    const resolved = wsRoot ? resolveSourcePaths(raw, wsRoot) : raw;
    out.push(`- **Line ${idx + 1}:** \`${resolved}\``);
  }
  out.push('');
}

/** Dispose the panel. */
export function disposeSignalReportPanel(): void {
  panel?.dispose();
  panel = undefined;
}

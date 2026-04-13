/**
 * Signal report webview panel — shows a rich diagnostic report for a single signal.
 *
 * Follows the `analysis-panel.ts` pattern: singleton WebviewPanel in ViewColumn.Beside,
 * progressive section rendering via postMessage.
 */

import * as vscode from 'vscode';
import type { RootCauseHypothesis, RootCauseHintBundle } from '../../modules/root-cause-hints/root-cause-hint-types';
import { getNonce } from '../provider/viewer-content';
import { buildSignalReportShell, renderEvidenceSection, renderRecommendations } from './signal-report-render';

let panel: vscode.WebviewPanel | undefined;

/** Show a signal report for the given hypothesis. */
export async function showSignalReport(
  hypothesis: RootCauseHypothesis,
  bundle: RootCauseHintBundle,
  fileUri: vscode.Uri | undefined,
): Promise<void> {
  lastReportHypothesis = hypothesis;
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
    'Signal Report',
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
      const gKey = g.excerpt.replace(/\s+/g, ' ').trim().slice(-80).toLowerCase();
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
  if (msg.type === 'copyReport') {
    copyReport();
  }
}

/** Stored for copy — set when showSignalReport is called. */
let lastReportHypothesis: RootCauseHypothesis | undefined;

function copyReport(): void {
  if (!lastReportHypothesis) { return; }
  const conf = lastReportHypothesis.confidence ?? 'low';
  const text = `Signal: ${lastReportHypothesis.text}\nConfidence: ${conf}\nTemplate: ${lastReportHypothesis.templateId}`;
  vscode.env.clipboard.writeText(text).then(undefined, () => {});
}

/** Dispose the panel. */
export function disposeSignalReportPanel(): void {
  panel?.dispose();
  panel = undefined;
}

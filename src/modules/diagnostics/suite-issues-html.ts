/**
 * Builds the "issues found by companion tools" block for the Integrations screen, plus the count
 * that drives the icon-bar badge. Reads the sibling offline mirrors (`advisor.json`, `lints.json`)
 * and renders each tool's diagnostics; when a tool is installed but has shared nothing, it renders
 * the silent-state guidance instead of an empty space, so the integration explains itself.
 *
 * Host-side (reads fs, checks installation, localizes labels). The webview injects the returned HTML
 * into the Integrations view and sets the badge to the returned count.
 */

import * as vscode from 'vscode';
import { escapeHtml } from '../capture/ansi';
import { t } from '../../l10n';
import { readSiblingEnvelope } from './envelope-io';
import { readWorkspaceHeadCommit } from './workspace-head-commit';
import { type Diagnostic, type DiagnosticSource } from './saropa-diagnostic-envelope';
import { DRIFT_ADVISOR_EXTENSION_ID } from '../integrations/drift-advisor-constants';
import { SAROPA_LINTS_EXTENSION_ID } from '../misc/saropa-lints-api';

/** The count drives the badge; the html fills the Integrations view's issues container. */
export interface SuiteIssuesPayload {
  readonly count: number;
  readonly html: string;
}

/** One companion tool, with the strings the issues block needs. */
interface SuiteToolUi {
  readonly source: DiagnosticSource;
  readonly extensionId: string;
  /** Brand name — stays English. */
  readonly label: string;
  /** l10n key for the "installed but silent" guidance line. */
  readonly silentKey: string;
}

const TOOLS: readonly SuiteToolUi[] = [
  {
    source: 'advisor',
    extensionId: DRIFT_ADVISOR_EXTENSION_ID,
    label: 'Saropa Drift Advisor',
    silentKey: 'viewer.integrations.suiteSilentAdvisor',
  },
  {
    source: 'lints',
    extensionId: SAROPA_LINTS_EXTENSION_ID,
    label: 'Saropa Lints',
    silentKey: 'viewer.integrations.suiteSilentLints',
  },
];

/** One diagnostic row: a severity-tagged title (and its location when present). */
function issueRowHtml(d: Diagnostic): string {
  const where = d.location?.file ? `<span class="suite-issue-loc">${escapeHtml(d.location.file)}</span>` : '';
  return `<div class="suite-issue-row suite-issue-${escapeHtml(d.severity)}">` +
    `<span class="suite-issue-title">${escapeHtml(d.title)}</span>${where}` +
    `</div>`;
}

/** Render one tool's section: its issues, or the silent guidance when installed-but-empty. */
function toolSectionHtml(
  tool: SuiteToolUi,
  diagnostics: readonly Diagnostic[] | undefined,
  stale: boolean,
): string {
  // Not installed → the existing companion install-link block already covers it; nothing here.
  if (!vscode.extensions.getExtension(tool.extensionId)) {
    return '';
  }
  // A mirror captured at a different commit is from older code; flag it so it is not read as current.
  const staleNote = stale
    ? ` <span class="suite-issue-stale">${escapeHtml(t('viewer.integrations.suiteStale'))}</span>`
    : '';
  const heading = `<div class="suite-issue-tool">${escapeHtml(tool.label)}${staleNote}</div>`;
  // Installed but no mirror → silent: explain why nothing shows and the concrete next step.
  if (!diagnostics) {
    return `<div class="suite-issue-group suite-issue-group-silent">${heading}` +
      `<div class="suite-issue-silent">${escapeHtml(t(tool.silentKey))}</div></div>`;
  }
  if (diagnostics.length === 0) {
    return '';
  }
  const rows = diagnostics.map(issueRowHtml).join('');
  return `<div class="suite-issue-group">${heading}${rows}</div>`;
}

/**
 * Read both mirrors, build the issues block and the total count. Best-effort: an absent or malformed
 * mirror reads as "no diagnostics" (the reader never throws), so the block degrades to the silent
 * guidance or an empty state rather than erroring.
 */
export async function buildSuiteIssues(): Promise<SuiteIssuesPayload> {
  const folder = vscode.workspace.workspaceFolders?.[0];
  // HEAD is the staleness anchor; when it cannot be resolved, no section is flagged stale (never guess).
  const currentCommit = folder ? await readWorkspaceHeadCommit(folder.uri) : undefined;
  const envelopes = await Promise.all(TOOLS.map((tool) => readSiblingEnvelope(tool.source)));
  const sections: string[] = [];
  let count = 0;
  for (let i = 0; i < TOOLS.length; i++) {
    const diagnostics = envelopes[i]?.diagnostics;
    // Commit is uniform within one mirror; the first stamped diagnostic carries it.
    const capturedCommit = diagnostics?.find((d) => d.commitSha)?.commitSha;
    const stale = currentCommit !== undefined
      && capturedCommit !== undefined
      && capturedCommit !== currentCommit;
    count += diagnostics?.length ?? 0;
    sections.push(toolSectionHtml(TOOLS[i], diagnostics, stale));
  }
  const body = sections.filter((s) => s.length > 0).join('');
  const heading = `<div class="suite-issues-heading">${escapeHtml(t('viewer.integrations.suiteIssuesHeading'))}</div>`;
  const content = body.length > 0
    ? body
    : `<div class="suite-issue-empty">${escapeHtml(t('viewer.integrations.suiteNoIssues'))}</div>`;
  return { count, html: heading + content };
}

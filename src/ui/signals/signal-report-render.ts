/**
 * HTML rendering for the signal report webview panel.
 * Builds the shell with progressive loading slots, and renders individual sections.
 */

import { escapeHtml } from '../../modules/capture/ansi';
import { t } from '../../l10n';
import { getSignalReportStyles } from './signal-report-styles';
import { getTokenStyles } from '../viewer-styles/viewer-styles-tokens';
import type { RootCauseHypothesis } from '../../modules/root-cause-hints/root-cause-hint-types';

interface ShellOptions {
  readonly nonce: string;
  readonly hypothesis: RootCauseHypothesis;
}

/** Build one collapsible section slot — starts open with a shimmer placeholder. */
function sectionSlot(id: string, title: string, loadingText: string): string {
  return (
    `<details id="section-${id}" class="section-slot" open>` +
    `<summary class="section-toggle"><h2>${escapeHtml(title)}</h2></summary>` +
    `<div class="section-body"><div class="section-loading">${escapeHtml(loadingText)}</div></div>` +
    `</details>`
  );
}

/** Build the initial HTML document with loading slots for each section. */
export function buildSignalReportShell(opts: ShellOptions): string {
  const { nonce, hypothesis } = opts;
  const conf = hypothesis.confidence ?? 'low';
  const confLabel = t(conf === 'high' ? 'signals.conf.high' : conf === 'medium' ? 'signals.conf.medium' : 'signals.conf.low');
  const reasonHtml = hypothesis.confidenceReason
    ? `<div class="conf-reason">${escapeHtml(hypothesis.confidenceReason)}</div>`
    : '';
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
<style nonce="${nonce}">${getTokenStyles()}${getSignalReportStyles()}</style>
</head>
<body>
<header class="report-header">
  <h1>${escapeHtml(t('signals.shell.title'))}</h1>
  <div class="signal-summary">
    <span>${escapeHtml(hypothesis.text)}</span>
    <span class="conf-badge conf-badge--${escapeHtml(conf)}">${escapeHtml(confLabel)}</span>
    ${reasonHtml}
  </div>
  <div class="btn-row">
    <button class="copy-btn" id="copy-report-btn">${escapeHtml(t('signals.shell.copyReport'))}</button>
    <button class="copy-btn" id="save-report-btn">${escapeHtml(t('signals.shell.saveReport'))}</button>
  </div>
</header>

<div class="report-grid">
  <div class="report-col report-col--primary">
    ${sectionSlot('overview', t('signals.section.overview'), t('signals.loading.overview'))}
    ${sectionSlot('evidence', t('signals.section.evidence'), t('signals.loading.evidence'))}
    ${sectionSlot('details', t('signals.section.details'), t('signals.loading.details'))}
    ${sectionSlot('related', t('signals.section.related'), t('signals.loading.related'))}
  </div>
  <div class="report-col report-col--secondary">
    ${sectionSlot('other-signals', t('signals.section.otherSignals'), t('signals.loading.otherSignals'))}
    ${sectionSlot('history', t('signals.section.history'), t('signals.loading.history'))}
    ${sectionSlot('recommendations', t('signals.section.recommendations'), t('signals.loading.recommendations'))}
    ${sectionSlot('ecosystem', t('signals.section.ecosystem'), t('signals.loading.ecosystem'))}
  </div>
</div>

<script nonce="${nonce}">
(function() {
  var vscodeApi = acquireVsCodeApi();

  /**
   * Apply a section's HTML to the DOM.
   * The slot is a <details> with a <summary> (title) and .section-body (content).
   * We replace the body content and update the summary title.
   */
  function applySection(id, title, html) {
    var slot = document.getElementById('section-' + id);
    if (!slot) { return; }
    var summary = slot.querySelector('.section-toggle');
    if (summary) { summary.innerHTML = '<h2>' + (title || id) + '</h2>'; }
    var body = slot.querySelector('.section-body');
    if (body) { body.innerHTML = html; }
  }

  /**
   * Restore sections from persisted state — VS Code destroys and recreates
   * the webview when the panel is moved to another tab group. setState/getState
   * survives that recreation so the report doesn't revert to loading placeholders.
   */
  var saved = vscodeApi.getState();
  if (saved && saved.sections) {
    var keys = Object.keys(saved.sections);
    for (var i = 0; i < keys.length; i++) {
      var s = saved.sections[keys[i]];
      applySection(keys[i], s.title, s.html);
    }
  }
  // Restore collapse state for each section
  if (saved && saved.collapsed) {
    for (var c = 0; c < saved.collapsed.length; c++) {
      var el = document.getElementById('section-' + saved.collapsed[c]);
      if (el) { el.removeAttribute('open'); }
    }
  }

  /**
   * Persist which sections the user has collapsed so the state survives
   * tab-group moves. Listens on the toggle event fired by <details>.
   */
  document.addEventListener('toggle', function(ev) {
    var det = ev.target;
    if (!det || !det.classList || !det.classList.contains('section-slot')) { return; }
    var state = vscodeApi.getState() || {};
    var collapsed = state.collapsed || [];
    var secId = det.id.replace('section-', '');
    if (det.open) {
      collapsed = collapsed.filter(function(x) { return x !== secId; });
    } else if (collapsed.indexOf(secId) === -1) {
      collapsed.push(secId);
    }
    state.collapsed = collapsed;
    vscodeApi.setState(state);
  }, true);

  window.addEventListener('message', function(event) {
    var msg = event.data;
    if (msg.type === 'sectionReady') {
      applySection(msg.id, msg.title, msg.html);
      // Persist each section so tab-move recreation can restore it
      var state = vscodeApi.getState() || {};
      var sections = state.sections || {};
      sections[msg.id] = { title: msg.title, html: msg.html };
      state.sections = sections;
      vscodeApi.setState(state);
    }
    if (msg.type === 'toast') {
      showToast(msg.text, msg.level || 'info');
    }
  });

  /** Show a temporary toast notification inside the webview. */
  function showToast(text, level) {
    var el = document.createElement('div');
    el.className = 'toast toast--' + level;
    el.textContent = text;
    document.body.appendChild(el);
    // Trigger reflow so the initial opacity:0 takes effect before transition
    void el.offsetWidth;
    el.classList.add('toast--visible');
    setTimeout(function() {
      el.classList.remove('toast--visible');
      setTimeout(function() { el.remove(); }, 300);
    }, 2500);
  }

  /* Delegated click handler for cross-session history rows — opens the selected session */
  document.addEventListener('click', function(ev) {
    var row = ev.target && ev.target.closest ? ev.target.closest('.history-session-row') : null;
    if (row && row.dataset && row.dataset.uri) {
      ev.preventDefault();
      vscodeApi.postMessage({ type: 'openSessionFromHistory', uriString: row.dataset.uri });
      return;
    }
    /* Companion extension install links — open Marketplace URL */
    var link = ev.target && ev.target.closest ? ev.target.closest('.ecosystem-prompt-link') : null;
    if (link) {
      ev.preventDefault();
      var url = link.getAttribute('data-url');
      if (url) { vscodeApi.postMessage({ type: 'openUrl', url: url }); }
    }
  });
  var copyBtn = document.getElementById('copy-report-btn');
  if (copyBtn) {
    copyBtn.addEventListener('click', function() {
      vscodeApi.postMessage({ type: 'copyReport' });
    });
  }
  var saveBtn = document.getElementById('save-report-btn');
  if (saveBtn) {
    saveBtn.addEventListener('click', function() {
      vscodeApi.postMessage({ type: 'saveReport' });
    });
  }
})();
</script>
</body>
</html>`;
}

interface EvidenceLine {
  readonly lineIndex: number;
  readonly text: string;
  readonly isTarget: boolean;
}

/** Metadata shown above each evidence block (timeline position, preceding action). */
export interface EvidenceGroupMeta {
  readonly timelinePosition?: string;
  readonly precedingAction?: string;
}

/** Single evidence group: the context lines plus optional metadata. */
export interface EvidenceGroup {
  readonly lines: readonly EvidenceLine[];
  readonly meta?: EvidenceGroupMeta;
}

/** Render evidence lines with surrounding context and optional metadata annotations. */
export function renderEvidenceSection(groups: readonly EvidenceGroup[]): string {
  if (groups.length === 0) { return `<div class="no-data">${escapeHtml(t('signals.evidence.noData'))}</div>`; }
  const parts: string[] = [];
  for (const group of groups) {
    parts.push('<div class="evidence-block">');
    // Metadata annotations above the code block
    if (group.meta?.timelinePosition) {
      parts.push(`<div class="evidence-meta">${escapeHtml(group.meta.timelinePosition)}</div>`);
    }
    if (group.meta?.precedingAction) {
      parts.push(`<div class="evidence-meta">${escapeHtml(t('signals.evidence.precedingAction', group.meta.precedingAction))}</div>`);
    }
    parts.push('<div class="evidence-lines">');
    for (const line of group.lines) {
      const cls = line.isTarget ? ' evidence-line--target' : '';
      const num = `<span class="evidence-line-num">${line.lineIndex + 1}</span>`;
      parts.push(`<div class="evidence-line${cls}">${num}${escapeHtml(line.text)}</div>`);
    }
    parts.push('</div></div>');
  }
  return parts.join('');
}

/**
 * Render recommendations based on signal type.
 * For error-recent signals, the recommendation is tailored to the crash category
 * (fatal, anr, oom, native, non-fatal) when available.
 */
export function renderRecommendations(templateId: string, errorCategory?: string): string {
  const recKey = getRecommendation(templateId, errorCategory);
  if (!recKey) { return `<div class="no-data">${escapeHtml(t('signals.rec.noData'))}</div>`; }
  return `<div class="recommendation">${escapeHtml(t(recKey))}</div>`;
}

/** Replace relative source paths (e.g. ./lib/foo.dart:42) with absolute paths. */
export function resolveSourcePaths(line: string, wsRoot: string): string {
  const normalized = wsRoot.replace(/\\/g, '/');
  return line.replace(
    /(?:\.\/)([\w/.-]+\.dart(?::\d+(?::\d+)?)?)/g,
    (_match, rel: string) => `${normalized}/${rel}`,
  );
}

/** Returns the l10n KEY of the recommendation for a signal (rendered with t() by the caller). */
function getRecommendation(templateId: string, errorCategory?: string): string | undefined {
  // Category-specific recommendations for error-recent signals
  if (templateId === 'error-recent' && errorCategory) {
    const catKey = errorCategoryRecommendation(errorCategory);
    if (catKey) { return catKey; }
  }
  const known = new Set([
    'error-recent', 'warning-recurring', 'network-failure', 'memory-pressure', 'slow-operation',
    'permission-denial', 'anr-risk', 'n-plus-one', 'sql-burst', 'fingerprint-leader',
    'classified-critical', 'classified-bug',
  ]);
  return known.has(templateId) ? `signals.rec.${templateId}` : undefined;
}

/** l10n KEY of the tailored advice for a crash category (error-recent signals), or undefined. */
function errorCategoryRecommendation(cat: string): string | undefined {
  const known = new Set(['fatal', 'anr', 'oom', 'native', 'non-fatal']);
  return known.has(cat) ? `signals.recCat.${cat}` : undefined;
}

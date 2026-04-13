/**
 * HTML rendering for the signal report webview panel.
 * Builds the shell with progressive loading slots, and renders individual sections.
 */

import { escapeHtml } from '../../modules/capture/ansi';
import { getSignalReportStyles } from './signal-report-styles';
import type { RootCauseHypothesis } from '../../modules/root-cause-hints/root-cause-hint-types';

interface ShellOptions {
  readonly nonce: string;
  readonly hypothesis: RootCauseHypothesis;
}

/** Build the initial HTML document with loading slots for each section. */
export function buildSignalReportShell(opts: ShellOptions): string {
  const { nonce, hypothesis } = opts;
  const conf = hypothesis.confidence ?? 'low';
  const confLabel = conf === 'high' ? 'High confidence' : conf === 'medium' ? 'Medium confidence' : 'Low confidence';
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
<style nonce="${nonce}">${getSignalReportStyles()}</style>
</head>
<body>
<h1>Saropa Signal Report</h1>
<div class="signal-summary">
  <span>${escapeHtml(hypothesis.text)}</span>
  <span class="conf-badge conf-badge--${escapeHtml(conf)}">${escapeHtml(confLabel)}</span>
</div>

<div id="section-evidence" class="section-slot">
  <h2>Evidence</h2>
  <div class="section-loading">Loading evidence lines...</div>
</div>

<div id="section-related" class="section-slot">
  <h2>Related Lines</h2>
  <div class="section-loading">Scanning for related lines...</div>
</div>

<div id="section-recommendations" class="section-slot">
  <h2>Recommendations</h2>
  <div class="section-loading">Generating recommendations...</div>
</div>

<div class="btn-row">
  <button class="copy-btn" id="copy-report-btn">Copy Report</button>
  <button class="copy-btn" id="save-report-btn">Save Report</button>
</div>

<script nonce="${nonce}">
(function() {
  var vscodeApi = acquireVsCodeApi();
  window.addEventListener('message', function(event) {
    var msg = event.data;
    if (msg.type === 'sectionReady') {
      var slot = document.getElementById('section-' + msg.id);
      if (slot) slot.innerHTML = '<h2>' + (msg.title || msg.id) + '</h2>' + msg.html;
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

/** Render evidence lines with surrounding context. */
export function renderEvidenceSection(groups: readonly EvidenceLine[][]): string {
  if (groups.length === 0) { return '<div class="no-data">No evidence lines found</div>'; }
  const parts: string[] = [];
  for (const group of groups) {
    parts.push('<div class="evidence-block">');
    parts.push('<div class="evidence-lines">');
    for (const line of group) {
      const cls = line.isTarget ? ' evidence-line--target' : '';
      const num = `<span class="evidence-line-num">${line.lineIndex + 1}</span>`;
      parts.push(`<div class="evidence-line${cls}">${num}${escapeHtml(line.text)}</div>`);
    }
    parts.push('</div></div>');
  }
  return parts.join('');
}

/** Render recommendations based on signal type. */
export function renderRecommendations(templateId: string): string {
  const recs = getRecommendation(templateId);
  if (!recs) { return '<div class="no-data">No specific recommendations</div>'; }
  return `<div class="recommendation">${escapeHtml(recs)}</div>`;
}

/** Replace relative source paths (e.g. ./lib/foo.dart:42) with absolute paths. */
export function resolveSourcePaths(line: string, wsRoot: string): string {
  const normalized = wsRoot.replace(/\\/g, '/');
  return line.replace(
    /(?:\.\/)([\w/.-]+\.dart(?::\d+(?::\d+)?)?)/g,
    (_match, rel: string) => `${normalized}/${rel}`,
  );
}

function getRecommendation(templateId: string): string | undefined {
  const map: Record<string, string> = {
    'error-recent': 'Check the stack trace for the root cause. If the error repeats, consider adding error handling or fixing the underlying issue.',
    'warning-recurring': 'Recurring warnings often indicate deprecated APIs or configuration issues. Address them to prevent future breakage.',
    'network-failure': 'Check network connectivity, server availability, and timeout configuration. Consider adding retry logic with backoff.',
    'memory-pressure': 'Profile memory usage to find leaks. Check for large allocations, unclosed streams, or growing collections.',
    'slow-operation': 'Profile the slow path. Consider caching, pagination, or moving work off the main thread.',
    'permission-denial': 'Ensure the app requests required permissions before use. Check the manifest/Info.plist for missing declarations.',
    'anr-risk': 'Move long-running operations off the main thread. Check for blocking I/O, synchronous network calls, or heavy computation on UI thread.',
    'n-plus-one': 'Use eager loading (joins) or batch queries instead of issuing one query per item in a loop.',
    'sql-burst': 'Consider debouncing or batching these queries. Check if the same query is being called redundantly.',
    'fingerprint-leader': 'This query runs very frequently. Consider caching results or batching multiple calls.',
    'classified-critical': 'This is a critical error that likely causes crashes or data loss. Prioritize investigation.',
    'classified-bug': 'This pattern typically indicates a programming error. Check for null/undefined handling and type safety.',
  };
  return map[templateId];
}

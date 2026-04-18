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
  const reasonHtml = hypothesis.confidenceReason
    ? `<div class="conf-reason">${escapeHtml(hypothesis.confidenceReason)}</div>`
    : '';
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
  ${reasonHtml}
</div>

<div id="section-overview" class="section-slot">
  <h2>Session Overview</h2>
  <div class="section-loading">Loading session data...</div>
</div>

<div id="section-evidence" class="section-slot">
  <h2>Evidence</h2>
  <div class="section-loading">Loading evidence lines...</div>
</div>

<div id="section-details" class="section-slot">
  <h2>Signal Details</h2>
  <div class="section-loading">Analyzing signal...</div>
</div>

<div id="section-related" class="section-slot">
  <h2>Related Lines</h2>
  <div class="section-loading">Scanning for related lines...</div>
</div>

<div id="section-other-signals" class="section-slot">
  <h2>Other Signals</h2>
  <div class="section-loading">Checking for other signals...</div>
</div>

<div id="section-history" class="section-slot">
  <h2>Cross-Session History</h2>
  <div class="section-loading">Checking session history\u2026</div>
</div>

<div id="section-recommendations" class="section-slot">
  <h2>Recommendations</h2>
  <div class="section-loading">Generating recommendations...</div>
</div>

<div id="section-ecosystem" class="section-slot">
  <h2>Companion Extensions</h2>
  <div class="section-loading">Checking installed extensions\u2026</div>
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
  if (groups.length === 0) { return '<div class="no-data">No evidence lines found</div>'; }
  const parts: string[] = [];
  for (const group of groups) {
    parts.push('<div class="evidence-block">');
    // Metadata annotations above the code block
    if (group.meta?.timelinePosition) {
      parts.push(`<div class="evidence-meta">${escapeHtml(group.meta.timelinePosition)}</div>`);
    }
    if (group.meta?.precedingAction) {
      parts.push(`<div class="evidence-meta">Preceding action: ${escapeHtml(group.meta.precedingAction)}</div>`);
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
  const recs = getRecommendation(templateId, errorCategory);
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

function getRecommendation(templateId: string, errorCategory?: string): string | undefined {
  // Category-specific recommendations for error-recent signals
  if (templateId === 'error-recent' && errorCategory) {
    const catRec = errorCategoryRecommendation(errorCategory);
    if (catRec) { return catRec; }
  }
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
    'classified-critical': 'This is a critical error that likely causes crashes or data loss. Prioritize collection.',
    'classified-bug': 'This pattern typically indicates a programming error. Check for null/undefined handling and type safety.',
  };
  return map[templateId];
}

/** Tailored advice based on the crash category for error-recent signals. */
function errorCategoryRecommendation(cat: string): string | undefined {
  const catMap: Record<string, string> = {
    'fatal': 'This is a fatal/unhandled exception — the app likely crashed. Check the stack trace for the throw site and add a top-level error handler.',
    'anr': 'This error is associated with an ANR (Application Not Responding). Move the blocking operation off the main thread.',
    'oom': 'This is an out-of-memory error. Profile heap usage, check for retained references, and consider reducing allocation in hot paths.',
    'native': 'This is a native crash (SIGSEGV/SIGABRT). Check for use-after-free, null pointer dereference, or incompatible native library versions.',
    'non-fatal': 'This is a non-fatal error. Check for null/undefined values at the call site shown in the stack trace.',
  };
  return catMap[cat];
}

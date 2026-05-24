/**
 * HTML + webview script for the App Quality Insights dashboard.
 *
 * Server-renders the toolbar and issues list; the detail and breakdown panes are filled on demand
 * when the user selects an issue (host posts back `renderCrashDetail` / `renderDeviceDistribution`
 * HTML). Issues come from the Play Developer Reporting data layer via getFirebaseContext (bug_008).
 */

import { escapeHtml } from '../../modules/capture/ansi';
import { getDashboardStyles } from './app-quality-insights-styles';
import type { CrashlyticsIssue } from '../../modules/crashlytics/crashlytics-types';

/** Data the dashboard page needs (kept flat so it is trivial to serialize/render). */
export interface DashboardModel {
    readonly available: boolean;
    readonly issues: readonly CrashlyticsIssue[];
    readonly packageName: string;
    readonly timeRange: string;
    readonly refreshNote: string;
    readonly consoleUrl?: string;
    readonly setupHint?: string;
}

const TIME_RANGES: ReadonlyArray<readonly [string, string]> = [
    ['LAST_24_HOURS', 'Last 24 hours'],
    ['LAST_7_DAYS', 'Last 7 days'],
    ['LAST_30_DAYS', 'Last 30 days'],
    ['LAST_90_DAYS', 'Last 90 days'],
];

function formatVersionRange(issue: CrashlyticsIssue): string {
    if (!issue.firstVersion && !issue.lastVersion) { return ''; }
    const a = issue.firstVersion ?? issue.lastVersion ?? '';
    const b = issue.lastVersion ?? issue.firstVersion ?? '';
    const range = a && b && a !== b ? `${escapeHtml(a)} → ${escapeHtml(b)}` : escapeHtml(a || b);
    return ` · v${range}`;
}

function renderIssueRow(issue: CrashlyticsIssue): string {
    const sev = issue.isFatal ? 'aqi-sev-fatal' : 'aqi-sev-nonfatal';
    const users = issue.userCount > 0 ? ` · <b>${issue.userCount}</b> users` : '';
    return `<div class="aqi-issue" data-issue-id="${escapeHtml(issue.id)}" tabindex="0">
        <div class="aqi-issue-head"><span class="aqi-sev ${sev}"></span><span class="aqi-issue-title">${escapeHtml(issue.title) || 'Unknown error'}</span></div>
        ${issue.subtitle ? `<div class="aqi-issue-sub">${escapeHtml(issue.subtitle)}</div>` : ''}
        <div class="aqi-issue-meta"><b>${issue.eventCount}</b> events${users}${formatVersionRange(issue)}</div>
    </div>`;
}

function renderToolbar(model: DashboardModel): string {
    const options = TIME_RANGES.map(([value, label]) =>
        `<option value="${value}"${value === model.timeRange ? ' selected' : ''}>${label}</option>`).join('');
    const pkg = model.packageName ? `<span class="aqi-pkg">${escapeHtml(model.packageName)}</span>` : '';
    const note = model.refreshNote ? `<span class="aqi-note">Updated ${escapeHtml(model.refreshNote)}</span>` : '';
    const consoleLink = model.consoleUrl
        ? `<a class="aqi-link" data-action="openConsole">Open Firebase Console ↗</a>` : '';
    return `<div class="aqi-toolbar">
        <span class="aqi-title">App Quality Insights</span>${pkg}
        <span class="aqi-spacer"></span>
        <select id="aqi-range" title="Time range">${options}</select>
        <button class="aqi-btn" id="aqi-refresh">Refresh</button>
        ${note}${consoleLink}
    </div>`;
}

/** Setup state: the data layer has no connection yet — point at the sidebar's Test connection flow. */
function renderSetup(model: DashboardModel): string {
    const hint = model.setupHint ? `<p>${escapeHtml(model.setupHint)}</p>` : '';
    return `<div class="aqi-setup">
        <h2>Connect Crashlytics to see App Quality Insights</h2>
        ${hint}
        <p>Open the <b>Crashlytics</b> panel in the log viewer and click <b>Test connection</b> — it
        checks gcloud, sign-in (with the Play reporting scope), and the project, and shows a fix for
        any step that fails.</p>
        <p>Then reopen this dashboard.</p>
    </div>`;
}

/** Build the full dashboard page. */
export function buildDashboardHtml(model: DashboardModel, nonce: string): string {
    const csp = `default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';`;
    const head = `<meta http-equiv="Content-Security-Policy" content="${csp}"><style nonce="${nonce}">${getDashboardStyles()}</style>`;
    if (!model.available) {
        return `<!DOCTYPE html><html><head>${head}</head><body>${renderToolbar(model)}${renderSetup(model)}<script nonce="${nonce}">${getDashboardScript()}</script></body></html>`;
    }
    const list = model.issues.length > 0
        ? model.issues.map(renderIssueRow).join('')
        : '<div class="aqi-empty">No issues in this time range.</div>';
    return `<!DOCTYPE html><html><head>${head}</head><body>
${renderToolbar(model)}
<div class="aqi-grid">
    <div class="aqi-pane" id="aqi-issues"><div class="aqi-pane-title">Issues (${model.issues.length})</div>${list}</div>
    <div class="aqi-pane"><div class="aqi-pane-title">Detail</div><div id="aqi-detail"><div class="aqi-empty">Select an issue to see its stack trace.</div></div></div>
    <div class="aqi-pane"><div class="aqi-pane-title">Breakdown</div><div id="aqi-breakdown"><div class="aqi-empty">Device & version breakdown appears here.</div></div></div>
</div>
<script nonce="${nonce}">${getDashboardScript()}</script>
</body></html>`;
}

/** Webview script: issue selection, toolbar actions, and applying detail/breakdown posted by the host. */
function getDashboardScript(): string {
    return /* js */ `
(function () {
    const vscode = acquireVsCodeApi();
    function post(msg) { vscode.postMessage(msg); }

    const issues = document.getElementById('aqi-issues');
    if (issues) {
        issues.addEventListener('click', function (e) {
            const row = e.target.closest('.aqi-issue');
            if (!row) { return; }
            document.querySelectorAll('.aqi-issue.selected').forEach(function (x) { x.classList.remove('selected'); });
            row.classList.add('selected');
            const detail = document.getElementById('aqi-detail');
            if (detail) { detail.innerHTML = '<div class="aqi-empty">Loading…</div>'; }
            post({ type: 'selectIssue', issueId: row.getAttribute('data-issue-id') });
        });
    }

    const range = document.getElementById('aqi-range');
    if (range) { range.addEventListener('change', function () { post({ type: 'setTimeRange', range: range.value }); }); }
    const refresh = document.getElementById('aqi-refresh');
    if (refresh) { refresh.addEventListener('click', function () { post({ type: 'refresh' }); }); }

    document.body.addEventListener('click', function (e) {
        const a = e.target.closest('[data-action="openConsole"]');
        if (a) { post({ type: 'openConsole' }); }
        const frame = e.target.closest('.stack-frame[data-frame-file]');
        if (frame) { post({ type: 'openFrame', file: frame.getAttribute('data-frame-file'), line: frame.getAttribute('data-frame-line') }); }
    });

    window.addEventListener('message', function (e) {
        const m = e.data;
        if (!m || m.type !== 'detail') { return; }
        const detail = document.getElementById('aqi-detail');
        const breakdown = document.getElementById('aqi-breakdown');
        if (detail) { detail.innerHTML = m.detailHtml || '<div class="no-matches">No detail available.</div>'; }
        if (breakdown) { breakdown.innerHTML = m.breakdownHtml || '<div class="aqi-empty">No breakdown for this issue.</div>'; }
    });
})();
`;
}

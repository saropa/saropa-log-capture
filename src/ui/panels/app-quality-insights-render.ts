/**
 * HTML + webview script for the App Quality Insights dashboard.
 *
 * Server-renders the toolbar and issues list; the detail and breakdown panes are filled on demand
 * when the user selects an issue (host posts back `renderCrashDetail` / `renderDeviceDistribution`
 * HTML). Issues come from the Play Developer Reporting data layer via getFirebaseContext (bug_008).
 */

import { escapeHtml } from '../../modules/capture/ansi';
import { getDashboardStyles } from './app-quality-insights-styles';
import { issueShortId } from '../../modules/crashlytics/play-reporting-mappers';
import type { CrashlyticsIssue } from '../../modules/crashlytics/crashlytics-types';
import type { StatEntry, IssueBreakdown, IssueFilterIndex } from '../../modules/crashlytics/play-reporting-metrics';

/** Data the dashboard page needs (kept flat so it is trivial to serialize/render). */
export interface DashboardModel {
    readonly available: boolean;
    readonly issues: readonly CrashlyticsIssue[];
    readonly packageName: string;
    readonly timeRange: string;
    readonly refreshNote: string;
    readonly consoleUrl?: string;
    readonly setupHint?: string;
    /** When set, the issues are from the offline cache (not a fresh fetch) — shown as a stale banner. */
    readonly staleNote?: string;
    /** Per-issue device/OS values (downloaded once) for the local device & OS filters. */
    readonly filterIndex?: IssueFilterIndex;
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

/** Distinct app versions an issue spans (first + last), for the version filter. */
function issueVersions(issue: CrashlyticsIssue): string[] {
    return [...new Set([issue.firstVersion, issue.lastVersion].filter((v): v is string => !!v))];
}

function renderIssueRow(issue: CrashlyticsIssue, index?: IssueFilterIndex): string {
    const sev = issue.isFatal ? 'aqi-sev-fatal' : 'aqi-sev-nonfatal';
    const users = issue.userCount > 0 ? ` · <b>${issue.userCount}</b> users` : '';
    // data-* attributes drive the client-side filtering (no host round-trip). device/OS come from the
    // downloaded per-issue index, keyed by the issue's short id.
    const search = `${issue.title} ${issue.subtitle}`.toLowerCase();
    const shortId = issueShortId(issue.id);
    const devices = index?.devicesByIssue[shortId]?.join(',') ?? '';
    const os = index?.osByIssue[shortId]?.join(',') ?? '';
    return `<div class="aqi-issue" data-issue-id="${escapeHtml(issue.id)}" data-kind="${issue.kind ?? 'unknown'}" data-versions="${escapeHtml(issueVersions(issue).join(','))}" data-devices="${escapeHtml(devices)}" data-os="${escapeHtml(os)}" data-search="${escapeHtml(search)}" tabindex="0">
        <div class="aqi-issue-head"><span class="aqi-sev ${sev}"></span><span class="aqi-issue-title">${escapeHtml(issue.title) || 'Unknown error'}</span></div>
        ${issue.subtitle ? `<div class="aqi-issue-sub">${escapeHtml(issue.subtitle)}</div>` : ''}
        <div class="aqi-issue-meta"><b>${issue.eventCount}</b> events${users}${formatVersionRange(issue)}</div>
    </div>`;
}

/** Per-tab issue counts shown on the tab labels. */
function kindCounts(issues: readonly CrashlyticsIssue[]): Record<string, number> {
    const counts: Record<string, number> = { all: issues.length, crash: 0, anr: 0, nonfatal: 0 };
    for (const issue of issues) {
        const k = issue.kind ?? 'unknown';
        if (counts[k] !== undefined) { counts[k]++; }
    }
    return counts;
}

/** Sorted union of all values across a per-issue map (for populating a filter dropdown). */
function unionValues(map: Record<string, string[]> | undefined): string[] {
    if (!map) { return []; }
    const set = new Set<string>();
    for (const id of Object.keys(map)) { for (const v of map[id]) { set.add(v); } }
    return [...set].sort();
}

/** Build a `<select>` with an "all" sentinel plus one option per value. */
function selectHtml(id: string, allLabel: string, values: readonly string[], prefix = ''): string {
    const opts = [`<option value="">${escapeHtml(allLabel)}</option>`,
        ...values.map(v => `<option value="${escapeHtml(v)}">${escapeHtml(prefix + v)}</option>`)].join('');
    return `<select id="${id}">${opts}</select>`;
}

/** Source/type tabs + text search + version/device/OS dropdowns. All filtering is client-side. */
function renderFilterBar(model: DashboardModel): string {
    const counts = kindCounts(model.issues);
    const tab = (kind: string, label: string): string =>
        `<button class="aqi-tab${kind === 'all' ? ' selected' : ''}" data-kind="${kind}">${label} <span class="aqi-tab-count">${counts[kind] ?? 0}</span></button>`;
    const versions = [...new Set(model.issues.flatMap(issueVersions))].sort();
    return `<div class="aqi-filterbar">
        <div class="aqi-tabs">${tab('all', 'All')}${tab('crash', 'Crashes')}${tab('anr', 'ANRs')}${tab('nonfatal', 'Non-fatals')}</div>
        <span class="aqi-spacer"></span>
        <input class="aqi-search" id="aqi-search" type="text" placeholder="Filter issues…" aria-label="Filter issues">
        ${selectHtml('aqi-version', 'All versions', versions, 'v')}
        ${selectHtml('aqi-device', 'All devices', unionValues(model.filterIndex?.devicesByIssue))}
        ${selectHtml('aqi-os', 'All OS', unionValues(model.filterIndex?.osByIssue))}
    </div>`;
}

function renderToolbar(model: DashboardModel): string {
    const options = TIME_RANGES.map(([value, label]) =>
        `<option value="${value}"${value === model.timeRange ? ' selected' : ''}>${label}</option>`).join('');
    const pkg = model.packageName ? `<span class="aqi-pkg">${escapeHtml(model.packageName)}</span>` : '';
    const note = model.staleNote
        ? `<span class="aqi-note aqi-stale">${escapeHtml(model.staleNote)}</span>`
        : model.refreshNote ? `<span class="aqi-note">Updated ${escapeHtml(model.refreshNote)}</span>` : '';
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

/** One labeled set of distribution bars (Devices / Android versions). */
function renderDistBars(label: string, entries: readonly StatEntry[]): string {
    if (entries.length === 0) { return ''; }
    const total = entries.reduce((sum, e) => sum + e.count, 0) || 1;
    const rows = entries.map(e => {
        const pct = Math.round((e.count / total) * 100);
        return `<div class="crash-dist-row"><span class="crash-dist-name" title="${escapeHtml(e.name)}">${escapeHtml(e.name)}</span><div class="crash-dist-bar-bg"><div class="crash-dist-bar-fill" style="width:${pct}%"></div></div><span class="crash-dist-count">${e.count} (${pct}%)</span></div>`;
    }).join('');
    return `<div class="crash-dist-label">${escapeHtml(label)}</div>${rows}`;
}

/** Render the true device/OS aggregate breakdown (from the Play error-count metric set). */
export function renderAggregateBreakdown(breakdown: IssueBreakdown): string {
    if (breakdown.devices.length === 0 && breakdown.os.length === 0) { return ''; }
    const most = breakdown.devices[0] ? `<div class="aqi-most">Most affected device: ${escapeHtml(breakdown.devices[0].name)}</div>` : '';
    return `<div class="aqi-breakdown-agg">${renderDistBars('Devices', breakdown.devices)}${renderDistBars('Android versions', breakdown.os)}${most}</div>`;
}

/** Build the full dashboard page. `initialIssueId` (optional) is auto-selected on load. */
export function buildDashboardHtml(model: DashboardModel, nonce: string, initialIssueId?: string): string {
    const csp = `default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';`;
    const head = `<meta http-equiv="Content-Security-Policy" content="${csp}"><style nonce="${nonce}">${getDashboardStyles()}</style>`;
    if (!model.available) {
        return `<!DOCTYPE html><html><head>${head}</head><body>${renderToolbar(model)}${renderSetup(model)}<script nonce="${nonce}">${getDashboardScript()}</script></body></html>`;
    }
    const list = model.issues.length > 0
        ? model.issues.map(issue => renderIssueRow(issue, model.filterIndex)).join('')
        : '<div class="aqi-empty">No issues in this time range.</div>';
    return `<!DOCTYPE html><html><head>${head}</head><body>
${renderToolbar(model)}
${renderFilterBar(model)}
<div class="aqi-grid">
    <div class="aqi-pane" id="aqi-issues" data-initial="${escapeHtml(initialIssueId ?? '')}"><div class="aqi-pane-title">Issues (<span id="aqi-issue-count">${model.issues.length}</span>)</div>${list}</div>
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

    /* ---- Client-side filtering: tab (kind) ∩ search text ∩ version, over the loaded rows ---- */
    var activeKind = 'all', searchText = '', activeVersion = '', activeDevice = '', activeOS = '';
    function hasValue(row, attr, want) {
        if (!want) { return true; }
        return (row.getAttribute(attr) || '').split(',').indexOf(want) >= 0;
    }
    function applyFilters() {
        var shown = 0;
        document.querySelectorAll('.aqi-issue').forEach(function (row) {
            var kind = row.getAttribute('data-kind');
            var text = row.getAttribute('data-search') || '';
            var ok = (activeKind === 'all' || kind === activeKind)
                && (!searchText || text.indexOf(searchText) >= 0)
                && hasValue(row, 'data-versions', activeVersion)
                && hasValue(row, 'data-devices', activeDevice)
                && hasValue(row, 'data-os', activeOS);
            row.style.display = ok ? '' : 'none';
            if (ok) { shown++; }
        });
        var counter = document.getElementById('aqi-issue-count');
        if (counter) { counter.textContent = String(shown); }
    }
    var tabs = document.querySelector('.aqi-tabs');
    if (tabs) {
        tabs.addEventListener('click', function (e) {
            var btn = e.target.closest('.aqi-tab');
            if (!btn) { return; }
            tabs.querySelectorAll('.aqi-tab.selected').forEach(function (t) { t.classList.remove('selected'); });
            btn.classList.add('selected');
            activeKind = btn.getAttribute('data-kind');
            applyFilters();
        });
    }
    var searchEl = document.getElementById('aqi-search');
    if (searchEl) { searchEl.addEventListener('input', function () { searchText = searchEl.value.toLowerCase(); applyFilters(); }); }
    var versionEl = document.getElementById('aqi-version');
    if (versionEl) { versionEl.addEventListener('change', function () { activeVersion = versionEl.value; applyFilters(); }); }
    var deviceEl = document.getElementById('aqi-device');
    if (deviceEl) { deviceEl.addEventListener('change', function () { activeDevice = deviceEl.value; applyFilters(); }); }
    var osEl = document.getElementById('aqi-os');
    if (osEl) { osEl.addEventListener('change', function () { activeOS = osEl.value; applyFilters(); }); }

    const issues = document.getElementById('aqi-issues');
    function selectRow(row) {
        document.querySelectorAll('.aqi-issue.selected').forEach(function (x) { x.classList.remove('selected'); });
        row.classList.add('selected');
        const detail = document.getElementById('aqi-detail');
        if (detail) { detail.innerHTML = '<div class="aqi-empty">Loading…</div>'; }
        post({ type: 'selectIssue', issueId: row.getAttribute('data-issue-id') });
    }
    if (issues) {
        issues.addEventListener('click', function (e) {
            const row = e.target.closest('.aqi-issue');
            if (row) { selectRow(row); }
        });
        // Auto-select the issue the sidebar opened us with (clicking a sidebar entry deep-links here).
        const initial = issues.getAttribute('data-initial');
        if (initial) {
            const initRow = issues.querySelector('.aqi-issue[data-issue-id="' + initial.replace(/"/g, '\\\\"') + '"]');
            if (initRow) { selectRow(initRow); initRow.scrollIntoView({ block: 'center' }); }
        }
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

    function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

    // Append source-line + git-blame annotations under the matching app frames (streamed after detail).
    function applyFrameContexts(contexts) {
        const frames = document.querySelectorAll('#aqi-detail .stack-frame');
        contexts.forEach(function (ctx) {
            for (let i = 0; i < frames.length; i++) {
                if (frames[i].getAttribute('data-frame-file') !== ctx.file || frames[i].getAttribute('data-frame-line') !== String(ctx.line)) { continue; }
                if (frames[i].querySelector('.aqi-frame-ctx')) { break; }
                let html = '';
                if (ctx.code) { html += '<code class="aqi-frame-code">' + esc(ctx.code) + '</code>'; }
                if (ctx.blame) { html += '<span class="aqi-frame-blame">' + esc(ctx.blame) + '</span>'; }
                const ann = document.createElement('div');
                ann.className = 'aqi-frame-ctx';
                ann.innerHTML = html;
                frames[i].appendChild(ann);
                break;
            }
        });
    }

    window.addEventListener('message', function (e) {
        const m = e.data;
        if (!m) { return; }
        if (m.type === 'detail') {
            const detail = document.getElementById('aqi-detail');
            const breakdown = document.getElementById('aqi-breakdown');
            if (detail) { detail.innerHTML = m.detailHtml || '<div class="no-matches">No detail available.</div>'; }
            if (breakdown) { breakdown.innerHTML = m.breakdownHtml || '<div class="aqi-empty">No breakdown for this issue.</div>'; }
        } else if (m.type === 'frameContext') {
            applyFrameContexts(m.contexts || []);
        }
    });
})();
`;
}

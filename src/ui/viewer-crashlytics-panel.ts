/**
 * Crashlytics panel HTML and script for the webview.
 *
 * Displays Firebase Crashlytics issues or setup wizard in a
 * slide-out panel, following the icon-bar panel pattern.
 */

/** Generate the crashlytics panel HTML shell. */
export function getCrashlyticsPanelHtml(): string {
    return /* html */ `
<div id="crashlytics-panel" class="crashlytics-panel">
    <div class="crashlytics-panel-header">
        <span id="cp-header-text">Crashlytics</span>
        <div class="crashlytics-panel-actions">
            <button id="cp-refresh" class="crashlytics-panel-action" title="Refresh">
                <span class="codicon codicon-refresh"></span>
            </button>
            <button id="cp-panel-close" class="crashlytics-panel-close" title="Close">&times;</button>
        </div>
    </div>
    <div class="crashlytics-panel-content">
        <div id="cp-loading" class="crashlytics-loading" style="display:none">Loading Crashlytics data\u2026</div>
        <div id="cp-setup" style="display:none"></div>
        <div id="cp-issues"></div>
        <div id="cp-empty" class="cp-empty" style="display:none">No open Crashlytics issues</div>
        <div id="cp-console" class="cp-console" style="display:none">Open Firebase Console</div>
    </div>
</div>`;
}

/** Generate the crashlytics panel script. */
export function getCrashlyticsPanelScript(): string {
    return /* js */ `
(function() {
    var cpPanelEl = document.getElementById('crashlytics-panel');
    var cpLoadingEl = document.getElementById('cp-loading');
    var cpSetupEl = document.getElementById('cp-setup');
    var cpIssuesEl = document.getElementById('cp-issues');
    var cpEmptyEl = document.getElementById('cp-empty');
    var cpConsoleEl = document.getElementById('cp-console');
    var cpHeaderEl = document.getElementById('cp-header-text');
    var cpPanelOpen = false;

    window.openCrashlyticsPanel = function() {
        if (!cpPanelEl) return;
        cpPanelOpen = true;
        cpPanelEl.classList.add('visible');
        showLoading();
        vscodeApi.postMessage({ type: 'requestCrashlyticsData' });
        vscodeApi.postMessage({ type: 'crashlyticsPanelOpened' });
    };

    window.closeCrashlyticsPanel = function() {
        if (!cpPanelEl) return;
        cpPanelEl.classList.remove('visible');
        cpPanelOpen = false;
        vscodeApi.postMessage({ type: 'crashlyticsPanelClosed' });
        if (typeof clearActivePanel === 'function') clearActivePanel('crashlytics');
    };

    function showLoading() {
        hideAll();
        if (cpLoadingEl) cpLoadingEl.style.display = '';
    }

    function hideAll() {
        if (cpLoadingEl) cpLoadingEl.style.display = 'none';
        if (cpSetupEl) cpSetupEl.style.display = 'none';
        if (cpIssuesEl) cpIssuesEl.innerHTML = '';
        if (cpEmptyEl) cpEmptyEl.style.display = 'none';
        if (cpConsoleEl) cpConsoleEl.style.display = 'none';
    }

    /* ---- Rendering ---- */

    function renderData(ctx) {
        hideAll();
        if (!ctx.available) { renderSetup(ctx); return; }
        if (cpHeaderEl) {
            var note = ctx.refreshNote || '';
            cpHeaderEl.innerHTML = 'Crashlytics' + (note ? ' <span class="cp-refresh-note">' + esc(note) + '</span>' : '');
        }
        if (ctx.issues && ctx.issues.length > 0) {
            if (cpIssuesEl) cpIssuesEl.innerHTML = ctx.issues.map(renderIssue).join('');
        } else if (ctx.diagnosticHtml) {
            if (cpIssuesEl) cpIssuesEl.innerHTML = '<div class="cp-error">Query failed</div>' + ctx.diagnosticHtml;
        } else {
            if (cpEmptyEl) cpEmptyEl.style.display = '';
        }
        if (ctx.consoleUrl && cpConsoleEl) {
            cpConsoleEl.style.display = '';
            cpConsoleEl.setAttribute('data-url', ctx.consoleUrl);
        }
    }

    function renderIssue(issue) {
        var badge = issue.isFatal
            ? '<span class="cp-badge cp-badge-fatal">FATAL</span>'
            : '<span class="cp-badge cp-badge-nonfatal">NON-FATAL</span>';
        var state = issue.state !== 'UNKNOWN'
            ? ' <span class="cp-badge cp-badge-' + issue.state.toLowerCase() + '">' + esc(issue.state) + '</span>' : '';
        var users = issue.userCount > 0
            ? ' \\u00b7 ' + issue.userCount + ' user' + (issue.userCount !== 1 ? 's' : '') : '';
        var ver = formatVersionRange(issue);
        var actions = '<div class="cp-actions">'
            + '<button class="cp-action-btn" data-action="crashlyticsCloseIssue" data-issue="' + esc(issue.id) + '">Close</button>'
            + '<button class="cp-action-btn" data-action="crashlyticsMuteIssue" data-issue="' + esc(issue.id) + '">Mute</button>'
            + '</div>';
        return '<div class="cp-item" data-issue-id="' + esc(issue.id) + '">'
            + '<div class="cp-title">' + badge + state + ' ' + esc(issue.title) + ' <span class="cp-expand-icon">\\u25B6</span></div>'
            + '<div class="cp-meta">' + esc(issue.subtitle) + ' \\u00b7 ' + issue.eventCount + ' events' + users + ver + '</div>'
            + actions
            + '<div class="cp-detail" id="cp-detail-' + esc(issue.id) + '"></div></div>';
    }

    function formatVersionRange(issue) {
        if (!issue.firstVersion && !issue.lastVersion) return '';
        var range = issue.firstVersion && issue.lastVersion && issue.firstVersion !== issue.lastVersion
            ? esc(issue.firstVersion) + ' \\u2192 ' + esc(issue.lastVersion)
            : esc(issue.firstVersion || issue.lastVersion || '');
        return ' \\u00b7 ' + range;
    }

    /* ---- Setup wizard ---- */

    function renderSetup(ctx) {
        if (!cpSetupEl) return;
        var step = ctx.setupStep || 'gcloud';
        var stepNum = step === 'gcloud' ? 1 : step === 'token' ? 2 : 3;
        var content = step === 'gcloud' ? getGcloudStep()
            : step === 'token' ? getTokenStep() : getConfigStep();
        var diagHtml = ctx.diagnosticHtml || '';
        var tip = '<p class="cp-setup-tip">Tip: Google Cloud may prompt you to enable billing, but Crashlytics API access is free.</p>';
        cpSetupEl.innerHTML = '<div class="cp-setup-header">Step ' + stepNum + ' of 3</div>'
            + content + diagHtml + tip
            + '<button class="cp-check-btn" id="cp-check-again">Check Again</button>';
        cpSetupEl.style.display = '';
        wireSetupButtons();
    }

    function getGcloudStep() {
        return '<div class="cp-setup-step"><div class="cp-setup-title">Install Google Cloud CLI</div>'
            + '<p>The <code>gcloud</code> CLI is needed to authenticate with Firebase Crashlytics.</p>'
            + '<a class="cp-setup-link" data-action="openGcloudInstall">Download Google Cloud CLI</a></div>';
    }

    function getTokenStep() {
        return '<div class="cp-setup-step"><div class="cp-setup-title">Sign in to Google Cloud</div>'
            + '<p>Authenticate with your Google account to access Crashlytics data.</p>'
            + '<button class="cp-setup-btn" data-action="crashlyticsRunGcloudAuth">Sign in to Google Cloud</button></div>';
    }

    function getConfigStep() {
        return '<div class="cp-setup-step"><div class="cp-setup-title">Add Firebase Config</div>'
            + '<p>Provide your <code>google-services.json</code> file or configure the project manually.</p>'
            + '<button class="cp-setup-btn" data-action="crashlyticsBrowseGoogleServices">Browse for google-services.json</button>'
            + '<a class="cp-setup-settings" data-action="openCrashlyticsSettings">Or configure in settings</a></div>';
    }

    function wireSetupButtons() {
        var checkBtn = document.getElementById('cp-check-again');
        if (checkBtn) checkBtn.addEventListener('click', function() {
            showLoading();
            vscodeApi.postMessage({ type: 'crashlyticsCheckAgain' });
        });
    }

    /* ---- Click handlers ---- */

    if (cpPanelEl) {
        cpPanelEl.addEventListener('click', function(e) {
            var actionBtn = e.target.closest('.cp-action-btn');
            if (actionBtn) {
                e.stopPropagation();
                vscodeApi.postMessage({ type: actionBtn.dataset.action, issueId: actionBtn.dataset.issue });
                return;
            }
            var setupBtn = e.target.closest('[data-action]');
            if (setupBtn) {
                var action = setupBtn.dataset.action;
                if (action === 'openGcloudInstall') {
                    vscodeApi.postMessage({ type: 'openGcloudInstall' });
                } else if (action === 'openCrashlyticsSettings') {
                    vscodeApi.postMessage({ type: 'openSettings', setting: 'saropaLogCapture.firebase' });
                } else {
                    vscodeApi.postMessage({ type: action });
                }
                return;
            }
            var console = e.target.closest('.cp-console');
            if (console && console.dataset.url) {
                vscodeApi.postMessage({ type: 'openUrl', url: console.dataset.url });
                return;
            }
            var item = e.target.closest('.cp-item');
            if (item) { toggleDetail(item); }
        });
    }

    function toggleDetail(item) {
        var id = item.dataset.issueId;
        var det = document.getElementById('cp-detail-' + id);
        if (!det) return;
        if (det.classList.contains('expanded')) {
            det.classList.remove('expanded');
            item.classList.remove('detail-open');
        } else {
            if (!det.dataset.loaded) {
                det.innerHTML = '<div class="cp-detail-loading">Loading crash details\\u2026</div>';
                det.dataset.loaded = '1';
                vscodeApi.postMessage({ type: 'fetchCrashDetail', issueId: id });
            }
            det.classList.add('expanded');
            item.classList.add('detail-open');
        }
    }

    var refreshBtn = document.getElementById('cp-refresh');
    if (refreshBtn) refreshBtn.addEventListener('click', function() {
        showLoading();
        vscodeApi.postMessage({ type: 'requestCrashlyticsData' });
    });

    /* ---- Close / outside click ---- */

    var closeBtn = document.getElementById('cp-panel-close');
    if (closeBtn) closeBtn.addEventListener('click', closeCrashlyticsPanel);

    document.addEventListener('click', function(e) {
        if (!cpPanelOpen) return;
        if (cpPanelEl && cpPanelEl.contains(e.target)) return;
        var ibBtn = document.getElementById('ib-crashlytics');
        if (ibBtn && (ibBtn === e.target || ibBtn.contains(e.target))) return;
        closeCrashlyticsPanel();
    });

    /* ---- Message listener ---- */

    window.addEventListener('message', function(e) {
        if (!e.data) return;
        if (e.data.type === 'crashlyticsData') { renderData(e.data.context); }
        else if (e.data.type === 'crashDetailReady') {
            var el = document.getElementById('cp-detail-' + e.data.issueId);
            if (el) { el.innerHTML = e.data.html; el.classList.add('expanded'); }
        }
        else if (e.data.type === 'issueActionFailed') {
            /* Could show inline feedback; for now silent */
        }
    });

    function esc(s) { return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
})();
`;
}

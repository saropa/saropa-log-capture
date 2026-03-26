"use strict";
/**
 * Crashlytics panel HTML and script for the webview.
 *
 * Displays Firebase Crashlytics issues or setup wizard in a
 * slide-out panel, following the icon-bar panel pattern.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCrashlyticsPanelHtml = getCrashlyticsPanelHtml;
exports.getCrashlyticsPanelScript = getCrashlyticsPanelScript;
const viewer_crashlytics_setup_1 = require("./viewer-crashlytics-setup");
/** Generate the crashlytics panel HTML shell. */
function getCrashlyticsPanelHtml() {
    return /* html */ `
<div id="crashlytics-panel" class="crashlytics-panel" role="region" aria-label="Crashlytics">
    <div class="crashlytics-panel-header">
        <span id="cp-header-text">Crashlytics</span>
        <div class="crashlytics-panel-actions">
            <button id="cp-refresh" class="crashlytics-panel-action" title="Refresh" aria-label="Refresh Crashlytics">
                <span class="codicon codicon-refresh"></span>
            </button>
            <button id="cp-panel-close" class="crashlytics-panel-close" title="Close" aria-label="Close Crashlytics">&times;</button>
        </div>
    </div>
    <div class="crashlytics-panel-content">
        <div id="cp-loading" class="crashlytics-loading" style="display:none">Loading Crashlytics data\u2026</div>
        <div id="cp-setup" style="display:none"></div>
        <div id="cp-issues"></div>
        <div id="cp-empty" class="cp-empty" style="display:none">No open Crashlytics issues</div>
        <div id="cp-console" class="cp-console" style="display:none">Open Firebase Console</div>
        <details class="cp-help-details"><summary>Help</summary><div id="cp-help-inner"></div></details>
    </div>
</div>`;
}
/** Generate the crashlytics panel script. */
function getCrashlyticsPanelScript() {
    const setupScript = (0, viewer_crashlytics_setup_1.getCrashlyticsSetupScript)();
    return /* js */ `
(function() {
    var cpPanelEl = document.getElementById('crashlytics-panel');
    var cpLoadingEl = document.getElementById('cp-loading');
    var cpSetupEl = document.getElementById('cp-setup');
    var cpIssuesEl = document.getElementById('cp-issues');
    var cpEmptyEl = document.getElementById('cp-empty');
    var cpConsoleEl = document.getElementById('cp-console');
    var cpHelpInnerEl = document.getElementById('cp-help-inner');
    var cpHeaderEl = document.getElementById('cp-header-text');
    var cpPanelOpen = false;

    window.openCrashlyticsPanel = function() {
        if (!cpPanelEl) return;
        cpPanelOpen = true;
        cpPanelEl.classList.add('visible');
        showLoading();
        vscodeApi.postMessage({ type: 'requestCrashlyticsData' });
        vscodeApi.postMessage({ type: 'crashlyticsPanelOpened' });
        requestAnimationFrame(function() {
            var first = cpPanelEl.querySelector('button');
            if (first) first.focus();
        });
    };

    window.closeCrashlyticsPanel = function() {
        if (!cpPanelEl) return;
        cpPanelEl.classList.remove('visible');
        cpPanelOpen = false;
        vscodeApi.postMessage({ type: 'crashlyticsPanelClosed' });
        if (typeof clearActivePanel === 'function') clearActivePanel('crashlytics');
        var ibBtn = document.getElementById('ib-crashlytics');
        if (ibBtn) ibBtn.focus();
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
            // When query fails (e.g. 404), offer to open the config file used for projectId/appId.
            lastDiagnosticCopyText = ctx.diagnosticCopyText || '';
            var openBtn = '<div class="cp-diag-actions"><button class="cp-setup-btn" data-action="crashlyticsOpenGoogleServicesJson">Open google-services.json</button>';
            if (ctx.diagnosticCopyText) openBtn += ' <button class="cp-setup-btn cp-btn-secondary" data-action="crashlyticsCopyDiagnostic">Copy diagnostic</button>';
            openBtn += ' <a class="cp-setup-link cp-show-output" data-action="crashlyticsShowOutput">Show Output</a>';
            if (ctx.consoleUrl) openBtn += ' <a class="cp-setup-link" data-action="openUrl" data-url="' + esc(ctx.consoleUrl) + '">Open Firebase Console</a>';
            openBtn += '</div>';
            if (cpIssuesEl) cpIssuesEl.innerHTML = '<div class="cp-error">Query failed</div>' + ctx.diagnosticHtml + openBtn;
        } else {
            if (cpEmptyEl) cpEmptyEl.style.display = '';
        }
        if (ctx.consoleUrl && cpConsoleEl) {
            cpConsoleEl.style.display = '';
            cpConsoleEl.setAttribute('data-url', ctx.consoleUrl);
        }
        var sections = ctx.helpSections || [];
        if (cpHelpInnerEl) {
            if (sections.length > 0) {
                cpHelpInnerEl.innerHTML = sections.map(function(s) {
                    return '<div class="cp-help-section"><div class="cp-help-section-title">' + esc(s.title) + '</div><div class="cp-help-section-body">' + (s.html || '') + '</div></div>';
                }).join('');
            } else {
                cpHelpInnerEl.innerHTML = '';
            }
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

    ${setupScript}

    var lastDiagnosticCopyText = '';
    function buildDiagnosticActions(ctx) {
        lastDiagnosticCopyText = ctx.diagnosticCopyText || '';
        var parts = [];
        if (ctx.diagnosticCopyText) {
            parts.push('<button class="cp-setup-btn cp-btn-secondary" data-action="crashlyticsCopyDiagnostic">Copy diagnostic</button>');
        }
        parts.push('<a class="cp-setup-link cp-show-output" data-action="crashlyticsShowOutput">Show Output</a>');
        return '<div class="cp-diag-actions-row">' + parts.join(' ') + '</div>';
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
            var copyBtn = e.target.closest('.cp-copy-btn');
            if (copyBtn && copyBtn.dataset.copy) {
                e.stopPropagation();
                vscodeApi.postMessage({ type: 'copyToClipboard', text: copyBtn.dataset.copy });
                return;
            }
            var setupBtn = e.target.closest('[data-action]');
            if (setupBtn) {
                e.preventDefault();
                var action = setupBtn.dataset.action;
                if (action === 'openGcloudInstall') {
                    vscodeApi.postMessage({ type: 'openGcloudInstall' });
                } else if (action === 'openCrashlyticsSettings') {
                    vscodeApi.postMessage({ type: 'openSettings', setting: 'saropaLogCapture.firebase' });
                } else if (action === 'crashlyticsOpenGoogleServicesJson') {
                    vscodeApi.postMessage({ type: 'crashlyticsOpenGoogleServicesJson' });
                } else if (action === 'crashlyticsUseWorkspaceConfig') {
                    showLoading();
                    vscodeApi.postMessage({ type: 'crashlyticsCheckAgain' });
                } else if (action === 'crashlyticsCopyDiagnostic') {
                    vscodeApi.postMessage({ type: 'copyToClipboard', text: lastDiagnosticCopyText });
                } else if (action === 'crashlyticsShowOutput') {
                    vscodeApi.postMessage({ type: 'crashlyticsShowOutput' });
                } else if (action === 'openUrl' && setupBtn.dataset.url) {
                    vscodeApi.postMessage({ type: 'openUrl', url: setupBtn.dataset.url });
                } else if (action === 'openFirebaseConsole') {
                    vscodeApi.postMessage({ type: 'openUrl', url: 'https://console.firebase.google.com/' });
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
//# sourceMappingURL=viewer-crashlytics-panel.js.map
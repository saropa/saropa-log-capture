/**
 * Crashlytics panel HTML and script for the webview.
 *
 * Displays Firebase Crashlytics issues or setup wizard in a
 * slide-out panel, following the icon-bar panel pattern.
 */

import { getCrashlyticsSetupScript } from './viewer-crashlytics-setup';
import { getCrashlyticsInteractionsScript } from './viewer-crashlytics-interactions-script';
import { getCrashlyticsIssueRowScript } from './viewer-crashlytics-issue-row';
import { t } from '../../l10n';

/** Generate the crashlytics panel HTML shell. */
export function getCrashlyticsPanelHtml(): string {
    return /* html */ `
<div id="crashlytics-panel" class="crashlytics-panel" role="region" aria-label="${t('viewer.crashlytics.region')}">
    <div class="crashlytics-panel-header">
        <span id="cp-header-text">${t('viewer.crashlytics.region')}</span>
        <div class="crashlytics-panel-actions">
            <button id="cp-refresh" class="crashlytics-panel-action" title="${t('viewer.crashlytics.refresh.title')}" aria-label="${t('viewer.crashlytics.refresh.label')}">
                <span class="codicon codicon-refresh"></span>
            </button>
            <button id="cp-panel-close" class="crashlytics-panel-close" title="${t('viewer.crashlytics.close.title')}" aria-label="${t('viewer.crashlytics.close.label')}">&times;</button>
        </div>
    </div>
    <div id="cp-filterbar" class="cp-filterbar" style="display:none">
        <div class="cp-tabs">
            <button class="cp-tab cp-tab-sel" data-kind="all" title="${t('viewer.crashlytics.filter.all')}">All</button>
            <button class="cp-tab" data-kind="crash" title="${t('viewer.crashlytics.filter.crash')}">Crash</button>
            <button class="cp-tab" data-kind="anr" title="${t('viewer.crashlytics.filter.anr')}">ANR</button>
            <button class="cp-tab" data-kind="nonfatal" title="${t('viewer.crashlytics.filter.nonfatal')}">NF</button>
        </div>
        <div class="cp-fcontrols">
            <input id="cp-search" class="cp-search" type="text" placeholder="${t('viewer.crashlytics.filter.search')}" aria-label="${t('viewer.crashlytics.filter.search')}">
            <button id="cp-regex" class="cp-regex" type="button" title="${t('viewer.crashlytics.filter.regex')}" aria-label="${t('viewer.crashlytics.filter.regex')}" aria-pressed="false">.*</button>
            <select id="cp-ver" class="cp-fselect" title="${t('viewer.crashlytics.filter.version')}" aria-label="${t('viewer.crashlytics.filter.version')}"><option value="">${t('viewer.crashlytics.filter.verAbbr')}</option></select>
            <select id="cp-reldate" class="cp-fselect" title="${t('viewer.crashlytics.filter.releaseDate')}" aria-label="${t('viewer.crashlytics.filter.releaseDate')}"><option value="">${t('viewer.crashlytics.filter.releaseDateAbbr')}</option></select>
            <select id="cp-dev" class="cp-fselect" title="${t('viewer.crashlytics.filter.device')}" aria-label="${t('viewer.crashlytics.filter.device')}"><option value="">${t('viewer.crashlytics.filter.devAbbr')}</option></select>
            <select id="cp-os" class="cp-fselect" title="${t('viewer.crashlytics.filter.os')}" aria-label="${t('viewer.crashlytics.filter.os')}"><option value="">${t('viewer.crashlytics.filter.osAbbr')}</option></select>
            <select id="cp-sort" class="cp-fselect" title="${t('viewer.crashlytics.sort.label')}" aria-label="${t('viewer.crashlytics.sort.label')}"><option value="events">${t('viewer.crashlytics.sort.events')}</option><option value="users">${t('viewer.crashlytics.sort.users')}</option><option value="reldate">${t('viewer.crashlytics.sort.releaseDate')}</option></select>
            <button id="cp-show-archived" class="cp-regex" type="button" title="${t('viewer.crashlytics.showArchived')}" aria-label="${t('viewer.crashlytics.showArchived')}" aria-pressed="false"><span class="codicon codicon-archive"></span></button>
        </div>
    </div>
    <div class="crashlytics-panel-content">
        <div id="cp-loading" class="crashlytics-loading" style="display:none">${t('viewer.crashlytics.loading')}</div>
        <div id="cp-setup" style="display:none"></div>
        <div id="cp-issues"></div>
        <div id="cp-empty" class="cp-empty" style="display:none">${t('viewer.crashlytics.empty')}</div>
        <div id="cp-console" class="cp-console" style="display:none">${t('viewer.crashlytics.openConsole')}</div>
        <details class="cp-help-details"><summary>${t('viewer.crashlytics.help')}</summary><div id="cp-help-inner"></div></details>
    </div>
</div>`;
}

/** Generate the crashlytics panel script. */
export function getCrashlyticsPanelScript(): string {
    const setupScript = getCrashlyticsSetupScript();
    const interactionsScript = getCrashlyticsInteractionsScript();
    const issueRowScript = getCrashlyticsIssueRowScript();
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
        // Closing the sidebar also restores the log (the in-viewer detail belongs to this panel).
        if (typeof closeIssueDetail === 'function') closeIssueDetail();
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
        var fb = document.getElementById('cp-filterbar');
        if (fb) fb.style.display = 'none';
    }

    /* ---- Rendering ---- */

    function renderData(ctx) {
        hideAll();
        // Store the project console URL so the in-viewer detail can link to it (#3).
        cpConsoleUrl = ctx.consoleUrl || '';
        if (!ctx.available) { renderSetup(ctx); return; }
        if (cpHeaderEl) {
            var note = ctx.refreshNote || '';
            cpHeaderEl.innerHTML = vt('viewer.crashlytics.headerBase') + (note ? ' <span class="cp-refresh-note">' + esc(note) + '</span>' : '');
        }
        if (ctx.issues && ctx.issues.length > 0) {
            if (cpIssuesEl) cpIssuesEl.innerHTML = ctx.issues.map(renderIssue).join('');
            showCpFilters();
            // Lazily fetch per-issue trend sparklines (one extra API query); injected when they arrive.
            vscodeApi.postMessage({ type: 'fetchCrashlyticsTrends' });
        } else if (ctx.diagnosticHtml) {
            // When query fails (e.g. 404), offer to open the config file used for projectId/appId.
            lastDiagnosticCopyText = ctx.diagnosticCopyText || '';
            var openBtn = '<div class="cp-diag-actions"><button class="cp-setup-btn" data-action="crashlyticsOpenGoogleServicesJson">' + vt('viewer.crashlytics.openGsj') + '</button>';
            if (ctx.diagnosticCopyText) openBtn += ' <button class="cp-setup-btn cp-btn-secondary" data-action="crashlyticsCopyDiagnostic">' + vt('viewer.crashlytics.copyDiag') + '</button>';
            openBtn += ' <a class="cp-setup-link cp-show-output" data-action="crashlyticsShowOutput">' + vt('viewer.crashlytics.showOutput') + '</a>';
            if (ctx.consoleUrl) openBtn += ' <a class="cp-setup-link" data-action="openUrl" data-url="' + esc(ctx.consoleUrl) + '">' + vt('viewer.crashlytics.openConsole') + '</a>';
            openBtn += '</div>';
            if (cpIssuesEl) cpIssuesEl.innerHTML = '<div class="cp-error">' + vt('viewer.crashlytics.queryFailed') + '</div>' + ctx.diagnosticHtml + openBtn;
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
        /* Update icon bar badge with Crashlytics issue count. */
        var cpCount = (ctx.issues && ctx.issues.length) ? ctx.issues.length : 0;
        if (typeof updateIconBadge === 'function') updateIconBadge('ib-crashlytics-badge', 'ib-crashlytics-count', cpCount);
    }

    ${issueRowScript}

    ${setupScript}

    var lastDiagnosticCopyText = '';
    function buildDiagnosticActions(ctx) {
        lastDiagnosticCopyText = ctx.diagnosticCopyText || '';
        var parts = [];
        if (ctx.diagnosticCopyText) {
            parts.push('<button class="cp-setup-btn cp-btn-secondary" data-action="crashlyticsCopyDiagnostic">' + vt('viewer.crashlytics.copyDiag') + '</button>');
        }
        parts.push('<a class="cp-setup-link cp-show-output" data-action="crashlyticsShowOutput">' + vt('viewer.crashlytics.showOutput') + '</a>');
        return '<div class="cp-diag-actions-row">' + parts.join(' ') + '</div>';
    }

    /* ---- Click handlers ---- */

    if (cpPanelEl) {
        cpPanelEl.addEventListener('click', function(e) {
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
                } else if (action === 'crashlyticsValidate') {
                    // Immediate feedback so the tap is never silent while the checks run.
                    var rep = document.getElementById('cp-conn-report');
                    if (rep) rep.innerHTML = '<div class="cp-conn-checking">Checking connection\\u2026</div>';
                    vscodeApi.postMessage({ type: 'crashlyticsValidate' });
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
            // Archive / unarchive button: toggle local archive state without opening the detail.
            var archiveBtn = e.target.closest('.cp-archive-btn');
            if (archiveBtn) {
                e.stopPropagation();
                var arItem = archiveBtn.closest('.cp-item');
                if (arItem && arItem.dataset.issueId) {
                    vscodeApi.postMessage({ type: 'crashlyticsArchiveIssue', issueId: arItem.dataset.issueId, title: arItem.dataset.title || '', archived: archiveBtn.dataset.archived !== '1' });
                }
                return;
            }
            // Clicking an issue opens its detail in the viewer's main area (like a session opening in
            // the log viewer) — the list stays in the sidebar, detail renders aside it. No separate tab.
            var item = e.target.closest('.cp-item');
            if (item && item.dataset.issueId) { openIssueDetail(item.dataset.issueId); }
        });
    }

    ${interactionsScript}

    var refreshBtn = document.getElementById('cp-refresh');
    if (refreshBtn) refreshBtn.addEventListener('click', function() {
        showLoading();
        // Refresh forces a fresh fetch; plain open reuses the cache (fast reopen).
        vscodeApi.postMessage({ type: 'crashlyticsCheckAgain' });
    });

    /* ---- Close / outside click ---- */

    var closeBtn = document.getElementById('cp-panel-close');
    if (closeBtn) closeBtn.addEventListener('click', closeCrashlyticsPanel);

    document.addEventListener('click', function(e) {
        if (!cpPanelOpen) return;
        if (cpPanelEl && cpPanelEl.contains(e.target)) return;
        if (cpDetailEl && cpDetailEl.contains(e.target)) return;
        var ibBtn = document.getElementById('ib-crashlytics');
        if (ibBtn && (ibBtn === e.target || ibBtn.contains(e.target))) return;
        closeCrashlyticsPanel();
    });

    /* ---- Message listener ---- */

    window.addEventListener('message', function(e) {
        if (!e.data) return;
        if (e.data.type === 'crashlyticsData') { renderData(e.data.context); }
        else if (e.data.type === 'crashlyticsDetailReady') {
            if (cpDetailEl) cpDetailEl.innerHTML = e.data.html;
            cpDetailMarkdown = e.data.markdown || '';
            cpDetailTitle = e.data.title || 'Issue';
        }
        else if (e.data.type === 'crashlyticsFrameContext') { applyFrameContexts(e.data.contexts || []); }
        else if (e.data.type === 'crashlyticsProjectInsights') { applyProjectInsights(e.data.issueId, e.data.html || ''); }
        else if (e.data.type === 'crashlyticsLogCorrelation') { applyLogCorrelation(e.data.issueId, e.data.html || ''); }
        else if (e.data.type === 'crashlyticsDeviceStates') { applyDeviceStates(e.data.issueId, e.data.html || ''); }
        else if (e.data.type === 'crashlyticsFilterIndex') { applyCpFilterIndex(e.data.index); }
        else if (e.data.type === 'crashlyticsTrends') { applyCpTrends(e.data.trends || {}); }
        else if (e.data.type === 'crashlyticsConnectionReport') {
            if (typeof renderConnectionReport === 'function') renderConnectionReport(e.data.report);
        }
    });

    function esc(s) { return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
})();
`;
}

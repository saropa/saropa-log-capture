"use strict";
/**
 * Crashlytics panel setup wizard rendering functions.
 * Extracted from viewer-crashlytics-panel.ts to stay under the line limit.
 * Returns JS template literal fragments for the IIFE in the crashlytics panel script.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCrashlyticsSetupScript = getCrashlyticsSetupScript;
/** Get the setup wizard JS functions as a template literal fragment. */
function getCrashlyticsSetupScript() {
    return /* js */ `
    /* ---- Setup wizard ---- */

    function renderSetup(ctx) {
        if (!cpSetupEl) return;
        var step = ctx.setupStep || 'gcloud';
        var stepNum = step === 'gcloud' ? 1 : step === 'token' ? 2 : 3;
        var checklistHtml = ctx.setupChecklist ? buildChecklistHtml(ctx.setupChecklist) : '';
        var content = step === 'gcloud' ? getGcloudStep(ctx)
            : step === 'token' ? getTokenStep(ctx) : getConfigStep(ctx);
        var diagHtml = ctx.diagnosticHtml || '';
        var tip = '<p class="cp-setup-tip">Tip: Google Cloud may prompt you to enable billing, but Crashlytics API access is free.</p>';
        var diagActions = (ctx.diagnosticCopyText || ctx.diagnosticHtml) ? buildDiagnosticActions(ctx) : '';
        var consoleUrl = ctx.consoleUrl || 'https://console.firebase.google.com/';
        var openConsole = '<p class="cp-open-console"><a class="cp-setup-link" data-action="openUrl" data-url="' + esc(consoleUrl) + '">Open Firebase Console</a> to verify project or get project/app ID.</p>';
        var forStep = (ctx.troubleshootingForStep || []).length ? buildTroubleshootingForStepHtml(ctx.troubleshootingForStep) : '';
        var fullTable = (ctx.troubleshootingTable || []).length ? buildTroubleshootingCollapsible(ctx.troubleshootingTable) : '';
        cpSetupEl.innerHTML = checklistHtml + '<div class="cp-setup-header">Step ' + stepNum + ' of 3</div>'
            + content + forStep + diagHtml + tip + diagActions + fullTable + openConsole
            + '<button class="cp-check-btn" id="cp-check-again">Check Again</button>';
        cpSetupEl.style.display = '';
        wireSetupButtons();
    }

    function buildChecklistHtml(checklist) {
        var g = checklist.gcloud === 'ok' ? '\\u2713 gcloud' : '\\u2717 gcloud';
        var t = checklist.token === 'ok' ? '\\u2713 token' : checklist.token === 'missing' ? '\\u2717 token' : '\\u25CB token';
        var c = checklist.config === 'ok' ? '\\u2713 config' : checklist.config === 'missing' ? '\\u2717 config' : '\\u25CB config';
        return '<div class="cp-checklist">' + esc(g) + ' \\u00b7 ' + esc(t) + ' \\u00b7 ' + esc(c) + '</div>';
    }

    function buildTroubleTableRows(rows) {
        if (!rows || rows.length === 0) return '';
        return rows.map(function(r) {
            return '<tr><td class="cp-trouble-symptom">' + esc(r.symptom) + '</td><td>' + esc(r.cause) + '</td><td>' + esc(r.fix) + '</td></tr>';
        }).join('');
    }

    function buildTroubleshootingForStepHtml(rows) {
        var body = buildTroubleTableRows(rows);
        if (!body) return '';
        return '<div class="cp-trouble-step"><div class="cp-trouble-step-title">If this doesn\\'t work</div><table class="cp-trouble-table"><tbody>' + body + '</tbody></table></div>';
    }

    function buildTroubleshootingCollapsible(table) {
        var body = buildTroubleTableRows(table);
        if (!body) return '';
        return '<details class="cp-trouble-details"><summary>Troubleshooting</summary><table class="cp-trouble-table"><thead><tr><th>Symptom</th><th>Cause</th><th>Fix</th></tr></thead><tbody>' + body + '</tbody></table></details>';
    }

    function getGcloudStep(ctx) {
        var installCmd = (ctx.gcloudInstallCommand || '').trim();
        var installLine = installCmd
            ? '<p class="cp-install-via">Install via: <code class="cp-install-code">' + esc(installCmd) + '</code>'
            + ' <button class="cp-copy-btn" data-copy="' + esc(installCmd) + '" title="Copy">Copy</button></p>'
            : '';
        var why = '<p class="cp-setup-why">If <code>gcloud</code> is not in PATH after installing, restart the terminal or VS Code.</p>';
        return '<div class="cp-setup-step"><div class="cp-setup-title">Install Google Cloud CLI</div>'
            + '<p>The <code>gcloud</code> CLI is needed to authenticate with Firebase Crashlytics.</p>'
            + installLine
            + '<a class="cp-setup-link" data-action="openGcloudInstall">Download Google Cloud CLI</a>'
            + why + '</div>';
    }

    function getTokenStep(ctx) {
        var authCmd = 'gcloud auth application-default login';
        var externalHint = '<p class="cp-setup-why">If sign-in fails in the VS Code terminal, run the command below in an external terminal (where <code>gcloud</code> is in PATH), then click Check Again.</p>'
            + '<p class="cp-install-via"><code class="cp-install-code">' + esc(authCmd) + '</code>'
            + ' <button class="cp-copy-btn" data-copy="' + esc(authCmd) + '" title="Copy">Copy</button></p>';
        var why = '<p class="cp-setup-why">If you see &quot;Permission denied&quot;, your account needs the Firebase Crashlytics Viewer role on the project.</p>';
        var saHint = '<p class="cp-setup-why">Alternatively, set <code>saropaLogCapture.firebase.serviceAccountKeyPath</code> to a service account JSON key file (e.g. when gcloud is not available).</p>';
        return '<div class="cp-setup-step"><div class="cp-setup-title">Sign in to Google Cloud</div>'
            + '<p>Authenticate with your Google account to access Crashlytics data.</p>'
            + '<button class="cp-setup-btn" data-action="crashlyticsRunGcloudAuth">Sign in to Google Cloud</button>'
            + externalHint + why + saHint + '</div>';
    }

    function getConfigStep(ctx) {
        var workspacePath = (ctx.workspaceGoogleServicesPath || '').trim();
        var useExisting = workspacePath
            ? '<p class="cp-use-existing"><button class="cp-setup-btn" data-action="crashlyticsUseWorkspaceConfig">Use existing file: ' + esc(workspacePath) + '</button></p>'
            : '';
        var why = '<p class="cp-setup-why">Find project ID and app ID in Firebase Console under Project Settings &rarr; General.</p>';
        return '<div class="cp-setup-step"><div class="cp-setup-title">Add Firebase Config</div>'
            + '<p>Provide your <code>google-services.json</code> file or configure the project manually.</p>'
            + useExisting
            + '<button class="cp-setup-btn" data-action="crashlyticsBrowseGoogleServices">Browse for google-services.json</button>'
            + '<a class="cp-setup-settings" data-action="openCrashlyticsSettings">Or configure in settings</a>'
            + why + '</div>';
    }

    function wireSetupButtons() {
        var checkBtn = document.getElementById('cp-check-again');
        if (checkBtn) checkBtn.addEventListener('click', function() {
            showLoading();
            vscodeApi.postMessage({ type: 'crashlyticsCheckAgain' });
        });
    }
`;
}
//# sourceMappingURL=viewer-crashlytics-setup.js.map
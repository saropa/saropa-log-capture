/**
 * Crashlytics panel setup wizard rendering functions.
 * Extracted from viewer-crashlytics-panel.ts to stay under the line limit.
 * Returns JS template literal fragments for the IIFE in the crashlytics panel script.
 *
 * Layout follows the "guide, don't dump" principle (plan 054): a friendly intro,
 * a 3-step progress indicator, one plain-language status line, then the step's
 * primary action. Raw diagnostics and troubleshooting are tucked behind
 * disclosures so a failed setup reads as guidance, not an error wall.
 */

/** Get the setup wizard JS functions as a template literal fragment. */
export function getCrashlyticsSetupScript(): string {
    return /* js */ `
    /* ---- Setup wizard ---- */

    function renderSetup(ctx) {
        if (!cpSetupEl) return;
        var step = ctx.setupStep || 'gcloud';
        var stepNum = step === 'gcloud' ? 1 : step === 'token' ? 2 : 3;
        var content = step === 'gcloud' ? getGcloudStep(ctx)
            : step === 'token' ? getTokenStep(ctx) : getConfigStep(ctx);
        cpSetupEl.innerHTML = buildSetupIntro()
            + buildStepIndicator(stepNum)
            + getStepStatusLine(step)
            + buildConnectionTest()
            + content
            + buildProblemDisclosure(ctx)
            + buildSetupHelp(ctx)
            + '<button class="cp-check-btn" id="cp-check-again">Check Again</button>';
        cpSetupEl.style.display = '';
        wireSetupButtons();
    }

    /* Prominent one-click validator. Runs every prerequisite and renders a per-step pass/fail report
       with a concrete fix for each failure — the "real feedback about failures" users need after a
       setup has failed repeatedly (plan 054). The report fills in via crashlyticsConnectionReport. */
    function buildConnectionTest() {
        return '<div class="cp-conn-test">'
            + '<button class="cp-setup-btn cp-conn-test-btn" data-action="crashlyticsValidate">Test connection</button>'
            + '<div id="cp-conn-report" class="cp-conn-report"></div></div>';
    }

    /* Render the step-by-step connection report into the wizard. Each step shows status, a
       plain-language detail, an actionable fix on failure, and raw output behind a disclosure. */
    function renderConnectionReport(report) {
        var el = document.getElementById('cp-conn-report');
        if (!el) return;
        if (!report || !report.steps || report.steps.length === 0) {
            el.innerHTML = '<div class="cp-conn-checking">Connection check unavailable — see the Saropa Log Capture output channel.</div>';
            return;
        }
        var banner = report.ok
            ? '<div class="cp-conn-ok">\\u2713 Connected</div>'
            : '<div class="cp-conn-bad">\\u2717 Not connected yet — fix the steps marked below.</div>';
        el.innerHTML = banner + report.steps.map(renderConnectionStep).join('');
    }

    function renderConnectionStep(s) {
        var icon = s.status === 'pass' ? '\\u2713' : s.status === 'fail' ? '\\u2717' : '\\u25CB';
        var fix = s.fix ? '<div class="cp-conn-fix">' + esc(s.fix) + '</div>' : '';
        var tech = s.technical ? '<details class="cp-conn-tech"><summary>Details</summary><pre>' + esc(s.technical) + '</pre></details>' : '';
        return '<div class="cp-conn-step cp-conn-' + esc(s.status) + '">'
            + '<div class="cp-conn-head"><span class="cp-conn-icon">' + icon + '</span><span class="cp-conn-label">' + esc(s.label) + '</span></div>'
            + '<div class="cp-conn-detail">' + esc(s.detail) + '</div>' + fix + tech + '</div>';
    }

    /* One friendly sentence of purpose. Second-person voice, no first person (USER_COPY_AND_TONE). */
    function buildSetupIntro() {
        return '<div class="cp-setup-intro">Connect Firebase Crashlytics to triage your crashes without leaving the editor.</div>';
    }

    /* 3-step progress: completed steps fill green, the current step highlights, later steps stay muted.
       Replaces the old "Step N of 3" + symbol checklist with one scannable row. */
    function buildStepIndicator(stepNum) {
        function dot(n, label) {
            var cls = n < stepNum ? 'done' : n === stepNum ? 'active' : 'todo';
            var mark = n < stepNum ? '\\u2713' : String(n);
            return '<span class="cp-step cp-step-' + cls + '"><span class="cp-step-num">' + mark + '</span>' + label + '</span>';
        }
        return '<div class="cp-steps">' + dot(1, 'Install') + dot(2, 'Sign in') + dot(3, 'Project') + '</div>';
    }

    /* Plain-language state derived from the step, not the raw diagnostic — robust even when the
       underlying gcloud message is unfriendly (see bug_008). */
    function getStepStatusLine(step) {
        var msg = step === 'gcloud' ? 'Google Cloud access is not set up yet.'
            : step === 'token' ? 'Not signed in to Google Cloud yet.'
            : 'Firebase project is not configured yet.';
        return '<div class="cp-setup-status">' + msg + '</div>';
    }

    /* Collapsed "What went wrong?" — keeps the raw diagnostic and step-specific troubleshooting
       available without making them the first thing the user sees. */
    function buildProblemDisclosure(ctx) {
        var diag = ctx.diagnosticHtml || '';
        var forStep = (ctx.troubleshootingForStep || []).length ? buildTroubleshootingForStepHtml(ctx.troubleshootingForStep) : '';
        var actions = (ctx.diagnosticCopyText || ctx.diagnosticHtml) ? buildDiagnosticActions(ctx) : '';
        if (!diag && !forStep && !actions) return '';
        return '<details class="cp-problem"><summary>What went wrong?</summary>'
            + '<div class="cp-problem-body">' + diag + forStep + actions + '</div></details>';
    }

    /* Collapsed help: billing note, full troubleshooting table, and the console link. */
    function buildSetupHelp(ctx) {
        var tip = '<p class="cp-setup-tip">Google Cloud may prompt you to enable billing, but Crashlytics API access is free.</p>';
        var fullTable = (ctx.troubleshootingTable || []).length ? buildTroubleshootingCollapsible(ctx.troubleshootingTable) : '';
        var consoleUrl = ctx.consoleUrl || 'https://console.firebase.google.com/';
        var openConsole = '<p class="cp-open-console"><a class="cp-setup-link" data-action="openUrl" data-url="' + esc(consoleUrl) + '">Open Firebase Console</a> to verify the project or copy the project / app ID.</p>';
        return tip + fullTable + openConsole;
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

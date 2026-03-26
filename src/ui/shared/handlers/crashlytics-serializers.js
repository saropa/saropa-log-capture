"use strict";
/**
 * Crashlytics Serializers
 *
 * Functions for serializing Firebase context and building diagnostic HTML.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.serializeContext = serializeContext;
exports.buildDiagnosticHtml = buildDiagnosticHtml;
const ansi_1 = require("../../../modules/capture/ansi");
const crashlytics_troubleshooting_1 = require("../../../modules/crashlytics/crashlytics-troubleshooting");
const crashlytics_help_content_1 = require("../../../modules/crashlytics/crashlytics-help-content");
/** Build plain-text diagnostic for copy/paste (support ticket or run in terminal). Includes step, message, optional technical details, and hints (e.g. gcloud test command, proxy note). */
function buildDiagnosticCopyText(ctx) {
    const d = ctx.diagnostics;
    if (!d) {
        return ctx.setupHint ?? 'Crashlytics connection failed.';
    }
    const lines = [
        `Step: ${d.step}`,
        `Message: ${d.message}`,
    ];
    if (d.technicalDetails) {
        lines.push('', 'Technical details:', d.technicalDetails);
    }
    if (d.httpStatus) {
        lines.push('', `HTTP status: ${d.httpStatus}`);
    }
    if (d.step === 'token' || d.step === 'gcloud') {
        lines.push('', 'To test in a terminal:', '  gcloud auth application-default print-access-token');
    }
    if (d.step === 'gcloud') {
        lines.push('', 'If that fails, install gcloud first: https://docs.cloud.google.com/sdk/docs/install-sdk');
    }
    if (d.errorType === 'timeout' || d.errorType === 'network') {
        lines.push('', 'If you\'re behind a proxy or VPN, try from a different network or configure gcloud proxy.');
    }
    return lines.join('\n');
}
function serializeContext(ctx, extras) {
    const diagnosticHtml = buildDiagnosticHtml(ctx);
    const refreshNote = ctx.queriedAt ? (0, ansi_1.formatElapsedLabel)(ctx.queriedAt) : '';
    const diagnosticCopyText = buildDiagnosticCopyText(ctx);
    const setupChecklist = ctx.setupChecklist;
    const setupStep = ctx.setupStep;
    // In-panel troubleshooting and help (no external doc): table + step-specific rows + full help sections.
    const troubleshootingTable = crashlytics_troubleshooting_1.CRASHLYTICS_TROUBLESHOOTING_TABLE.map(r => ({
        symptom: r.symptom,
        cause: r.cause,
        fix: r.fix,
    }));
    const troubleshootingForStep = setupStep && !ctx.available
        ? (0, crashlytics_troubleshooting_1.getTroubleshootingRowsForStep)(setupStep).map(r => ({ symptom: r.symptom, cause: r.cause, fix: r.fix }))
        : [];
    return {
        available: ctx.available,
        setupStep,
        setupChecklist: setupChecklist ? { gcloud: setupChecklist.gcloud, token: setupChecklist.token, config: setupChecklist.config } : undefined,
        issues: ctx.issues.map(i => ({
            id: i.id, title: i.title, subtitle: i.subtitle,
            isFatal: i.isFatal, state: i.state,
            eventCount: i.eventCount, userCount: i.userCount,
            firstVersion: i.firstVersion, lastVersion: i.lastVersion,
        })),
        consoleUrl: ctx.consoleUrl,
        diagnosticHtml,
        diagnosticCopyText,
        refreshNote,
        gcloudInstallCommand: extras?.gcloudInstallCommand ?? '',
        workspaceGoogleServicesPath: extras?.workspaceGoogleServicesPath ?? '',
        troubleshootingTable,
        troubleshootingForStep,
        helpSections: (0, crashlytics_help_content_1.getCrashlyticsHelpSections)().map(s => ({ title: s.title, html: s.html })),
    };
}
function buildDiagnosticHtml(ctx) {
    const d = ctx.diagnostics;
    if (!d) {
        return '';
    }
    const tech = d.technicalDetails
        ? `<details class="cp-diag-tech"><summary>Technical details</summary><pre>${(0, ansi_1.escapeHtml)(d.technicalDetails)}</pre></details>` : '';
    const status = d.httpStatus ? `<div class="cp-diag-status">HTTP ${d.httpStatus}</div>` : '';
    const time = `<div class="cp-diag-time">Last checked: ${(0, ansi_1.formatElapsedLabel)(d.checkedAt)}</div>`;
    return `<div class="cp-diag-box"><div class="cp-diag-msg">${(0, ansi_1.escapeHtml)(d.message)}</div>${status}${tech}${time}</div>`;
}
//# sourceMappingURL=crashlytics-serializers.js.map
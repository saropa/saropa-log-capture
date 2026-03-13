/**
 * Crashlytics Serializers
 *
 * Functions for serializing Firebase context and building diagnostic HTML.
 */

import { escapeHtml, formatElapsedLabel } from '../../../modules/capture/ansi';
import type { FirebaseContext } from '../../../modules/crashlytics/firebase-crashlytics';

export interface SerializeContextExtras {
    /** OS-specific install one-liner for gcloud (e.g. winget on Windows). */
    gcloudInstallCommand?: string;
    /** Relative path to workspace google-services.json when config step and file exists. */
    workspaceGoogleServicesPath?: string;
}

/** Build plain-text diagnostic for copy/paste (support ticket or run in terminal). Includes step, message, optional technical details, and hints (e.g. gcloud test command, proxy note). */
function buildDiagnosticCopyText(ctx: FirebaseContext): string {
    const d = ctx.diagnostics;
    if (!d) { return ctx.setupHint ?? 'Crashlytics connection failed.'; }
    const lines: string[] = [
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

export function serializeContext(ctx: FirebaseContext, extras?: SerializeContextExtras): Record<string, unknown> {
    const diagnosticHtml = buildDiagnosticHtml(ctx);
    const refreshNote = ctx.queriedAt ? formatElapsedLabel(ctx.queriedAt) : '';
    const diagnosticCopyText = buildDiagnosticCopyText(ctx);
    const setupChecklist = ctx.setupChecklist;
    return {
        available: ctx.available,
        setupStep: ctx.setupStep,
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
    };
}

export function buildDiagnosticHtml(ctx: FirebaseContext): string {
    const d = ctx.diagnostics;
    if (!d) { return ''; }
    const tech = d.technicalDetails
        ? `<details class="cp-diag-tech"><summary>Technical details</summary><pre>${escapeHtml(d.technicalDetails)}</pre></details>` : '';
    const status = d.httpStatus ? `<div class="cp-diag-status">HTTP ${d.httpStatus}</div>` : '';
    const time = `<div class="cp-diag-time">Last checked: ${formatElapsedLabel(d.checkedAt)}</div>`;
    return `<div class="cp-diag-box"><div class="cp-diag-msg">${escapeHtml(d.message)}</div>${status}${tech}${time}</div>`;
}

/**
 * Crashlytics Serializers
 *
 * Functions for serializing Firebase context and building diagnostic HTML.
 */

import { escapeHtml, formatElapsedLabel } from '../../../modules/capture/ansi';
import type { FirebaseContext } from '../../../modules/crashlytics/firebase-crashlytics';

export function serializeContext(ctx: FirebaseContext): Record<string, unknown> {
    const diagnosticHtml = buildDiagnosticHtml(ctx);
    const refreshNote = ctx.queriedAt ? formatElapsedLabel(ctx.queriedAt) : '';
    return {
        available: ctx.available,
        setupStep: ctx.setupStep,
        issues: ctx.issues.map(i => ({
            id: i.id, title: i.title, subtitle: i.subtitle,
            isFatal: i.isFatal, state: i.state,
            eventCount: i.eventCount, userCount: i.userCount,
            firstVersion: i.firstVersion, lastVersion: i.lastVersion,
        })),
        consoleUrl: ctx.consoleUrl,
        diagnosticHtml,
        refreshNote,
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

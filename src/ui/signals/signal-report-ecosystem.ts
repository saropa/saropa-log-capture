/**
 * Ecosystem section for the signal report — shows Drift Advisor and Saropa Lints
 * status and data when available, or install prompts when the extensions are missing.
 *
 * Runs host-side so it can check extension installation via vscode.extensions.
 */

import * as vscode from 'vscode';
import { escapeHtml } from '../../modules/capture/ansi';
import { buildItemUrl } from '../../modules/marketplace-url';
import { DRIFT_ADVISOR_EXTENSION_ID } from '../../modules/integrations/drift-advisor-constants';
import { SAROPA_LINTS_EXTENSION_ID } from '../../modules/misc/saropa-lints-api';
import type { RootCauseHintBundle } from '../../modules/root-cause-hints/root-cause-hint-types';

/** Whether the current workspace looks like a Drift (SQLite) project. */
function isDriftProject(bundle: RootCauseHintBundle): boolean {
    // If the bundle has any SQL signals, it's a Drift project
    const hasSql = (bundle.sqlBursts?.length ?? 0) > 0
        || (bundle.nPlusOneHints?.length ?? 0) > 0
        || (bundle.fingerprintLeaders?.length ?? 0) > 0;
    if (hasSql) { return true; }
    // If Drift Advisor already contributed data, it's a Drift project
    if (bundle.driftAdvisorSummary && bundle.driftAdvisorSummary.issueCount > 0) {
        return true;
    }
    return false;
}

/** Build a clickable install prompt for a missing extension. */
function installPromptHtml(label: string, extensionId: string, benefit: string): string {
    const url = escapeHtml(buildItemUrl(extensionId));
    return `<div class="ecosystem-prompt">
        <span class="ecosystem-prompt-label">${escapeHtml(label)} is not installed.</span>
        <span class="ecosystem-prompt-benefit">${escapeHtml(benefit)}</span>
        <a class="ecosystem-prompt-link" data-url="${url}" href="#">Install from Marketplace</a>
    </div>`;
}

/** Build a data summary row when an extension IS installed and has data. */
function dataRow(label: string, value: string): string {
    return `<div class="ecosystem-data-row">` +
        `<span class="ecosystem-data-label">${escapeHtml(label)}</span>` +
        `<span class="ecosystem-data-value">${escapeHtml(value)}</span>` +
        `</div>`;
}

/** Build the Drift Advisor portion of the ecosystem section. */
function buildDriftHtml(bundle: RootCauseHintBundle): string {
    const isDrift = isDriftProject(bundle);
    // Only show the Drift section if it looks like a Drift project
    if (!isDrift) { return ''; }

    const ext = vscode.extensions.getExtension(DRIFT_ADVISOR_EXTENSION_ID);
    if (!ext) {
        return installPromptHtml(
            'Saropa Drift Advisor',
            DRIFT_ADVISOR_EXTENSION_ID,
            'Adds schema health, query stats, index suggestions, and anomaly detection to your signal reports.',
        );
    }

    // Extension installed — show summary from bundle if available
    const da = bundle.driftAdvisorSummary;
    if (!da || da.issueCount <= 0) {
        return `<div class="ecosystem-status">` +
            `<span class="ecosystem-status-icon">\u2713</span>` +
            `<span>Drift Advisor connected \u2014 no issues detected this session.</span>` +
            `</div>`;
    }
    const parts: string[] = [];
    parts.push(dataRow('Issues found', String(da.issueCount)));
    if (da.topRuleId) {
        parts.push(dataRow('Top rule', da.topRuleId));
    }
    return `<div class="ecosystem-data">${parts.join('')}</div>`;
}

/** Build the Saropa Lints portion of the ecosystem section. */
function buildLintsHtml(): string {
    const ext = vscode.extensions.getExtension(SAROPA_LINTS_EXTENSION_ID);
    if (!ext) {
        return installPromptHtml(
            'Saropa Lints',
            SAROPA_LINTS_EXTENSION_ID,
            'Adds lint violations, OWASP summaries, and health scores to bug reports generated from signal context.',
        );
    }

    // Extension installed — try to get a quick summary
    const api = ext.isActive ? ext.exports : undefined;
    if (!api || typeof api.getViolationsData !== 'function') {
        // Extension installed but not active or no API — still show connected status
        return `<div class="ecosystem-status">` +
            `<span class="ecosystem-status-icon">\u2713</span>` +
            `<span>Saropa Lints installed.</span>` +
            `</div>`;
    }

    const data = api.getViolationsData();
    const total = data?.summary?.totalViolations ?? 0;
    if (total <= 0) {
        return `<div class="ecosystem-status">` +
            `<span class="ecosystem-status-icon">\u2713</span>` +
            `<span>Saropa Lints connected \u2014 no violations detected.</span>` +
            `</div>`;
    }

    const tier = data?.config?.tier ?? 'unknown';
    const byImpact = data?.summary?.byImpact;
    const critical = (byImpact?.critical ?? 0) + (byImpact?.high ?? 0);
    const parts: string[] = [];
    parts.push(dataRow('Total violations', String(total)));
    parts.push(dataRow('Analysis tier', tier));
    if (critical > 0) {
        parts.push(dataRow('Critical + High', String(critical)));
    }
    return `<div class="ecosystem-data">${parts.join('')}</div>`;
}

/**
 * Build the full ecosystem section HTML.
 * Shows Drift Advisor (only for Drift projects) and Saropa Lints (always).
 * Each sub-section shows data when the extension is installed, or an install prompt.
 */
export function buildEcosystemHtml(bundle: RootCauseHintBundle): string {
    const driftHtml = buildDriftHtml(bundle);
    // Lints section always returns content (install prompt or connected status)
    const lintsHtml = buildLintsHtml();

    const parts: string[] = [];
    if (driftHtml) {
        parts.push(`<div class="ecosystem-block">` +
            `<div class="ecosystem-block-heading">Drift Advisor</div>` +
            `${driftHtml}</div>`);
    }
    parts.push(`<div class="ecosystem-block">` +
        `<div class="ecosystem-block-heading">Saropa Lints</div>` +
        `${lintsHtml}</div>`);
    return parts.join('');
}

/** Build Drift Advisor markdown lines for export. */
function buildDriftMarkdownLines(bundle: RootCauseHintBundle): string[] {
    if (!isDriftProject(bundle)) { return []; }
    const ext = vscode.extensions.getExtension(DRIFT_ADVISOR_EXTENSION_ID);
    if (!ext) {
        return ['### Drift Advisor', '', '*Not installed.* Install from Marketplace for schema health and query diagnostics.', ''];
    }
    const da = bundle.driftAdvisorSummary;
    if (!da || da.issueCount <= 0) { return []; }
    const out = ['### Drift Advisor', '', `- **Issues found:** ${da.issueCount}`];
    if (da.topRuleId) { out.push(`- **Top rule:** ${da.topRuleId}`); }
    out.push('');
    return out;
}

/** Build Saropa Lints markdown lines for export. */
function buildLintsMarkdownLines(): string[] {
    const ext = vscode.extensions.getExtension(SAROPA_LINTS_EXTENSION_ID);
    if (!ext) {
        return ['### Saropa Lints', '', '*Not installed.* Install from Marketplace for lint analysis in bug reports.', ''];
    }
    const api = ext.isActive ? ext.exports : undefined;
    if (!api || typeof api.getViolationsData !== 'function') { return []; }
    const data = api.getViolationsData();
    const total = data?.summary?.totalViolations ?? 0;
    if (total <= 0) { return []; }
    return ['### Saropa Lints', '', `- **Total violations:** ${total}`, `- **Tier:** ${data?.config?.tier ?? 'unknown'}`, ''];
}

/** Build ecosystem section as markdown for export. */
export function buildEcosystemMarkdown(bundle: RootCauseHintBundle): string {
    const lines = [...buildDriftMarkdownLines(bundle), ...buildLintsMarkdownLines()];
    if (lines.length === 0) { return ''; }
    return ['## Companion Extensions', '', ...lines].join('\n');
}

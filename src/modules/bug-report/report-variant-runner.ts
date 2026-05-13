/**
 * Variant runner: collects the same data the full report uses, then routes to a compact formatter.
 *
 * Why a separate runner instead of inlining into the command: the full-report path writes to disk
 * and opens the file in an editor. Variants go to clipboard. The runner shares the data-collection
 * step (the expensive part — git history, lint enrichment, cross-session match) and lets each
 * variant choose its own output format and destination.
 */

import * as vscode from 'vscode';
import { collectBugReportData } from './bug-report-collector';
import type { ReportFileData } from './report-file-formatter';
import { formatGitHubIssue, formatHandoffBundle } from './report-file-variants';

export type ReportVariant = 'github-issue' | 'handoff-bundle';

export interface VariantRunParams {
    readonly variant: ReportVariant;
    readonly fileUri: vscode.Uri;
    readonly extensionContext?: vscode.ExtensionContext;
}

/** Collect data, format with the chosen variant, return markdown. Throws on collection failure. */
export async function collectAndFormatVariant(params: VariantRunParams): Promise<string> {
    /* Use an empty errorText / lineIndex like the existing "createReportFile" command does — the
       collector handles both selection-anchored and session-wide invocations. */
    const data = await collectBugReportData('', 0, params.fileUri, params.extensionContext);

    const reportData: ReportFileData = {
        selectedText: '',
        selectedLineStart: 0,
        selectedLineEnd: 0,
        sessionInfo: {},
        fullOutput: '',
        fullOutputLineCount: 0,
        bugReportData: data,
        extensionVersion: getExtensionVersion(params.extensionContext),
        vsCodeVersion: vscode.version,
        os: `${process.platform} ${process.arch}`,
    };

    if (params.variant === 'github-issue') {
        return formatGitHubIssue(reportData);
    }
    return formatHandoffBundle(reportData);
}

function getExtensionVersion(ctx?: vscode.ExtensionContext): string {
    if (ctx?.extension?.packageJSON?.version) {
        return `v${ctx.extension.packageJSON.version}`;
    }
    const ext = vscode.extensions.getExtension('Saropa.saropa-log-capture');
    return ext?.packageJSON?.version ? `v${ext.packageJSON.version}` : 'unknown';
}

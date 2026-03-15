/**
 * Bug report file creation orchestrator.
 *
 * Collects analysis data, extracts keywords, formats the report,
 * writes the file to the configured folder, and opens it in the editor.
 */

import * as vscode from 'vscode';
import { t } from '../../l10n';
import { getReportFolderUri } from '../config/config';
import { collectBugReportData } from './bug-report-collector';
import { extractKeywords } from './report-file-keywords';
import { formatReportFile, type ReportFileData } from './report-file-formatter';

/** Parameters for creating a bug report file. */
export interface CreateReportFileParams {
    readonly selectedText: string;
    readonly selectedLineStart: number;
    readonly selectedLineEnd: number;
    readonly sessionInfo: Record<string, string>;
    readonly fullDecoratedOutput: string;
    readonly fullOutputLineCount: number;
    readonly fileUri: vscode.Uri;
    readonly errorText: string;
    readonly lineIndex: number;
    readonly extensionContext?: vscode.ExtensionContext;
}

/** Create a bug report file and open it in the editor. */
export async function createBugReportFile(params: CreateReportFileParams): Promise<void> {
    const data = await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: 'Creating Bug Report File', cancellable: false },
        async (progress) => {
            progress.report({ message: 'Collecting error context...' });
            return collectBugReportData(params.errorText, params.lineIndex, params.fileUri, params.extensionContext);
        },
    );

    const reportData: ReportFileData = {
        selectedText: params.selectedText,
        selectedLineStart: params.selectedLineStart,
        selectedLineEnd: params.selectedLineEnd,
        sessionInfo: params.sessionInfo,
        fullOutput: params.fullDecoratedOutput,
        fullOutputLineCount: params.fullOutputLineCount,
        bugReportData: data,
        extensionVersion: getExtensionVersion(params.extensionContext),
        vsCodeVersion: vscode.version,
        os: `${process.platform} ${process.arch}`,
    };

    const markdown = formatReportFile(reportData);
    const keywords = extractKeywords(params.selectedText || params.errorText);
    const filename = buildFilename(keywords);
    const folderUri = getReportFolderUri(vscode.workspace.workspaceFolders?.[0]);

    await vscode.workspace.fs.createDirectory(folderUri);
    const fileUri = vscode.Uri.joinPath(folderUri, filename);
    await vscode.workspace.fs.writeFile(fileUri, Buffer.from(markdown, 'utf-8'));

    const doc = await vscode.workspace.openTextDocument(fileUri);
    await vscode.window.showTextDocument(doc);
    vscode.window.showInformationMessage(t('msg.reportFileCreated', filename));
}

function buildFilename(keywords: readonly string[]): string {
    const d = new Date();
    const p = (n: number): string => String(n).padStart(2, '0');
    const ts = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
    const kw = keywords.length > 0 ? '_' + keywords.join('_') : '';
    return `${ts}_saropa_log_capture_report${kw}.md`;
}

function getExtensionVersion(ctx?: vscode.ExtensionContext): string {
    if (ctx?.extension?.packageJSON?.version) {
        return `v${ctx.extension.packageJSON.version}`;
    }
    const ext = vscode.extensions.getExtension('Saropa.saropa-log-capture');
    return ext?.packageJSON?.version ? `v${ext.packageJSON.version}` : 'unknown';
}

/**
 * Bug report preview panel.
 *
 * Singleton WebviewPanel that shows a styled preview of the generated
 * markdown bug report, with buttons to copy or save the raw markdown.
 */

import * as vscode from 'vscode';
import { escapeHtml } from '../modules/ansi';
import { collectBugReportData } from '../modules/bug-report-collector';
import { formatBugReport } from '../modules/bug-report-formatter';
import { getBugReportStyles } from './bug-report-panel-styles';

let panel: vscode.WebviewPanel | undefined;
let lastMarkdown = '';

/** Generate a bug report and show it in the preview panel. */
export async function showBugReport(
    errorText: string, lineIndex: number, fileUri: vscode.Uri,
): Promise<void> {
    ensurePanel();
    panel!.webview.html = buildLoadingHtml();
    const data = await collectBugReportData(errorText, lineIndex, fileUri);
    lastMarkdown = formatBugReport(data);
    if (panel) { panel.webview.html = buildPreviewHtml(lastMarkdown); }
    await vscode.env.clipboard.writeText(lastMarkdown);
    vscode.window.showInformationMessage('Bug report copied to clipboard.');
}

/** Dispose the singleton panel. */
export function disposeBugReportPanel(): void { panel?.dispose(); panel = undefined; }

function ensurePanel(): void {
    if (panel) { panel.reveal(vscode.ViewColumn.Beside); return; }
    panel = vscode.window.createWebviewPanel(
        'saropaLogCapture.bugReport', 'Bug Report',
        vscode.ViewColumn.Beside, { enableScripts: true, localResourceRoots: [] },
    );
    panel.webview.onDidReceiveMessage(handleMessage);
    panel.onDidDispose(() => { panel = undefined; });
}

async function handleMessage(msg: Record<string, unknown>): Promise<void> {
    if (msg.type === 'copy') {
        await vscode.env.clipboard.writeText(lastMarkdown);
        vscode.window.showInformationMessage('Bug report copied to clipboard.');
    } else if (msg.type === 'save') {
        const uri = await vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.file('bug-report.md'),
            filters: { 'Markdown': ['md'], 'All Files': ['*'] },
        });
        if (uri) {
            await vscode.workspace.fs.writeFile(uri, Buffer.from(lastMarkdown, 'utf-8'));
            vscode.window.showInformationMessage(`Report saved to ${uri.fsPath.split(/[\\/]/).pop()}`);
        }
    }
}

function getNonce(): string {
    const c = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let r = ''; for (let i = 0; i < 32; i++) { r += c[Math.floor(Math.random() * c.length)]; } return r;
}

function buildLoadingHtml(): string {
    const nonce = getNonce();
    return `<!DOCTYPE html><html><head>
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
<style nonce="${nonce}">${getBugReportStyles()}</style>
</head><body><div class="loading">Generating bug report...</div></body></html>`;
}

function buildPreviewHtml(markdown: string): string {
    const nonce = getNonce();
    const html = markdownToHtml(markdown);
    return `<!DOCTYPE html><html><head>
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
<style nonce="${nonce}">${getBugReportStyles()}</style>
</head><body>
<div class="toolbar">
<button id="copy-btn">Copy to Clipboard</button>
<button id="save-btn">Save to File</button>
</div>
${html}
<script nonce="${nonce}">${getScript()}</script>
</body></html>`;
}

function markdownToHtml(md: string): string {
    return md
        .replace(/^# (.+)$/gm, '<h1>$1</h1>')
        .replace(/^## (.+)$/gm, '<h2>$1</h2>')
        .replace(/^---$/gm, '<hr>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/^- (.+)$/gm, '<li>$1</li>')
        .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
        .replace(/\|(.+)\|\n\|[-| ]+\|\n((?:\|.+\|\n?)*)/g, convertTable)
        .replace(/```\n([\s\S]*?)```/g, (_, code) => `<pre>${escapeHtml(code.trimEnd())}</pre>`)
        .replace(/\n{2,}/g, '\n')
        .replace(/^(?!<[huplo]|<\/|<li|<hr|<str|<em|<cod)(.+)$/gm, '<p>$1</p>');
}

function convertTable(_: string, header: string, body: string): string {
    const headerCells = header.split('|').filter(c => c.trim()).map(c => `<th>${c.trim()}</th>`);
    const rows = body.trim().split('\n').map(row => {
        const cells = row.split('|').filter(c => c.trim()).map(c => `<td>${c.trim()}</td>`);
        return `<tr>${cells.join('')}</tr>`;
    });
    return `<table><thead><tr>${headerCells.join('')}</tr></thead><tbody>${rows.join('')}</tbody></table>`;
}

function getScript(): string {
    return `(function() {
    var vscode = acquireVsCodeApi();
    document.getElementById('copy-btn').addEventListener('click', function() { vscode.postMessage({ type: 'copy' }); });
    document.getElementById('save-btn').addEventListener('click', function() { vscode.postMessage({ type: 'save' }); });
})();`;
}

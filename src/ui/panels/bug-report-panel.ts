/**
 * Bug report preview panel.
 *
 * Singleton WebviewPanel that shows a styled preview of the generated
 * markdown bug report, with buttons to copy or save the raw markdown.
 */

import * as vscode from 'vscode';
import { t } from '../../l10n';
import { escapeHtml } from '../../modules/capture/ansi';
import { collectBugReportData } from '../../modules/bug-report/bug-report-collector';
import { formatBugReport } from '../../modules/bug-report/bug-report-formatter';
import { getBugReportStyles } from './bug-report-panel-styles';

let panel: vscode.WebviewPanel | undefined;
let lastMarkdown = '';
let lastSubject = '';

/** Generate a bug report and show it in the preview panel. */
export async function showBugReport(
    errorText: string, lineIndex: number, fileUri: vscode.Uri,
    extensionContext?: vscode.ExtensionContext,
): Promise<void> {
    ensurePanel();
    panel!.webview.html = buildLoadingHtml();
    const data = await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: 'Generating Bug Report', cancellable: false },
        async (progress) => {
            progress.report({ message: 'Collecting error context...' });
            return collectBugReportData(errorText, lineIndex, fileUri, extensionContext);
        },
    );
    lastMarkdown = formatBugReport(data);
    lastSubject = deriveSubject(data.errorLine, data.fingerprint);
    if (panel) { panel.webview.html = buildPreviewHtml(lastMarkdown); }
    await vscode.env.clipboard.writeText(lastMarkdown);
    vscode.window.showInformationMessage(t('msg.bugReportCopied'));
}

/** Show the bug report panel with pre-built markdown (e.g. from investigation context). */
export function showBugReportFromMarkdown(markdown: string): void {
    ensurePanel();
    lastMarkdown = markdown;
    lastSubject = 'investigation';
    if (panel) { panel.webview.html = buildPreviewHtml(lastMarkdown); }
    vscode.env.clipboard.writeText(lastMarkdown);
    vscode.window.showInformationMessage(t('msg.bugReportCopied'));
}

/** Dispose the singleton panel. */
export function disposeBugReportPanel(): void { panel?.dispose(); panel = undefined; }

function ensurePanel(): void {
    if (panel) { panel.reveal(); return; }
    panel = vscode.window.createWebviewPanel(
        'saropaLogCapture.bugReport', 'Saropa Bug Report',
        vscode.ViewColumn.Beside, { enableScripts: true, localResourceRoots: [] },
    );
    panel.webview.onDidReceiveMessage(handleMessage);
    panel.onDidDispose(() => { panel = undefined; });
}

async function handleMessage(msg: Record<string, unknown>): Promise<void> {
    if (msg.type === 'copy') {
        await vscode.env.clipboard.writeText(lastMarkdown);
        vscode.window.showInformationMessage(t('msg.bugReportCopied'));
    } else if (msg.type === 'save') {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        const defaultUri = workspaceFolder
            ? vscode.Uri.joinPath(workspaceFolder.uri, buildDefaultFilename())
            : vscode.Uri.file(buildDefaultFilename());
        const uri = await vscode.window.showSaveDialog({
            defaultUri,
            filters: { 'Markdown': ['md'], 'All Files': ['*'] },
        });
        if (uri) {
            await vscode.workspace.fs.writeFile(uri, Buffer.from(lastMarkdown, 'utf-8'));
            vscode.window.showInformationMessage(t('msg.reportSavedTo', uri.fsPath.split(/[\\/]/).pop() ?? ''));
        }
    } else if (msg.type === 'explainLintRule') {
        const violation = msg.violation;
        if (!violation || typeof violation !== 'object') {
            vscode.window.showWarningMessage('Invalid Saropa Lints violation payload for explanation.');
            return;
        }
        void vscode.commands.executeCommand(
            'saropaLints.explainRule',
            // saropa_lints expects an IssueTreeNode-like object; it unwraps `node.violation`.
            { kind: 'violation', violation },
        );
    }
}

function deriveSubject(errorLine: string, fingerprint: string): string {
    const fileMatch = /[\\/]([^\\/]+?)\.\w+:\d+/.exec(errorLine);
    return (fileMatch ? fileMatch[1] : fingerprint).replaceAll(/[^\w-]/g, '_').slice(0, 40);
}

function buildDefaultFilename(): string {
    const d = new Date();
    const p = (n: number): string => String(n).padStart(2, '0');
    const ts = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
    const project = vscode.workspace.workspaceFolders?.[0]?.name.replaceAll(/[^\w-]/g, '_') ?? '';
    const parts = [ts, 'saropa_log_capture', project, lastSubject, 'bug_report'].filter(Boolean);
    return `${parts.join('_')}.md`;
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
<button id="copy-btn">Copy Markdown</button>
<button id="save-btn">Save to File</button>
</div>
${html}
<script nonce="${nonce}">${getScript()}</script>
</body></html>`;
}

function markdownToHtml(md: string): string {
    return md
        .replaceAll(/^# (.+)$/gm, '<h1>$1</h1>')
        .replaceAll(/^## (.+)$/gm, '<h2>$1</h2>')
        .replaceAll(/^### (.+)$/gm, '<h3>$1</h3>')
        .replaceAll(/^---$/gm, '<hr>')
        .replaceAll(/```\n([\s\S]*?)```/g, (_, code) => `<pre>${escapeHtml(code.trimEnd())}</pre>`)
        .replaceAll(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replaceAll(/\*(.+?)\*/g, '<em>$1</em>')
        .replaceAll(/`([^`\n]+)`/g, '<code>$1</code>')
        .replaceAll(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
        .replaceAll(/^- (.+)$/gm, '<li>$1</li>')
        .replaceAll(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
        .replaceAll(/\|(.+)\|\n\|[-| ]+\|\n((?:\|.+\|\n?)*)/g, convertTable)
        .replaceAll(/\n{2,}/g, '\n')
        .replaceAll(/^(?!<(?:h|u|p|l|o)|<\/|<li|<hr|<str|<em|<cod)(.+)$/gm, '<p>$1</p>');
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

    // Explain links for lint table rows.
    // href format from bug-report-lint-section.ts:
    //   saropa-lints:explainRule?payload=<encoded JSON>
    Array.prototype.forEach.call(
        document.querySelectorAll('a[href^="saropa-lints:explainRule"]'),
        function(link) {
            link.addEventListener('click', function(e) {
                e.preventDefault();
                var href = link.getAttribute('href') || '';
                var match = href.match(/payload=([^?&]+)/);
                if (!match || !match[1]) { return; }
                try {
                    var decoded = decodeURIComponent(match[1]);
                    var violation = JSON.parse(decoded);
                    // Restore the visible message text from the table cell. This keeps
                    // the href payload small while still providing a useful message
                    // to Saropa Lints' Explain rule panel.
                    var tr = link.closest('tr');
                    if (tr) {
                        var tds = tr.querySelectorAll('td');
                        // Columns: File (0), Line (1), Rule (2), Impact (3), Message (4), Explain (5)
                        if (tds && tds.length >= 5) {
                            var msg = (tds[4].textContent || '').trim();
                            if (msg) { violation.message = msg; }
                        }
                    }
                    vscode.postMessage({ type: 'explainLintRule', violation: violation });
                } catch (_err) {
                    // Best-effort: ignore malformed payloads.
                }
            });
        }
    );
})();`;
}

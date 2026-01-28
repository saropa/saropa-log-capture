import * as vscode from 'vscode';
import { ansiToHtml, escapeHtml } from './ansi';

/**
 * Export a .log file to a styled .html file alongside it.
 * Returns the URI of the generated HTML file.
 */
export async function exportToHtml(logUri: vscode.Uri): Promise<vscode.Uri> {
    const raw = await vscode.workspace.fs.readFile(logUri);
    const text = Buffer.from(raw).toString('utf-8');
    const lines = text.split('\n');

    const { headerLines, bodyLines } = splitHeader(lines);
    const headerHtml = headerLines.map(l => escapeHtml(l)).join('\n');
    const bodyHtml = bodyLines.map(l => ansiToHtml(l)).join('\n');

    const htmlPath = logUri.fsPath.replace(/\.log$/, '.html');
    const htmlUri = vscode.Uri.file(htmlPath);
    const content = buildHtmlDocument(headerHtml, bodyHtml);
    await vscode.workspace.fs.writeFile(htmlUri, Buffer.from(content, 'utf-8'));
    return htmlUri;
}

function splitHeader(lines: string[]): { headerLines: string[]; bodyLines: string[] } {
    const divider = lines.findIndex(l => l.startsWith('===================='));
    if (divider < 0) {
        return { headerLines: [], bodyLines: lines };
    }
    return {
        headerLines: lines.slice(0, divider + 1),
        bodyLines: lines.slice(divider + 1),
    };
}

function buildHtmlDocument(headerHtml: string, bodyHtml: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Saropa Log Capture</title>
<style>
body {
    background: #1e1e1e;
    color: #d4d4d4;
    font-family: 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
    font-size: 13px;
    margin: 0;
    padding: 16px;
    line-height: 1.5;
}
pre { margin: 0; white-space: pre-wrap; word-break: break-all; }
details { margin-bottom: 16px; }
summary {
    cursor: pointer;
    color: #569cd6;
    font-weight: bold;
    margin-bottom: 4px;
}
.header-block {
    background: #252526;
    border: 1px solid #3c3c3c;
    padding: 8px 12px;
    border-radius: 4px;
    color: #9cdcfe;
}
.body-block { padding: 0; }
</style>
</head>
<body>
<details open>
<summary>Session Context</summary>
<div class="header-block"><pre>${headerHtml}</pre></div>
</details>
<div class="body-block"><pre>${bodyHtml}</pre></div>
</body>
</html>`;
}

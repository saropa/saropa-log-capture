import * as vscode from 'vscode';
import { ansiToHtml, escapeHtml } from '../capture/ansi';
import { SessionMetadataStore } from '../session/session-metadata';
import { isPlainTextBlankAfterAnsi } from '../misc/blank-line-text';
import { getSimpleHtmlExportStyles } from './html-export-styles';
import { getStandaloneFallbackPalette } from './html-export-fallback-palette';

/**
 * Export a .log file to a styled .html file alongside it.
 * Includes annotations from sidecar metadata if present.
 * Returns the URI of the generated HTML file.
 */
export async function exportToHtml(logUri: vscode.Uri): Promise<vscode.Uri> {
    const raw = await vscode.workspace.fs.readFile(logUri);
    const text = Buffer.from(raw).toString('utf-8');
    const lines = text.split('\n');

    const { headerLines, bodyLines } = splitHeader(lines);
    const headerHtml = headerLines.map(l => escapeHtml(l)).join('\n');

    const store = new SessionMetadataStore();
    const annotations = await store.getAnnotations(logUri);
    const annotationMap = new Map(annotations.map(a => [a.lineIndex, a.text]));
    const bodyHtml = buildBodyWithAnnotations(bodyLines, annotationMap);

    const htmlPath = logUri.fsPath.replace(/\.log$/, '.html');
    const htmlUri = vscode.Uri.file(htmlPath);
    const content = buildHtmlDocument(headerHtml, bodyHtml);
    await vscode.workspace.fs.writeFile(htmlUri, Buffer.from(content, 'utf-8'));
    return htmlUri;
}

function buildBodyWithAnnotations(lines: string[], annotations: Map<number, string>): string {
    const parts: string[] = [];
    for (let i = 0; i < lines.length; i++) {
        const raw = lines[i];
        const blankCls = isPlainTextBlankAfterAnsi(raw) ? ' line-blank' : '';
        parts.push(`<div class="line${blankCls}">${ansiToHtml(raw)}</div>`);
        const ann = annotations.get(i);
        if (ann) {
            parts.push(`<div class="annotation">[Note: ${escapeHtml(ann)}]</div>`);
        }
    }
    return parts.join('\n');
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
${getStandaloneFallbackPalette()}
body {
    background: var(--surface-1);
    color: var(--text);
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
    color: var(--link);
    font-weight: bold;
    margin-bottom: 4px;
}
.header-block {
    background: var(--surface-2);
    border: 1px solid var(--border);
    padding: 8px 12px;
    border-radius: 4px;
    color: var(--muted);
}
.body-block { padding: 0; }
${getSimpleHtmlExportStyles()}
</style>
</head>
<body>
<details open>
<summary>Session Context</summary>
<div class="header-block"><pre>${headerHtml}</pre></div>
</details>
<div class="body-block"><div id="log-content">${bodyHtml}</div></div>
</body>
</html>`;
}

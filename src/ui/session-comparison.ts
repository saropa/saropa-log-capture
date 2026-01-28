/**
 * Session Comparison Panel
 *
 * WebviewPanel that shows two log sessions side by side with:
 * - Color diff highlighting (unique lines colored)
 * - Synchronized scrolling (optional)
 * - Summary statistics
 */

import * as vscode from 'vscode';
import { compareLogSessions, DiffResult, DiffLine } from '../modules/diff-engine';
import { escapeHtml } from '../modules/ansi';

/** Manages the comparison webview panel. */
export class SessionComparisonPanel implements vscode.Disposable {
    private panel: vscode.WebviewPanel | undefined;
    private diffResult: DiffResult | undefined;
    private syncScrolling = true;
    private readonly disposables: vscode.Disposable[] = [];

    constructor(private readonly extensionUri: vscode.Uri) {}

    /**
     * Open or focus the comparison panel with two sessions.
     */
    async compare(uriA: vscode.Uri, uriB: vscode.Uri): Promise<void> {
        // Compute diff
        this.diffResult = await compareLogSessions(uriA, uriB);

        if (this.panel) {
            this.panel.reveal();
        } else {
            this.panel = vscode.window.createWebviewPanel(
                'saropaLogCapture.comparison',
                'Session Comparison',
                vscode.ViewColumn.One,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true,
                    localResourceRoots: [],
                },
            );

            this.panel.onDidDispose(() => {
                this.panel = undefined;
            }, null, this.disposables);

            this.panel.webview.onDidReceiveMessage(
                (msg) => this.handleMessage(msg),
                null,
                this.disposables,
            );
        }

        this.updateContent();
    }

    dispose(): void {
        this.panel?.dispose();
        for (const d of this.disposables) {
            d.dispose();
        }
    }

    private handleMessage(msg: { type: string; [key: string]: unknown }): void {
        switch (msg.type) {
            case 'toggleSync':
                this.syncScrolling = !this.syncScrolling;
                this.panel?.webview.postMessage({
                    type: 'syncState',
                    enabled: this.syncScrolling,
                });
                break;
        }
    }

    private updateContent(): void {
        if (!this.panel || !this.diffResult) {
            return;
        }

        const { sessionA, sessionB, commonCount } = this.diffResult;
        const nameA = this.getFilename(sessionA.uri);
        const nameB = this.getFilename(sessionB.uri);

        this.panel.title = `Compare: ${nameA} ↔ ${nameB}`;
        this.panel.webview.html = this.buildHtml(nameA, nameB, commonCount);
    }

    private getFilename(uri: vscode.Uri): string {
        return uri.fsPath.split(/[\\/]/).pop() ?? 'session';
    }

    private buildHtml(nameA: string, nameB: string, commonCount: number): string {
        const { sessionA, sessionB } = this.diffResult!;
        const nonce = this.getNonce();

        return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy"
          content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}';">
    <style nonce="${nonce}">
        ${this.getStyles()}
    </style>
</head>
<body>
    <div class="header">
        <div class="stats">
            <span class="stat"><span class="unique-a-dot"></span> ${sessionA.uniqueCount} unique to A</span>
            <span class="stat"><span class="unique-b-dot"></span> ${sessionB.uniqueCount} unique to B</span>
            <span class="stat">${commonCount} common</span>
        </div>
        <button id="sync-btn" class="sync-btn ${this.syncScrolling ? 'active' : ''}"
                onclick="toggleSync()">
            Sync Scroll: ${this.syncScrolling ? 'ON' : 'OFF'}
        </button>
    </div>
    <div class="comparison">
        <div class="pane pane-a">
            <div class="pane-header">${escapeHtml(nameA)}</div>
            <div class="pane-content" id="pane-a" onscroll="onScrollA()">
                ${this.renderLines(sessionA.lines, 'a')}
            </div>
        </div>
        <div class="pane pane-b">
            <div class="pane-header">${escapeHtml(nameB)}</div>
            <div class="pane-content" id="pane-b" onscroll="onScrollB()">
                ${this.renderLines(sessionB.lines, 'b')}
            </div>
        </div>
    </div>
    <script nonce="${nonce}">
        ${this.getScript()}
    </script>
</body>
</html>`;
    }

    private renderLines(lines: readonly DiffLine[], side: 'a' | 'b'): string {
        return lines.map((dl, i) => {
            const cls = dl.status === 'unique' ? `unique-${side}` : 'common';
            const text = escapeHtml(dl.line.text);
            return `<div class="line ${cls}" data-idx="${i}">${text}</div>`;
        }).join('\n');
    }

    private getStyles(): string {
        return /* css */ `
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
    background: var(--vscode-editor-background);
    color: var(--vscode-editor-foreground);
    font-family: var(--vscode-editor-font-family, monospace);
    font-size: var(--vscode-editor-font-size, 13px);
    height: 100vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}
.header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    background: var(--vscode-sideBar-background);
    border-bottom: 1px solid var(--vscode-panel-border);
    flex-shrink: 0;
}
.stats {
    display: flex;
    gap: 16px;
    font-size: 12px;
}
.stat { display: flex; align-items: center; gap: 4px; }
.unique-a-dot, .unique-b-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
}
.unique-a-dot { background: var(--vscode-diffEditor-removedTextBackground, rgba(255, 0, 0, 0.3)); }
.unique-b-dot { background: var(--vscode-diffEditor-insertedTextBackground, rgba(0, 255, 0, 0.3)); }
.sync-btn {
    background: var(--vscode-button-secondaryBackground);
    color: var(--vscode-button-secondaryForeground);
    border: none;
    padding: 4px 12px;
    cursor: pointer;
    border-radius: 4px;
    font-size: 12px;
}
.sync-btn.active {
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
}
.sync-btn:hover {
    background: var(--vscode-button-hoverBackground);
}
.comparison {
    flex: 1;
    display: flex;
    overflow: hidden;
}
.pane {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}
.pane-a { border-right: 1px solid var(--vscode-panel-border); }
.pane-header {
    padding: 6px 12px;
    background: var(--vscode-editorGroupHeader-tabsBackground);
    border-bottom: 1px solid var(--vscode-panel-border);
    font-weight: bold;
    font-size: 12px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.pane-content {
    flex: 1;
    overflow: auto;
    padding: 4px 0;
}
.line {
    padding: 0 12px;
    line-height: 1.5;
    white-space: pre-wrap;
    word-break: break-all;
}
.line:hover {
    background: var(--vscode-list-hoverBackground);
}
.line.unique-a {
    background: var(--vscode-diffEditor-removedTextBackground, rgba(255, 0, 0, 0.15));
    border-left: 3px solid var(--vscode-diffEditor-removedLineBackground, #ff6b6b);
}
.line.unique-b {
    background: var(--vscode-diffEditor-insertedTextBackground, rgba(0, 255, 0, 0.15));
    border-left: 3px solid var(--vscode-diffEditor-insertedLineBackground, #51cf66);
}
.line.common {
    border-left: 3px solid transparent;
}
`;
    }

    private getScript(): string {
        return /* javascript */ `
const vscodeApi = acquireVsCodeApi();
let syncEnabled = ${this.syncScrolling};
let scrolling = false;

function toggleSync() {
    vscodeApi.postMessage({ type: 'toggleSync' });
}

function onScrollA() {
    if (!syncEnabled || scrolling) return;
    scrolling = true;
    const paneA = document.getElementById('pane-a');
    const paneB = document.getElementById('pane-b');
    const ratio = paneA.scrollTop / (paneA.scrollHeight - paneA.clientHeight || 1);
    paneB.scrollTop = ratio * (paneB.scrollHeight - paneB.clientHeight);
    setTimeout(() => { scrolling = false; }, 50);
}

function onScrollB() {
    if (!syncEnabled || scrolling) return;
    scrolling = true;
    const paneA = document.getElementById('pane-a');
    const paneB = document.getElementById('pane-b');
    const ratio = paneB.scrollTop / (paneB.scrollHeight - paneB.clientHeight || 1);
    paneA.scrollTop = ratio * (paneA.scrollHeight - paneA.clientHeight);
    setTimeout(() => { scrolling = false; }, 50);
}

window.addEventListener('message', function(event) {
    const msg = event.data;
    if (msg.type === 'syncState') {
        syncEnabled = msg.enabled;
        const btn = document.getElementById('sync-btn');
        btn.textContent = 'Sync Scroll: ' + (syncEnabled ? 'ON' : 'OFF');
        btn.classList.toggle('active', syncEnabled);
    }
});
`;
    }

    private getNonce(): string {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < 32; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }
}

/** Singleton instance for the comparison panel. */
let comparisonPanel: SessionComparisonPanel | undefined;

/**
 * Get or create the comparison panel.
 */
export function getComparisonPanel(extensionUri: vscode.Uri): SessionComparisonPanel {
    if (!comparisonPanel) {
        comparisonPanel = new SessionComparisonPanel(extensionUri);
    }
    return comparisonPanel;
}

/**
 * Dispose the comparison panel singleton.
 */
export function disposeComparisonPanel(): void {
    comparisonPanel?.dispose();
    comparisonPanel = undefined;
}

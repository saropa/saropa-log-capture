/** Sidebar panel showing Saropa company info and project links. */

import * as vscode from 'vscode';
import { getNonce } from './viewer-content';

/** WebviewViewProvider for the About Saropa sidebar panel. */
export class AboutPanelProvider implements vscode.WebviewViewProvider, vscode.Disposable {
    private view: vscode.WebviewView | undefined;
    static readonly viewType = 'saropaLogCapture.aboutPanel';

    constructor(private readonly version: string) {}

    resolveWebviewView(webviewView: vscode.WebviewView): void {
        this.view = webviewView;
        webviewView.webview.options = { enableScripts: true, localResourceRoots: [] };
        webviewView.webview.onDidReceiveMessage(msg => this.handleMessage(msg));
        webviewView.webview.html = buildPanelHtml(this.version);
    }

    dispose(): void { /* nothing to clean up */ }

    private async handleMessage(msg: Record<string, unknown>): Promise<void> {
        if (msg.type === 'openLink' && typeof msg.url === 'string') {
            vscode.env.openExternal(vscode.Uri.parse(msg.url)).then(undefined, () => {});
        }
    }
}

function buildPanelHtml(version: string): string {
    const nonce = getNonce();
    return `<!DOCTYPE html><html><head><style nonce="${nonce}">${getStyles()}</style></head><body>
<div class="ab-header">Saropa</div>
<p class="ab-blurb">Saropa builds developer tools that cut through the noise so you can focus on shipping. We believe the best tooling is invisible — it works on install, stays out of your way, and never loses your data.</p>
<div class="ab-section">Projects</div>
<div class="ab-link" onclick="openLink('https://marketplace.visualstudio.com/items?itemName=saropa.saropa-log-capture')">
    <span class="ab-link-icon">\u{1F4CB}</span>
    <span>
        <span class="ab-link-title">Saropa Log Capture</span>
        <span class="ab-link-desc">VS Code Marketplace${version ? ` \u00b7 v${version}` : ''}</span>
    </span>
</div>
<div class="ab-link" onclick="openLink('https://github.com/saropa/saropa-log-capture')">
    <span class="ab-link-icon">\u{1F4BB}</span>
    <span>
        <span class="ab-link-title">Saropa Log Capture</span>
        <span class="ab-link-desc">GitHub \u00b7 source, issues, discussions</span>
    </span>
</div>
<div class="ab-divider"></div>
<div class="ab-link" onclick="openLink('https://saropa.com')">
    <span class="ab-link-icon">\u{1F310}</span>
    <span>
        <span class="ab-link-title">saropa.com</span>
        <span class="ab-link-desc">Main website</span>
    </span>
</div>
<script nonce="${nonce}">const v=acquireVsCodeApi();function openLink(u){v.postMessage({type:'openLink',url:u})}</script>
</body></html>`;
}

function getStyles(): string {
    return `body{padding:8px 12px;font-family:var(--vscode-font-family);font-size:var(--vscode-font-size);color:var(--vscode-foreground);line-height:1.4}
.ab-header{font-size:1.4em;font-weight:700;margin-bottom:8px}
.ab-blurb{opacity:0.85;margin:0 0 16px 0;font-size:0.95em}
.ab-section{font-weight:600;font-size:1.05em;margin-bottom:8px;border-bottom:1px solid var(--vscode-panel-border);padding-bottom:4px}
.ab-link{display:flex;align-items:flex-start;gap:8px;padding:6px 8px;border-radius:4px;cursor:pointer}
.ab-link:hover{background:var(--vscode-list-hoverBackground)}
.ab-link-icon{font-size:1.2em;flex-shrink:0;margin-top:1px}
.ab-link-title{display:block;color:var(--vscode-textLink-foreground);font-weight:500}
.ab-link-desc{display:block;font-size:0.85em;opacity:0.7}
.ab-divider{height:1px;background:var(--vscode-panel-border);margin:8px 0}`;
}

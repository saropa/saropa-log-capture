/**
 * Sidebar panel listing detected correlations for the last session
 * that had timeline opened. Click to jump to a correlated event.
 */

import * as vscode from 'vscode';
import { getNonce } from '../provider/viewer-content';
import { getCorrelations, getLastSessionUri } from '../../modules/correlation/correlation-store';
import type { Correlation, CorrelatedEvent } from '../../modules/correlation/correlation-types';
import { openLogAtLine } from '../../modules/search/log-search';

export class CorrelationPanelProvider implements vscode.WebviewViewProvider, vscode.Disposable {
    private view: vscode.WebviewView | undefined;
    static readonly viewType = 'saropaLogCapture.correlationPanel';

    resolveWebviewView(webviewView: vscode.WebviewView): void {
        this.view = webviewView;
        webviewView.webview.options = { enableScripts: true, localResourceRoots: [] };
        webviewView.webview.onDidReceiveMessage(msg => this.handleMessage(msg));
        webviewView.onDidChangeVisibility(() => { if (webviewView.visible) { this.refresh(); } });
        this.refresh();
    }

    dispose(): void {
        this.view = undefined;
    }

    refresh(): void {
        if (!this.view) { return; }
        const sessionUri = getLastSessionUri();
        const correlations = sessionUri ? getCorrelations(sessionUri) : [];
        this.view.webview.html = buildPanelHtml(correlations, sessionUri);
    }

    private async handleMessage(msg: Record<string, unknown>): Promise<void> {
        if (msg.type === 'openAtLocation' && msg.file && typeof msg.line === 'number') {
            const uri = vscode.Uri.parse(String(msg.file));
            await openLogAtLine({ uri, filename: '', lineNumber: Number(msg.line), lineText: '', matchStart: 0, matchEnd: 0 }).catch(() => {});
        } else if (msg.type === 'openFile' && msg.file) {
            try {
                await vscode.window.showTextDocument(vscode.Uri.parse(String(msg.file)), { preview: true });
            } catch {
                // File may not exist or be inaccessible
            }
        }
    }
}

function buildPanelHtml(correlations: Correlation[], sessionUri: string | undefined): string {
    const nonce = getNonce();
    const empty = !sessionUri || correlations.length === 0;
    const t = (key: string) => {
        const map: Record<string, string> = {
            'panel.correlation.title': 'Correlations',
            'panel.correlation.empty': 'No correlations detected for this session.',
            'panel.correlation.related': 'Related events',
            'panel.correlation.jumpTo': 'Jump to event',
        };
        return map[key] ?? key;
    };

    let body = '';
    if (empty) {
        body = `<div class="cp-empty">${t('panel.correlation.empty')}</div><p class="cp-hint">Open a session timeline to detect correlations.</p>`;
    } else {
        body = correlations.map(c => renderCorrelation(c, t)).join('');
    }

    return `<!DOCTYPE html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
<style nonce="${nonce}">${getStyles()}</style></head><body>
<div class="cp-header">${t('panel.correlation.title')}</div>
<div class="cp-list">${body}</div>
<script nonce="${nonce}">(function(){var v=acquireVsCodeApi();document.querySelectorAll('.cp-jump').forEach(function(btn){btn.addEventListener('click',function(){var f=btn.getAttribute('data-file');var a=btn.getAttribute('data-action');if(a==='openAt'){var l=parseInt(btn.getAttribute('data-line'),10);v.postMessage({type:'openAtLocation',file:f,line:l})}else{v.postMessage({type:'openFile',file:f})}})})})();</script>
</body></html>`;
}

function renderCorrelation(c: Correlation, t: (k: string) => string): string {
    const confClass = c.confidence === 'high' ? 'cp-high' : c.confidence === 'medium' ? 'cp-medium' : 'cp-low';
    const eventsHtml = c.events.map((e: CorrelatedEvent) => {
        const line = e.location?.line;
        const file = e.location?.file ?? '';
        const label = escapeHtml(e.summary.slice(0, 60) + (e.summary.length > 60 ? '…' : ''));
        const fileEsc = escapeHtml(file);
        if (line !== undefined && file) {
            return `<li><button class="cp-jump" data-file="${fileEsc}" data-line="${line}" data-action="openAt" title="${t('panel.correlation.jumpTo')}">${escapeHtml(e.source)} L${line}</button> ${label}</li>`;
        }
        if (file) {
            return `<li><button class="cp-jump" data-file="${fileEsc}" data-action="openFile">${escapeHtml(e.source)}</button> ${label}</li>`;
        }
        return `<li>${label}</li>`;
    }).join('');
    return `<div class="cp-item ${confClass}">
<div class="cp-desc">${escapeHtml(c.description)}</div>
<ul class="cp-events">${eventsHtml}</ul>
</div>`;
}

function escapeHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function getStyles(): string {
    return `body{padding:6px 10px;font-family:var(--vscode-font-family);font-size:var(--vscode-font-size);color:var(--vscode-foreground)}
.cp-header{font-weight:600;margin-bottom:8px;font-size:13px}
.cp-empty{color:var(--vscode-descriptionForeground);font-style:italic;margin-bottom:6px}
.cp-hint{font-size:11px;opacity:0.8;margin:0}
.cp-list{display:flex;flex-direction:column;gap:10px}
.cp-item{border:1px solid var(--vscode-panel-border);border-radius:4px;padding:8px}
.cp-desc{font-size:12px;margin-bottom:6px;font-weight:500}
.cp-events{margin:0;padding-left:18px;font-size:11px}
.cp-events li{margin:4px 0;list-style:disc}
.cp-jump{background:none;border:none;color:var(--vscode-textLink-foreground);cursor:pointer;padding:0;margin-right:4px;text-decoration:underline;font-size:inherit}
.cp-jump:hover{color:var(--vscode-textLink-activeForeground)}
.cp-high{border-left:3px solid var(--vscode-testing-iconPassed)}
.cp-medium{border-left:3px solid var(--vscode-editorWarning-foreground)}
.cp-low{border-left:3px solid var(--vscode-descriptionForeground)}`;
}

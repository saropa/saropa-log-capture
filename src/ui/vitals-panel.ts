/** Persistent sidebar panel showing Google Play Vitals crash and ANR rates. */

import * as vscode from 'vscode';
import { escapeHtml, formatElapsedLabel } from '../modules/ansi';
import { getNonce } from './viewer-content';
import { queryVitals, clearVitalsCache, thresholds } from '../modules/google-play-vitals';
import type { VitalsSnapshot } from '../modules/google-play-vitals-types';

let refreshTimer: ReturnType<typeof setInterval> | undefined;

/** WebviewViewProvider for the Google Play Vitals sidebar panel. */
export class VitalsPanelProvider implements vscode.WebviewViewProvider, vscode.Disposable {
    private view: vscode.WebviewView | undefined;
    static readonly viewType = 'saropaLogCapture.vitalsPanel';

    resolveWebviewView(webviewView: vscode.WebviewView): void {
        this.view = webviewView;
        webviewView.webview.options = { enableScripts: true, localResourceRoots: [] };
        webviewView.webview.onDidReceiveMessage(msg => this.handleMessage(msg));
        this.refresh();
        this.startAutoRefresh();
    }

    async refresh(): Promise<void> {
        if (!this.view) { return; }
        this.view.webview.html = buildLoadingHtml();
        clearVitalsCache();
        const snapshot = await queryVitals().catch(() => undefined);
        if (this.view) { this.view.webview.html = buildPanelHtml(snapshot); }
    }

    dispose(): void {
        if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = undefined; }
    }

    private startAutoRefresh(): void {
        if (refreshTimer) { return; }
        const interval = vscode.workspace.getConfiguration('saropaLogCapture.firebase').get<number>('refreshInterval', 300);
        if (interval > 0) { refreshTimer = setInterval(() => this.refresh(), interval * 1000); }
    }

    private async handleMessage(msg: Record<string, unknown>): Promise<void> {
        if (msg.type === 'refresh') { await this.refresh(); }
        else if (msg.type === 'openPlayConsole') {
            // Play Console URLs require developer account ID which we don't have — open the console home.
            vscode.env.openExternal(vscode.Uri.parse('https://play.google.com/console')).then(undefined, () => {});
        }
    }
}

function buildLoadingHtml(): string {
    return `<!DOCTYPE html><html><body style="padding:8px;font-family:var(--vscode-font-family)"><p>Loading Vitals data\u2026</p></body></html>`;
}

function buildPanelHtml(snapshot: VitalsSnapshot | undefined): string {
    const nonce = getNonce();
    if (!snapshot) {
        return `<!DOCTYPE html><html><body style="padding:8px;font-family:var(--vscode-font-family)">
<p>Google Play Vitals not available.</p>
<p style="font-size:11px;opacity:0.8">Requires: package name (google-services.json or setting), gcloud auth, and Play Developer Reporting API enabled.</p>
</body></html>`;
    }
    const refreshNote = `(${formatElapsedLabel(snapshot.queriedAt)})`;
    return `<!DOCTYPE html><html><head><style nonce="${nonce}">${getStyles()}</style></head><body>
<div class="vt-toolbar"><span class="vt-title">Vitals ${refreshNote}</span><button class="vt-refresh" onclick="postMsg('refresh')">Refresh</button></div>
<div class="vt-pkg">${escapeHtml(snapshot.packageName)}</div>
${renderMetric('Crash Rate', snapshot.crashRate, thresholds.crashRate)}
${renderMetric('ANR Rate', snapshot.anrRate, thresholds.anrRate)}
<div class="vt-footer" onclick="postMsg('openPlayConsole')">Open Play Console</div>
<script nonce="${nonce}">const v=acquireVsCodeApi();function postMsg(t){v.postMessage({type:t})}</script>
</body></html>`;
}

function renderMetric(label: string, rate: number | undefined, threshold: number): string {
    if (rate === undefined) { return `<div class="vt-metric"><span class="vt-label">${label}</span><span class="vt-na">N/A</span></div>`; }
    const pct = rate.toFixed(2) + '%';
    const bad = rate > threshold;
    const cls = bad ? ' vt-bad' : ' vt-good';
    const icon = bad ? '\u26a0' : '\u2713';
    return `<div class="vt-metric${cls}"><span class="vt-label">${label}</span><span class="vt-value">${icon} ${pct}</span><span class="vt-threshold">threshold: ${threshold}%</span></div>`;
}

function getStyles(): string {
    return `body{padding:4px 8px;font-family:var(--vscode-font-family);font-size:var(--vscode-font-size);color:var(--vscode-foreground)}
.vt-toolbar{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}
.vt-title{font-weight:600;font-size:1.1em}
.vt-refresh{background:var(--vscode-button-background);color:var(--vscode-button-foreground);border:none;padding:2px 8px;cursor:pointer;border-radius:2px}
.vt-pkg{font-size:11px;opacity:0.7;margin-bottom:8px;font-family:var(--vscode-editor-font-family,monospace)}
.vt-metric{border:1px solid var(--vscode-panel-border);border-radius:4px;padding:8px;margin-bottom:6px;display:flex;flex-wrap:wrap;align-items:baseline;gap:6px}
.vt-label{font-weight:600;flex:1}.vt-value{font-size:1.2em;font-weight:700}
.vt-threshold{font-size:10px;opacity:0.6;width:100%}
.vt-good .vt-value{color:var(--vscode-testing-iconPassed, #388e3c)}
.vt-bad .vt-value{color:var(--vscode-errorForeground)}
.vt-na{opacity:0.5;font-style:italic}
.vt-footer{margin-top:8px;text-align:center;cursor:pointer;color:var(--vscode-textLink-foreground);font-size:12px}`;
}

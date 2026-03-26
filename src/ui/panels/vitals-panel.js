"use strict";
/** Persistent sidebar panel showing Google Play Vitals crash and ANR rates. */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.VitalsPanelProvider = void 0;
const vscode = __importStar(require("vscode"));
const ansi_1 = require("../../modules/capture/ansi");
const viewer_content_1 = require("../provider/viewer-content");
const google_play_vitals_1 = require("../../modules/crashlytics/google-play-vitals");
let refreshTimer;
/** WebviewViewProvider for the Google Play Vitals sidebar panel. */
class VitalsPanelProvider {
    view;
    static viewType = 'saropaLogCapture.vitalsPanel';
    resolveWebviewView(webviewView) {
        this.view = webviewView;
        webviewView.webview.options = { enableScripts: true, localResourceRoots: [] };
        webviewView.webview.onDidReceiveMessage(msg => this.handleMessage(msg));
        this.refresh();
        this.startAutoRefresh();
    }
    async refresh() {
        if (!this.view) {
            return;
        }
        this.view.webview.html = buildLoadingHtml();
        (0, google_play_vitals_1.clearVitalsCache)();
        const snapshot = await (0, google_play_vitals_1.queryVitals)().catch(() => undefined);
        if (this.view) {
            this.view.webview.html = buildPanelHtml(snapshot);
        }
    }
    dispose() {
        if (refreshTimer) {
            clearInterval(refreshTimer);
            refreshTimer = undefined;
        }
    }
    startAutoRefresh() {
        if (refreshTimer) {
            return;
        }
        const interval = vscode.workspace.getConfiguration('saropaLogCapture.firebase').get('refreshInterval', 300);
        if (interval > 0) {
            refreshTimer = setInterval(() => this.refresh(), interval * 1000);
        }
    }
    async handleMessage(msg) {
        if (msg.type === 'refresh') {
            await this.refresh();
        }
        else if (msg.type === 'openPlayConsole') {
            const custom = vscode.workspace.getConfiguration('saropaLogCapture.playConsole').get('appUrl', '');
            const url = custom || 'https://play.google.com/console';
            vscode.env.openExternal(vscode.Uri.parse(url)).then(undefined, () => { });
        }
    }
}
exports.VitalsPanelProvider = VitalsPanelProvider;
function buildLoadingHtml() {
    return `<!DOCTYPE html><html><body style="padding:8px;font-family:var(--vscode-font-family)"><p>Loading Vitals data\u2026</p></body></html>`;
}
function buildPanelHtml(snapshot) {
    const nonce = (0, viewer_content_1.getNonce)();
    if (!snapshot) {
        return `<!DOCTYPE html><html><body style="padding:8px;font-family:var(--vscode-font-family)">
<p>Google Play Vitals not available.</p>
<p style="font-size:11px;opacity:0.8">Requires: package name (google-services.json or setting), gcloud auth, and Play Developer Reporting API enabled.</p>
</body></html>`;
    }
    const refreshNote = `(${(0, ansi_1.formatElapsedLabel)(snapshot.queriedAt)})`;
    return `<!DOCTYPE html><html><head><style nonce="${nonce}">${getStyles()}</style></head><body>
<div role="main" aria-label="Vitals">
<div class="vt-toolbar"><span class="vt-title">Vitals ${refreshNote}</span><button class="vt-refresh" onclick="postMsg('refresh')" aria-label="Refresh Vitals data">Refresh</button></div>
<div class="vt-pkg">${(0, ansi_1.escapeHtml)(snapshot.packageName)}</div>
${renderMetric('Crash Rate', snapshot.crashRate, google_play_vitals_1.thresholds.crashRate)}
${renderMetric('ANR Rate', snapshot.anrRate, google_play_vitals_1.thresholds.anrRate)}
<div class="vt-footer" onclick="postMsg('openPlayConsole')">Open Play Console</div>
</div>
<script nonce="${nonce}">const v=acquireVsCodeApi();function postMsg(t){v.postMessage({type:t})}</script>
</body></html>`;
}
function renderMetric(label, rate, threshold) {
    if (rate === undefined) {
        return `<div class="vt-metric"><span class="vt-label">${label}</span><span class="vt-na">N/A</span></div>`;
    }
    const pct = rate.toFixed(2) + '%';
    const bad = rate > threshold;
    const cls = bad ? ' vt-bad' : ' vt-good';
    const icon = bad ? '\u26a0' : '\u2713';
    return `<div class="vt-metric${cls}"><span class="vt-label">${label}</span><span class="vt-value">${icon} ${pct}</span><span class="vt-threshold">threshold: ${threshold}%</span></div>`;
}
function getStyles() {
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
//# sourceMappingURL=vitals-panel.js.map
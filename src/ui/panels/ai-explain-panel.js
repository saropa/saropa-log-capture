"use strict";
/**
 * Dedicated AI explanation panel with formatting: error line, stack trace, integration context, explanation.
 * Phase 2: sections; Phase 3: Copy explanation button.
 */
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
exports.showAIExplanationPanel = showAIExplanationPanel;
const vscode = __importStar(require("vscode"));
const l10n_1 = require("../../l10n");
const VIEW_TYPE = 'saropaAIExplain';
function getNonce() {
    let t = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        t += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return t;
}
function escapeHtml(s) {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
function blockHtml(classNames, content) {
    return `<div class="${classNames}">${content}</div>`;
}
function sectionTitle(title) {
    return `<h3 class="section-title">${escapeHtml(title)}</h3>`;
}
function buildExplanationHtml(context, result, nonce) {
    const explanation = escapeHtml(result.explanation).replace(/\n/g, '<br>');
    const errorLine = escapeHtml(context.errorLine);
    const parts = [
        '<div class="toolbar"><button type="button" id="copy-btn" class="copy-btn">' + escapeHtml((0, l10n_1.t)('panel.aiExplainCopyBtn')) + '</button></div>',
        '<div class="meta">Model: ' + escapeHtml(result.model) + (result.cached ? escapeHtml((0, l10n_1.t)('panel.aiExplainCached')) : '') + '</div>',
        sectionTitle('Error line'),
        blockHtml('error-line', errorLine),
    ];
    if (context.stackTrace) {
        const stackHtml = escapeHtml(context.stackTrace).replace(/\n/g, '<br>');
        parts.push(sectionTitle('Stack trace'), blockHtml('stack-trace', stackHtml));
    }
    if (context.integrationData) {
        const intParts = [];
        if (context.integrationData.performance) {
            intParts.push(`<div class="int-row"><strong>Performance:</strong> ${escapeHtml(context.integrationData.performance.memory)}, ${escapeHtml(context.integrationData.performance.cpu)}</div>`);
        }
        if (context.integrationData.http && context.integrationData.http.length > 0) {
            const list = context.integrationData.http
                .map((h) => `${escapeHtml(h.url)} → ${h.status} (${h.duration}ms)`)
                .join('<br>');
            intParts.push(`<div class="int-row"><strong>HTTP:</strong><br>${list}</div>`);
        }
        if (context.integrationData.terminal && context.integrationData.terminal.length > 0) {
            const lines = context.integrationData.terminal.slice(0, 15).map((l) => escapeHtml(l)).join('<br>');
            intParts.push(`<div class="int-row"><strong>Terminal:</strong><br>${lines}</div>`);
        }
        if (intParts.length > 0) {
            parts.push(sectionTitle('Context at error time'), blockHtml('integration-data', intParts.join('')));
        }
    }
    parts.push(sectionTitle('Explanation'), blockHtml('explanation', explanation));
    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
    <style nonce="${nonce}">
        body { font-family: var(--vscode-font-family); font-size: var(--vscode-font-size); padding: 1rem; color: var(--vscode-foreground); line-height: 1.5; }
        .toolbar { margin-bottom: 0.75rem; }
        .copy-btn { padding: 0.25rem 0.75rem; cursor: pointer; font-size: 0.9em; }
        .meta { font-size: 0.9em; color: var(--vscode-descriptionForeground); margin-bottom: 1rem; }
        .section-title { font-size: 0.95em; margin: 1rem 0 0.5rem; color: var(--vscode-foreground); }
        .error-line { background: var(--vscode-inputValidation-errorBackground); padding: 0.5rem 0.75rem; margin: 0.25rem 0; border-radius: 4px; font-family: var(--vscode-editor-font-family); }
        .stack-trace { background: var(--vscode-textBlockQuote-background); padding: 0.5rem 0.75rem; margin: 0.25rem 0; border-radius: 4px; font-family: var(--vscode-editor-font-family); font-size: 0.9em; white-space: pre-wrap; word-break: break-all; }
        .integration-data { background: var(--vscode-textBlockQuote-background); padding: 0.5rem 0.75rem; margin: 0.25rem 0; border-radius: 4px; font-size: 0.9em; }
        .int-row { margin: 0.25rem 0; }
        .explanation { white-space: pre-wrap; margin: 0.25rem 0; }
    </style>
</head>
<body>
    <div role="main" aria-label="AI Explanation">
    ${parts.join('\n')}
    </div>
    <script nonce="${nonce}">(function(){var v=acquireVsCodeApi();var b=document.getElementById('copy-btn');if(b)b.onclick=function(){v.postMessage({type:'copy'});};})();</script>
</body>
</html>`;
}
function showAIExplanationPanel(context, result) {
    const panel = vscode.window.createWebviewPanel(VIEW_TYPE, (0, l10n_1.t)('panel.aiExplainTitle'), vscode.ViewColumn.Beside, { enableScripts: true, localResourceRoots: [] });
    const nonce = getNonce();
    panel.webview.html = buildExplanationHtml(context, result, nonce);
    panel.webview.onDidReceiveMessage((msg) => {
        if (msg?.type === 'copy') {
            void vscode.env.clipboard.writeText(result.explanation);
        }
    });
}
//# sourceMappingURL=ai-explain-panel.js.map
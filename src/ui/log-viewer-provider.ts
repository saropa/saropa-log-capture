import * as vscode from 'vscode';
import { stripAnsi } from '../ansi';

const BATCH_INTERVAL_MS = 200;
const MAX_VIEWER_LINES = 5000;

interface PendingLine {
    readonly text: string;
    readonly isMarker: boolean;
}

/**
 * Provides a webview-based sidebar panel that displays captured
 * debug output in real time with auto-scroll and theme support.
 */
export class LogViewerProvider implements vscode.WebviewViewProvider, vscode.Disposable {
    private view: vscode.WebviewView | undefined;
    private pendingLines: PendingLine[] = [];
    private batchTimer: ReturnType<typeof setInterval> | undefined;

    constructor(private readonly extensionUri: vscode.Uri) {}

    resolveWebviewView(webviewView: vscode.WebviewView): void {
        this.view = webviewView;
        webviewView.webview.options = { enableScripts: true };
        webviewView.webview.html = this.buildHtml(webviewView.webview);

        this.startBatchTimer();

        webviewView.onDidDispose(() => {
            this.stopBatchTimer();
            this.view = undefined;
        });
    }

    /** Queue a log line for batched delivery to the webview. */
    addLine(text: string, isMarker: boolean): void {
        const cleaned = stripAnsi(text);
        this.pendingLines.push({ text: cleaned, isMarker });
    }

    /** Send a clear message to the webview. */
    clear(): void {
        this.pendingLines = [];
        this.postMessage({ type: 'clear' });
    }

    /** Update the footer status text. */
    updateFooter(text: string): void {
        this.postMessage({ type: 'updateFooter', text });
    }

    dispose(): void {
        this.stopBatchTimer();
    }

    private startBatchTimer(): void {
        this.stopBatchTimer();
        this.batchTimer = setInterval(() => this.flushBatch(), BATCH_INTERVAL_MS);
    }

    private stopBatchTimer(): void {
        if (this.batchTimer !== undefined) {
            clearInterval(this.batchTimer);
            this.batchTimer = undefined;
        }
    }

    private flushBatch(): void {
        if (this.pendingLines.length === 0 || !this.view) {
            return;
        }
        const lines = this.pendingLines.splice(0);
        this.postMessage({ type: 'addLines', lines });
    }

    private postMessage(message: unknown): void {
        this.view?.webview.postMessage(message);
    }

    private buildHtml(webview: vscode.Webview): string {
        const nonce = getNonce();
        return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy"
          content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}';">
    <style nonce="${nonce}">
        ${getStyles()}
    </style>
</head>
<body>
    <div id="log-content"></div>
    <button id="jump-btn" onclick="jumpToBottom()">Jump to Bottom</button>
    <div id="footer">Waiting for debug session...</div>
    <script nonce="${nonce}">
        ${getClientScript()}
    </script>
</body>
</html>`;
    }
}

function getNonce(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 32; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

function getStyles(): string {
    return /* css */ `
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
    background: var(--vscode-editor-background);
    color: var(--vscode-editor-foreground);
    font-family: var(--vscode-editor-font-family, monospace);
    font-size: var(--vscode-editor-font-size, 13px);
    overflow-y: auto;
    height: 100vh;
    display: flex;
    flex-direction: column;
}
#log-content {
    flex: 1;
    overflow-y: auto;
    padding: 4px 0;
}
.line {
    white-space: pre-wrap;
    word-break: break-all;
    padding: 0 8px;
    line-height: 1.5;
}
.line:hover {
    background: var(--vscode-list-hoverBackground);
}
.marker {
    border-top: 1px solid var(--vscode-editorGutter-addedBackground, #28a745);
    border-bottom: 1px solid var(--vscode-editorGutter-addedBackground, #28a745);
    background: var(--vscode-diffEditor-insertedLineBackground, rgba(40, 167, 69, 0.1));
    color: var(--vscode-editorGutter-addedBackground, #28a745);
    padding: 4px 8px;
    text-align: center;
    font-style: italic;
    line-height: 1.5;
}
#jump-btn {
    display: none;
    position: fixed;
    bottom: 32px;
    right: 12px;
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border: none;
    padding: 4px 12px;
    cursor: pointer;
    border-radius: 4px;
    font-size: 12px;
    z-index: 10;
}
#jump-btn:hover {
    background: var(--vscode-button-hoverBackground);
}
#footer {
    position: sticky;
    bottom: 0;
    background: var(--vscode-sideBar-background);
    border-top: 1px solid var(--vscode-panel-border);
    padding: 4px 8px;
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
    flex-shrink: 0;
}
`;
}

function getClientScript(): string {
    return /* javascript */ `
const logEl = document.getElementById('log-content');
const jumpBtn = document.getElementById('jump-btn');
const footerEl = document.getElementById('footer');
const MAX_LINES = ${MAX_VIEWER_LINES};
let autoScroll = true;
let lineCount = 0;

logEl.addEventListener('scroll', () => {
    const atBottom = logEl.scrollHeight - logEl.scrollTop - logEl.clientHeight < 30;
    autoScroll = atBottom;
    jumpBtn.style.display = atBottom ? 'none' : 'block';
});

function jumpToBottom() {
    logEl.scrollTop = logEl.scrollHeight;
    autoScroll = true;
    jumpBtn.style.display = 'none';
}

function trimOldLines() {
    while (logEl.children.length > MAX_LINES) {
        logEl.removeChild(logEl.firstChild);
    }
}

function addLine(text, isMarker) {
    const el = document.createElement('div');
    el.className = isMarker ? 'marker' : 'line';
    el.textContent = text;
    logEl.appendChild(el);
    lineCount++;
}

window.addEventListener('message', (event) => {
    const msg = event.data;
    switch (msg.type) {
        case 'addLines':
            for (const line of msg.lines) {
                addLine(line.text, line.isMarker);
            }
            trimOldLines();
            if (autoScroll) {
                logEl.scrollTop = logEl.scrollHeight;
            }
            footerEl.textContent = 'Recording: ' + lineCount + ' lines';
            break;
        case 'clear':
            logEl.innerHTML = '';
            lineCount = 0;
            footerEl.textContent = 'Cleared';
            break;
        case 'updateFooter':
            footerEl.textContent = msg.text;
            break;
    }
});
`;
}

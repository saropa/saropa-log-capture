import * as vscode from 'vscode';
import { stripAnsi } from '../modules/ansi';
import { getNonce, getViewerStyles, getViewerScript } from './viewer-content';

const BATCH_INTERVAL_MS = 200;

interface PendingLine {
    readonly text: string;
    readonly isMarker: boolean;
    readonly lineCount: number;
    readonly category: string;
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
        webviewView.webview.html = this.buildHtml();

        this.startBatchTimer();

        webviewView.onDidDispose(() => {
            this.stopBatchTimer();
            this.view = undefined;
        });
    }

    /** Queue a log line for batched delivery to the webview. */
    addLine(text: string, isMarker: boolean, lineCount: number, category: string): void {
        this.pendingLines.push({ text: stripAnsi(text), isMarker, lineCount, category });
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

    /** Update the pause/resume indicator in the viewer footer. */
    setPaused(paused: boolean): void {
        this.postMessage({ type: 'setPaused', paused });
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
        const lineCount = lines[lines.length - 1].lineCount;
        this.postMessage({ type: 'addLines', lines, lineCount });
    }

    private postMessage(message: unknown): void {
        this.view?.webview.postMessage(message);
    }

    private buildHtml(): string {
        const nonce = getNonce();
        return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy"
          content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}';">
    <style nonce="${nonce}">
        ${getViewerStyles()}
    </style>
</head>
<body>
    <div id="log-content"></div>
    <button id="jump-btn" onclick="jumpToBottom()">Jump to Bottom</button>
    <div id="footer">
        <span id="footer-text">Waiting for debug session...</span>
        <button id="wrap-toggle">No Wrap</button>
    </div>
    <script nonce="${nonce}">
        ${getViewerScript()}
    </script>
</body>
</html>`;
    }
}

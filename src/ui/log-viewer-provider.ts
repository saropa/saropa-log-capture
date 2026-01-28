import * as vscode from 'vscode';
import { ansiToHtml, escapeHtml } from '../modules/ansi';
import { linkifyHtml } from '../modules/source-linker';
import { getNonce, buildViewerHtml } from './viewer-content';

const BATCH_INTERVAL_MS = 200;

interface PendingLine {
    readonly text: string;
    readonly isMarker: boolean;
    readonly lineCount: number;
    readonly category: string;
    readonly sourcePath?: string;
    readonly sourceLine?: number;
}

/**
 * Provides a webview-based sidebar panel that displays captured
 * debug output in real time with auto-scroll and theme support.
 */
export class LogViewerProvider implements vscode.WebviewViewProvider, vscode.Disposable {
    private view: vscode.WebviewView | undefined;
    private pendingLines: PendingLine[] = [];
    private batchTimer: ReturnType<typeof setInterval> | undefined;
    private onMarkerRequest?: () => void;
    private onLinkClick?: (path: string, line: number, col: number, split: boolean) => void;
    private onTogglePause?: () => void;
    private readonly seenCategories = new Set<string>();

    constructor(private readonly extensionUri: vscode.Uri) {}

    resolveWebviewView(webviewView: vscode.WebviewView): void {
        this.view = webviewView;
        webviewView.webview.options = { enableScripts: true, localResourceRoots: [] };
        webviewView.webview.html = this.buildHtml();

        webviewView.webview.onDidReceiveMessage((msg: Record<string, unknown>) => {
            if (msg.type === 'insertMarker' && this.onMarkerRequest) {
                this.onMarkerRequest();
            } else if (msg.type === 'togglePause' && this.onTogglePause) {
                this.onTogglePause();
            } else if (msg.type === 'linkClicked' && this.onLinkClick) {
                this.onLinkClick(
                    String(msg.path ?? ''),
                    Number(msg.line ?? 1),
                    Number(msg.col ?? 1),
                    Boolean(msg.splitEditor),
                );
            }
        });

        this.startBatchTimer();

        webviewView.onDidDispose(() => {
            this.stopBatchTimer();
            this.view = undefined;
        });
    }

    /** Set a callback invoked when the webview requests a marker insertion. */
    setMarkerHandler(handler: () => void): void {
        this.onMarkerRequest = handler;
    }

    /** Set a callback invoked when the webview requests pause toggle. */
    setTogglePauseHandler(handler: () => void): void {
        this.onTogglePause = handler;
    }

    /** Set a callback invoked when the webview requests source navigation. */
    setLinkClickHandler(handler: (path: string, line: number, col: number, split: boolean) => void): void {
        this.onLinkClick = handler;
    }

    /** Queue a log line for batched delivery to the webview. */
    addLine(
        text: string,
        isMarker: boolean,
        lineCount: number,
        category: string,
        sourcePath?: string,
        sourceLine?: number,
    ): void {
        const html = isMarker ? escapeHtml(text) : linkifyHtml(ansiToHtml(text));
        this.pendingLines.push({ text: html, isMarker, lineCount, category, sourcePath, sourceLine });
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

    /** Set the active log filename displayed in the footer. */
    setFilename(filename: string): void {
        this.postMessage({ type: 'setFilename', filename });
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
        this.sendNewCategories(lines);
    }

    private sendNewCategories(lines: readonly PendingLine[]): void {
        const newCats: string[] = [];
        for (const ln of lines) {
            if (!ln.isMarker && !this.seenCategories.has(ln.category)) {
                this.seenCategories.add(ln.category);
                newCats.push(ln.category);
            }
        }
        if (newCats.length > 0) {
            this.postMessage({ type: 'setCategories', categories: newCats });
        }
    }

    private postMessage(message: unknown): void {
        this.view?.webview.postMessage(message);
    }

    private buildHtml(): string {
        return buildViewerHtml(getNonce());
    }
}

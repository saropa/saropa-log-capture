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
    private onExclusionAdded?: (pattern: string) => void;
    private onAnnotationPrompt?: (lineIndex: number, current: string) => void;
    private readonly seenCategories = new Set<string>();
    private unreadWatchHits = 0;

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
            } else if (msg.type === 'copyToClipboard') {
                vscode.env.clipboard.writeText(String(msg.text ?? ''));
            } else if (msg.type === 'exclusionAdded') {
                this.onExclusionAdded?.(String(msg.pattern ?? ''));
            } else if (msg.type === 'promptAnnotation') {
                this.onAnnotationPrompt?.(Number(msg.lineIndex ?? 0), String(msg.current ?? ''));
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

        webviewView.onDidChangeVisibility(() => {
            if (webviewView.visible) {
                this.unreadWatchHits = 0;
                this.updateBadge();
            }
        });

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

    /** Set a callback invoked when an exclusion rule is added from the webview. */
    setExclusionAddedHandler(handler: (pattern: string) => void): void {
        this.onExclusionAdded = handler;
    }

    /** Push exclusion patterns to the webview. */
    setExclusions(patterns: readonly string[]): void {
        this.postMessage({ type: 'setExclusions', patterns });
    }

    /** Set a callback for annotation prompts from the webview. */
    setAnnotationPromptHandler(handler: (lineIndex: number, current: string) => void): void {
        this.onAnnotationPrompt = handler;
    }

    /** Send annotation text to the webview for a specific line. */
    setAnnotation(lineIndex: number, text: string): void {
        this.postMessage({ type: 'setAnnotation', lineIndex, text });
    }

    /** Load all annotations into the webview. */
    loadAnnotations(annotations: readonly { lineIndex: number; text: string }[]): void {
        this.postMessage({ type: 'loadAnnotations', annotations });
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

    /** Send keyword watch hit counts to the webview footer and update badge. */
    updateWatchCounts(counts: ReadonlyMap<string, number>): void {
        const obj: Record<string, number> = {};
        let total = 0;
        for (const [label, count] of counts) {
            obj[label] = count;
            total += count;
        }
        this.postMessage({ type: 'updateWatchCounts', counts: obj });
        if (total > this.unreadWatchHits) {
            this.unreadWatchHits = total;
            this.updateBadge();
        }
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

    private updateBadge(): void {
        if (this.view) {
            this.view.badge = this.unreadWatchHits > 0
                ? { value: this.unreadWatchHits, tooltip: `${this.unreadWatchHits} watch hits` }
                : undefined;
        }
    }

    private postMessage(message: unknown): void {
        this.view?.webview.postMessage(message);
    }

    private buildHtml(): string {
        return buildViewerHtml(getNonce());
    }
}

import * as vscode from 'vscode';
import { ansiToHtml, escapeHtml } from '../modules/ansi';
import { linkifyHtml } from '../modules/source-linker';
import { resolveSourceUri } from '../modules/source-resolver';
import { getNonce, buildViewerHtml } from './viewer-content';
import { LineData } from '../modules/session-manager';
import { isFrameworkFrame } from '../modules/stack-parser';
import { HighlightRule } from '../modules/highlight-rules';

const BATCH_INTERVAL_MS = 200;

interface PendingLine {
    readonly text: string;
    readonly isMarker: boolean;
    readonly lineCount: number;
    readonly category: string;
    readonly timestamp: number;
    readonly fw?: boolean;
}

/**
 * Serialized highlight rule format for sending to the webview.
 * Pattern and flags are separated since RegExp can't be serialized via postMessage.
 */
interface SerializedHighlightRule {
    readonly pattern: string;
    readonly flags: string;
    readonly color?: string;
    readonly backgroundColor?: string;
    readonly fontWeight?: string;
    readonly fontStyle?: string;
    readonly label: string;
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
    private onPartNavigate?: (part: number) => void;
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
            } else if (msg.type === 'requestSourcePreview') {
                this.handleSourcePreviewRequest(
                    String(msg.path ?? ''),
                    Number(msg.line ?? 1),
                );
            } else if (msg.type === 'navigatePart' && this.onPartNavigate) {
                this.onPartNavigate(Number(msg.part ?? 1));
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

    /** Set a callback for split part navigation requests. */
    setPartNavigateHandler(handler: (part: number) => void): void {
        this.onPartNavigate = handler;
    }

    /** Update the split breadcrumb in the viewer. */
    setSplitInfo(currentPart: number, totalParts: number): void {
        this.postMessage({ type: 'splitInfo', currentPart, totalParts });
    }

    /** Queue a log line for batched delivery to the webview. */
    addLine(data: LineData): void {
        const html = data.isMarker ? escapeHtml(data.text) : linkifyHtml(ansiToHtml(data.text));
        const fw = this.classifyFrame(data.text);
        this.pendingLines.push({
            text: html, isMarker: data.isMarker, lineCount: data.lineCount,
            category: data.category, timestamp: data.timestamp.getTime(), fw,
        });
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

    /** Toggle elapsed time display in the viewer. */
    setShowElapsed(show: boolean): void {
        this.postMessage({ type: 'setShowElapsed', show });
    }

    /**
     * Send highlight rules to the webview.
     * Rules are serialized with pattern and flags separated for webview-side
     * RegExp compilation (since RegExp objects can't be sent via postMessage).
     *
     * @param rules - Array of highlight rules from configuration
     */
    setHighlightRules(rules: readonly HighlightRule[]): void {
        const serialized = this.serializeHighlightRules(rules);
        this.postMessage({ type: 'setHighlightRules', rules: serialized });
    }

    /**
     * Serialize highlight rules for transmission to the webview.
     * Converts pattern strings to { pattern, flags } format and includes style info.
     * Invalid patterns are filtered out.
     */
    private serializeHighlightRules(rules: readonly HighlightRule[]): SerializedHighlightRule[] {
        const result: SerializedHighlightRule[] = [];

        for (const rule of rules) {
            if (!rule.pattern) {
                continue;
            }

            // Parse the pattern to extract regex source and flags
            const parsed = this.parsePatternForSerialization(rule.pattern);
            if (!parsed) {
                continue;
            }

            result.push({
                pattern: parsed.source,
                flags: parsed.flags,
                color: rule.color,
                backgroundColor: rule.backgroundColor,
                fontWeight: rule.bold ? 'bold' : undefined,
                fontStyle: rule.italic ? 'italic' : undefined,
                label: rule.label ?? rule.pattern,
            });
        }

        return result;
    }

    /**
     * Parse a pattern string into regex source and flags.
     * Handles both /regex/flags format and plain strings.
     */
    private parsePatternForSerialization(pattern: string): { source: string; flags: string } | undefined {
        // Check for regex literal format: /pattern/flags
        const regexMatch = pattern.match(/^\/(.+)\/([gimsuy]*)$/);
        if (regexMatch) {
            try {
                // Validate the regex is valid
                new RegExp(regexMatch[1], regexMatch[2]);
                return { source: regexMatch[1], flags: regexMatch[2] };
            } catch {
                return undefined;
            }
        }

        // Plain string: escape special chars for case-insensitive match
        const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return { source: escaped, flags: 'i' };
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

    /** Classify a line as framework code if it looks like a stack frame. */
    private classifyFrame(text: string): boolean | undefined {
        if (!/^\s+at\s/.test(text)) {
            return undefined;
        }
        const ws = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        return isFrameworkFrame(text, ws);
    }

    private buildHtml(): string {
        return buildViewerHtml(getNonce());
    }

    /** Handle a source preview request from the webview. */
    private async handleSourcePreviewRequest(path: string, line: number): Promise<void> {
        const CONTEXT_LINES = 2; // Show 2 lines before and after (total 5 lines)
        try {
            const uri = resolveSourceUri(path);
            if (!uri) {
                this.postMessage({ type: 'sourcePreview', path, line, error: 'Cannot resolve path' });
                return;
            }

            const doc = await vscode.workspace.openTextDocument(uri);
            const startLine = Math.max(0, line - CONTEXT_LINES - 1);
            const endLine = Math.min(doc.lineCount, line + CONTEXT_LINES);
            const lines: string[] = [];

            for (let i = startLine; i < endLine; i++) {
                lines.push(doc.lineAt(i).text);
            }

            this.postMessage({
                type: 'sourcePreview',
                path,
                line,
                lines,
                startLine: startLine + 1, // 1-indexed for display
            });
        } catch {
            this.postMessage({ type: 'sourcePreview', path, line, error: 'File not found' });
        }
    }
}

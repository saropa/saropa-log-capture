/**
 * Inline Code Decorations
 *
 * Shows inline text decorations in the editor next to lines that produced log output.
 * When a log line contains a source reference (file:line), we track it and can
 * optionally show a decoration in the editor indicating this line produced output.
 */

import * as vscode from 'vscode';
import { stripAnsi } from '../modules/ansi';

/** A decoration entry for a specific line in a file. */
interface LineDecoration {
    readonly line: number;
    readonly count: number;
    readonly lastText: string;
    readonly category: string;
}

/** Decoration data per file URI string. */
type FileDecorations = Map<number, LineDecoration>;

/** Options for the inline decorations feature. */
interface InlineDecorationsOptions {
    readonly showCount?: boolean;
    readonly showPreview?: boolean;
    readonly maxPreviewLength?: number;
}

const DEFAULT_OPTIONS: InlineDecorationsOptions = {
    showCount: true,
    showPreview: true,
    maxPreviewLength: 40,
};

/**
 * Manages inline code decorations that show log output indicators in the editor.
 */
export class InlineDecorationsProvider implements vscode.Disposable {
    private readonly decorationType: vscode.TextEditorDecorationType;
    private readonly fileDecorations = new Map<string, FileDecorations>();
    private readonly disposables: vscode.Disposable[] = [];
    private enabled = false;
    private options: InlineDecorationsOptions;

    constructor(options: InlineDecorationsOptions = DEFAULT_OPTIONS) {
        this.options = { ...DEFAULT_OPTIONS, ...options };

        // Create decoration type with subtle styling
        this.decorationType = vscode.window.createTextEditorDecorationType({
            after: {
                margin: '0 0 0 1em',
                color: new vscode.ThemeColor('editorCodeLens.foreground'),
            },
            rangeBehavior: vscode.DecorationRangeBehavior.ClosedOpen,
        });

        // Update decorations when active editor changes
        this.disposables.push(
            vscode.window.onDidChangeActiveTextEditor(() => this.updateActiveEditor()),
        );

        // Update decorations when document changes
        this.disposables.push(
            vscode.workspace.onDidChangeTextDocument((e) => {
                if (vscode.window.activeTextEditor?.document === e.document) {
                    this.updateActiveEditor();
                }
            }),
        );
    }

    /** Enable inline decorations. */
    enable(): void {
        this.enabled = true;
        this.updateActiveEditor();
    }

    /** Disable inline decorations and clear all. */
    disable(): void {
        this.enabled = false;
        this.clearAllDecorations();
    }

    /** Check if decorations are enabled. */
    isEnabled(): boolean {
        return this.enabled;
    }

    /** Toggle the enabled state. */
    toggle(): boolean {
        if (this.enabled) {
            this.disable();
        } else {
            this.enable();
        }
        return this.enabled;
    }

    /**
     * Record a log line that came from a specific source location.
     * Call this when a log line is captured that has a source reference.
     */
    recordLogLine(filePath: string, line: number, text: string, category: string): void {
        const uriKey = this.normalizeUri(filePath);
        let fileMap = this.fileDecorations.get(uriKey);
        if (!fileMap) {
            fileMap = new Map();
            this.fileDecorations.set(uriKey, fileMap);
        }

        const existing = fileMap.get(line);
        const stripped = stripAnsi(text).trim();
        fileMap.set(line, {
            line,
            count: (existing?.count ?? 0) + 1,
            lastText: stripped.slice(0, this.options.maxPreviewLength ?? 40),
            category,
        });

        // Update if this file is currently visible
        if (this.enabled) {
            this.updateActiveEditor();
        }
    }

    /** Clear decorations for a specific file. */
    clearFile(filePath: string): void {
        const uriKey = this.normalizeUri(filePath);
        this.fileDecorations.delete(uriKey);
        this.updateActiveEditor();
    }

    /** Clear all decorations and recorded data. */
    clearAll(): void {
        this.fileDecorations.clear();
        this.clearAllDecorations();
    }

    dispose(): void {
        this.clearAllDecorations();
        this.decorationType.dispose();
        for (const d of this.disposables) {
            d.dispose();
        }
    }

    /** Update decorations for the active editor. */
    private updateActiveEditor(): void {
        const editor = vscode.window.activeTextEditor;
        if (!editor || !this.enabled) {
            return;
        }

        const uriKey = this.normalizeUri(editor.document.uri.fsPath);
        const fileMap = this.fileDecorations.get(uriKey);

        if (!fileMap || fileMap.size === 0) {
            editor.setDecorations(this.decorationType, []);
            return;
        }

        const decorations: vscode.DecorationOptions[] = [];

        for (const [lineNum, data] of fileMap) {
            // Lines are 1-indexed from source, VSCode is 0-indexed
            const line = lineNum - 1;
            if (line < 0 || line >= editor.document.lineCount) {
                continue;
            }

            const lineRange = editor.document.lineAt(line).range;
            const text = this.formatDecorationText(data);

            decorations.push({
                range: new vscode.Range(lineRange.end, lineRange.end),
                renderOptions: {
                    after: {
                        contentText: text,
                    },
                },
            });
        }

        editor.setDecorations(this.decorationType, decorations);
    }

    /** Format the decoration text based on options. */
    private formatDecorationText(data: LineDecoration): string {
        const parts: string[] = [];

        if (this.options.showCount && data.count > 1) {
            parts.push(`(x${data.count})`);
        }

        if (this.options.showPreview && data.lastText) {
            const preview = data.lastText.length > 30
                ? data.lastText.slice(0, 30) + '...'
                : data.lastText;
            parts.push(`"${preview}"`);
        }

        if (parts.length === 0) {
            return '• logged';
        }

        return '• ' + parts.join(' ');
    }

    /** Clear decorations from all visible editors. */
    private clearAllDecorations(): void {
        for (const editor of vscode.window.visibleTextEditors) {
            editor.setDecorations(this.decorationType, []);
        }
    }

    /** Normalize a file path to a consistent URI key. */
    private normalizeUri(filePath: string): string {
        // Normalize path separators and case for comparison
        return filePath.toLowerCase().replace(/\\/g, '/');
    }
}

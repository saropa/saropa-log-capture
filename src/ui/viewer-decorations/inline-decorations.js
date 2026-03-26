"use strict";
/**
 * Inline Code Decorations
 *
 * Shows inline text decorations in the editor next to lines that produced log output.
 * When a log line contains a source reference (file:line), we track it and can
 * optionally show a decoration in the editor indicating this line produced output.
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
exports.InlineDecorationsProvider = void 0;
const vscode = __importStar(require("vscode"));
const ansi_1 = require("../../modules/capture/ansi");
const DEFAULT_OPTIONS = {
    showCount: true,
    showPreview: true,
    maxPreviewLength: 40,
};
/**
 * Manages inline code decorations that show log output indicators in the editor.
 */
class InlineDecorationsProvider {
    decorationType;
    fileDecorations = new Map();
    disposables = [];
    enabled = false;
    options;
    updateTimer;
    constructor(options = DEFAULT_OPTIONS) {
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
        this.disposables.push(vscode.window.onDidChangeActiveTextEditor(() => this.scheduleUpdate()));
        // Update decorations when document changes
        this.disposables.push(vscode.workspace.onDidChangeTextDocument((e) => {
            if (vscode.window.activeTextEditor?.document === e.document) {
                this.scheduleUpdate();
            }
        }));
    }
    /** Enable inline decorations. */
    enable() {
        this.enabled = true;
        this.updateActiveEditor();
    }
    /** Disable inline decorations and clear all. */
    disable() {
        this.enabled = false;
        this.clearAllDecorations();
    }
    /** Check if decorations are enabled. */
    isEnabled() {
        return this.enabled;
    }
    /** Toggle the enabled state. */
    toggle() {
        if (this.enabled) {
            this.disable();
        }
        else {
            this.enable();
        }
        return this.enabled;
    }
    /**
     * Record a log line that came from a specific source location.
     * Call this when a log line is captured that has a source reference.
     */
    recordLogLine(filePath, line, text, category) {
        const uriKey = this.normalizeUri(filePath);
        let fileMap = this.fileDecorations.get(uriKey);
        if (!fileMap) {
            fileMap = new Map();
            this.fileDecorations.set(uriKey, fileMap);
        }
        const existing = fileMap.get(line);
        const stripped = (0, ansi_1.stripAnsi)(text).trim();
        fileMap.set(line, {
            line,
            count: (existing?.count ?? 0) + 1,
            lastText: stripped.slice(0, this.options.maxPreviewLength ?? 40),
            category,
        });
        // Update if this file is currently visible
        if (this.enabled) {
            this.scheduleUpdate();
        }
    }
    /** Clear decorations for a specific file. */
    clearFile(filePath) {
        const uriKey = this.normalizeUri(filePath);
        this.fileDecorations.delete(uriKey);
        this.updateActiveEditor();
    }
    /** Clear all decorations and recorded data. */
    clearAll() {
        this.fileDecorations.clear();
        this.clearAllDecorations();
    }
    dispose() {
        if (this.updateTimer) {
            clearTimeout(this.updateTimer);
        }
        this.clearAllDecorations();
        this.decorationType.dispose();
        for (const d of this.disposables) {
            d.dispose();
        }
    }
    /** Debounced update — avoids hammering the renderer during high-volume output. */
    scheduleUpdate() {
        if (this.updateTimer) {
            return;
        }
        this.updateTimer = setTimeout(() => {
            this.updateTimer = undefined;
            this.updateActiveEditor();
        }, 200);
    }
    /** Update decorations for the active editor. */
    updateActiveEditor() {
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
        const decorations = [];
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
    formatDecorationText(data) {
        const parts = [];
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
    clearAllDecorations() {
        for (const editor of vscode.window.visibleTextEditors) {
            editor.setDecorations(this.decorationType, []);
        }
    }
    /** Normalize a file path to a consistent URI key. */
    normalizeUri(filePath) {
        // Normalize path separators and case for comparison
        return filePath.toLowerCase().replace(/\\/g, '/');
    }
}
exports.InlineDecorationsProvider = InlineDecorationsProvider;
//# sourceMappingURL=inline-decorations.js.map
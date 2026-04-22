"use strict";
/**
 * Writes debug output to a log file. Created by session-lifecycle.initializeSession;
 * receives lines from SessionManager (DAP → tracker → SessionManager → appendLine).
 * Handles file splitting, deduplication, max lines, and markers.
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
exports.LogSession = void 0;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const deduplication_1 = require("./deduplication");
const file_splitter_1 = require("../misc/file-splitter");
const log_session_helpers_1 = require("./log-session-helpers");
const log_session_split_1 = require("./log-session-split");
class LogSession {
    context;
    config;
    onLineCountChanged;
    _state = 'recording';
    _lineCount = 0;
    _fileUri;
    writeStream;
    /** Guard flag — prevents writes to a stream being closed during split. */
    splitting = false;
    /** Guard flag — prevents concurrent queue processors. */
    processingQueue = false;
    /** Buffered appends while split is in progress; ensures newest lines are never dropped. */
    pendingLines = [];
    deduplicator;
    splitter;
    // Split tracking
    _partNumber = 0;
    _bytesWritten = 0;
    _partStartTime = Date.now();
    _lastLineTime = 0;
    _lastWriteTime = 0;
    _previousTimestamp;
    _baseFileName = '';
    onSplit;
    get state() { return this._state; }
    get lineCount() { return this._lineCount; }
    get fileUri() { return this._fileUri; }
    get partNumber() { return this._partNumber; }
    get bytesWritten() { return this._bytesWritten; }
    get startTime() { return this._partStartTime; }
    /** Time (ms since epoch) of last write to this session (for "recent updates" UI). */
    get lastWriteTime() { return this._lastWriteTime; }
    /** Session context (for integration API). */
    get sessionContext() { return this.context; }
    constructor(context, config, onLineCountChanged) {
        this.context = context;
        this.config = config;
        this.onLineCountChanged = onLineCountChanged;
        this.deduplicator = new deduplication_1.Deduplicator();
        this.splitter = new file_splitter_1.FileSplitter(config.splitRules);
    }
    /** Set a callback for when the file splits. */
    setSplitCallback(callback) {
        this.onSplit = callback;
    }
    /** Create log directory, open first part file, write context header (and optional integration header lines). */
    async start(extraHeaderLines) {
        const logDirUri = (0, log_session_helpers_1.getLogDirUri)(this.context, this.config);
        const logDirPath = logDirUri.fsPath;
        await fs.promises.mkdir(logDirPath, { recursive: true });
        // Generate base filename (without part suffix)
        this._baseFileName = (0, log_session_helpers_1.generateBaseFileName)(this.context.projectName, this.context.date);
        const fileName = (0, log_session_split_1.getPartFileName)(this._baseFileName, this._partNumber);
        const filePath = path.join(logDirPath, fileName);
        this._fileUri = vscode.Uri.file(filePath);
        this.writeStream = fs.createWriteStream(filePath, {
            flags: 'a',
            encoding: 'utf-8',
        });
        const header = (0, log_session_helpers_1.generateContextHeader)(this.context, this.config, extraHeaderLines);
        this.writeStream.write(header);
        this._bytesWritten = Buffer.byteLength(header, 'utf-8');
        this._partStartTime = Date.now();
    }
    appendLine(text, category, timestamp, sourceLocation) {
        if (this._state !== 'recording' || !this.writeStream) {
            return;
        }
        this.pendingLines.push({ text, category, timestamp, sourceLocation });
        this.processPendingLines().catch((e) => { console.error('Log append queue failed:', e); });
    }
    /** Process append queue in strict order and split before writes when needed. */
    async processPendingLines() {
        if (this.processingQueue) {
            return;
        }
        this.processingQueue = true;
        try {
            while (this.pendingLines.length > 0) {
                if (this._state !== 'recording' || !this.writeStream) {
                    return;
                }
                const next = this.pendingLines[0];
                await this.splitBeforeNextLineIfNeeded(next.text);
                const elapsedMs = (0, log_session_helpers_1.computeElapsed)(this.config.includeElapsedTime, this._previousTimestamp, next.timestamp);
                const formatted = (0, log_session_helpers_1.formatLine)(next.text, next.category, {
                    timestamp: next.timestamp,
                    includeTimestamp: this.config.includeTimestamp,
                    sourceLocation: next.sourceLocation,
                    includeSourceLocation: this.config.includeSourceLocation,
                    elapsedMs,
                    includeElapsedTime: this.config.includeElapsedTime,
                });
                this._previousTimestamp = next.timestamp;
                /* Capture-side deduplication is intentionally bypassed: the
                   unified line-collapsing rethink (bugs/unified-line-collapsing.md)
                   moves every collapse/hide to the viewer layer so line numbers
                   in the captured file match the app's actual output 1:1. Each
                   incoming line is written as its own row; identical-within-500ms
                   runs that the old Deduplicator would have folded to `(xN)`
                   suffix are now folded visually in the viewer via .bar-hidden-rows
                   (click to expand) and preserve per-line timestamps in the file. */
                await this.writeProcessedLines([formatted]);
                this.pendingLines.shift();
                this._lastLineTime = Date.now();
                this._lastWriteTime = this._lastLineTime;
                this.onLineCountChanged(this._lineCount);
            }
        }
        finally {
            this.processingQueue = false;
        }
    }
    /** Wait until buffered appendLine calls are flushed to disk. */
    async drainPendingLines() {
        while (this.pendingLines.length > 0 || this.processingQueue) {
            if (!this.processingQueue && this.pendingLines.length > 0) {
                await this.processPendingLines();
                continue;
            }
            await new Promise((resolve) => setTimeout(resolve, 0));
        }
    }
    /** Rotate part when max line threshold or explicit split rules are reached. */
    async splitBeforeNextLineIfNeeded(nextText) {
        if (!this.writeStream) {
            return;
        }
        if (this.config.maxLines > 0 && this._lineCount >= this.config.maxLines) {
            await this.performSplit({ type: 'lines', count: this._lineCount });
        }
        const splitResult = this.splitter.evaluate({
            lineCount: this._lineCount,
            bytesWritten: this._bytesWritten,
            startTime: this._partStartTime,
            lastLineTime: this._lastLineTime,
        }, nextText);
        if (splitResult.shouldSplit && splitResult.reason) {
            await this.performSplit(splitResult.reason);
        }
    }
    /** Write deduplicated lines and rotate mid-batch instead of dropping newest output. */
    async writeProcessedLines(lines) {
        for (const line of lines) {
            if (!this.writeStream) {
                return;
            }
            if (this.config.maxLines > 0 && this._lineCount >= this.config.maxLines) {
                await this.performSplit({ type: 'lines', count: this._lineCount });
            }
            if (!this.writeStream) {
                return;
            }
            const lineData = line + '\n';
            this.writeStream.write(lineData);
            this._bytesWritten += Buffer.byteLength(lineData, 'utf-8');
            this._lineCount++;
        }
    }
    /**
     * Insert a visual marker/separator into the log file.
     * Bypasses deduplication — markers should never be grouped.
     * @returns The marker text written, or undefined if not recording.
     */
    appendMarker(customText) {
        if (this._state === 'stopped' || !this.writeStream || this.splitting) {
            return undefined;
        }
        const now = new Date();
        const ts = now.toLocaleTimeString();
        const label = customText ? `${ts} — ${customText}` : ts;
        const markerLine = `\n--- MARKER: ${label} ---\n`;
        this.writeStream.write(markerLine + '\n');
        this._lastWriteTime = Date.now();
        this._lineCount++;
        this.onLineCountChanged(this._lineCount);
        return markerLine.trim();
    }
    /**
     * Append a pre-formatted DAP protocol line to the log file.
     * Bypasses deduplication and does not increment _lineCount
     * (DAP lines are diagnostic infrastructure, not user output).
     */
    appendDapLine(formatted) {
        if (this._state !== 'recording' || !this.writeStream || this.splitting) {
            return;
        }
        const lineData = formatted + '\n';
        this.writeStream.write(lineData);
        this._bytesWritten += Buffer.byteLength(lineData, 'utf-8');
    }
    /**
     * Append extra header lines (e.g. from async build/CI). Call only while recording.
     * Does not increment _lineCount; used for late-arriving integration header data.
     */
    appendHeaderLines(lines) {
        if (this._state !== 'recording' || !this.writeStream || this.splitting || lines.length === 0) {
            return;
        }
        const block = '\n' + lines.join('\n') + '\n';
        this.writeStream.write(block);
        this._bytesWritten += Buffer.byteLength(block, 'utf-8');
    }
    /** Manually trigger a file split. */
    async splitNow() {
        if (this._state === 'stopped' || !this.writeStream) {
            return;
        }
        await this.performSplit({ type: 'manual' });
    }
    /** Perform a file split: close current stream, open new part file, notify listeners. */
    async performSplit(reason) {
        if (!this.writeStream || this.splitting) {
            return;
        }
        this.splitting = true;
        try {
            const result = await (0, log_session_split_1.performFileSplit)({
                writeStream: this.writeStream,
                logDirPath: (0, log_session_helpers_1.getLogDirUri)(this.context, this.config).fsPath,
                baseFileName: this._baseFileName,
                partNumber: this._partNumber,
                context: this.context,
            }, reason);
            this.writeStream = result.newStream;
            this._fileUri = result.newFileUri;
            this._partNumber = result.newPartNumber;
            this._bytesWritten = result.headerBytes;
            this._partStartTime = Date.now();
            this._lastLineTime = 0;
        }
        finally {
            this.splitting = false;
        }
        this.onSplit?.(this._fileUri, this._partNumber, reason);
    }
    pause() {
        if (this._state === 'recording') {
            this._state = 'paused';
        }
    }
    resume() {
        if (this._state === 'paused') {
            this._state = 'recording';
        }
    }
    async stop() {
        if (this._state === 'stopped') {
            return;
        }
        // Preserve newest output by flushing any queued appendLine calls before closing.
        await this.drainPendingLines();
        this._state = 'stopped';
        // Capture-side deduplication bypassed — no pending fold buffer to flush.
        // (See the drainPendingLines comment for the "every raw line is written"
        //  rationale.) Kept calling deduplicator.flush() for defensive state
        // reset in case a future code path resurfaces capture-side folding.
        if (this.writeStream) {
            this.deduplicator.flush(); /* no-op under bypass; discards any state. */
            const footer = `\n=== SESSION END — ${new Date().toISOString()} — ${this._lineCount} lines ===\n`;
            this.writeStream.write(footer);
            await new Promise((resolve, reject) => {
                this.writeStream.end(() => resolve());
                this.writeStream.on('error', reject);
            });
        }
        this.onLineCountChanged(this._lineCount);
    }
    clear() {
        this._lineCount = 0;
        this._previousTimestamp = undefined;
        this.pendingLines.length = 0;
        this.deduplicator.reset();
        this.onLineCountChanged(0);
    }
}
exports.LogSession = LogSession;
//# sourceMappingURL=log-session.js.map
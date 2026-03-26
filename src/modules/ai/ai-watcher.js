"use strict";
/**
 * Watches a Claude Code JSONL session file for new AI activity.
 *
 * Uses byte-offset tailing (reads only new bytes on change) and a
 * lookback scan on startup to surface recent activity from before
 * the debug session started.
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
exports.AiWatcher = void 0;
const fs = __importStar(require("fs"));
const vscode = __importStar(require("vscode"));
const ai_jsonl_parser_1 = require("./ai-jsonl-parser");
const ai_session_resolver_1 = require("./ai-session-resolver");
/** Maximum bytes to read when performing the initial lookback scan. */
const lookbackBytes = 256 * 1024;
/** Default debounce interval between reads (ms). */
const defaultDebounceMs = 500;
class AiWatcher {
    outputChannel;
    _onEntries = new vscode.EventEmitter();
    onEntries = this._onEntries.event;
    watcher = null;
    filePath = null;
    byteOffset = 0;
    debounceTimer = null;
    debounceMs = defaultDebounceMs;
    disposed = false;
    /** Tracks emitted tool calls to prevent streaming duplicates during tailing. */
    seenToolKeys = new Set();
    static maxSeenKeys = 10_000;
    constructor(outputChannel) {
        this.outputChannel = outputChannel;
    }
    /**
     * Start watching for the given workspace path.
     * Performs a lookback scan, then begins tailing the JSONL file.
     */
    async start(workspacePath, options) {
        this.stop();
        const session = await (0, ai_session_resolver_1.resolveActiveSession)(workspacePath);
        if (!session) {
            return;
        }
        this.filePath = session.filePath;
        this.debounceMs = options.debounceMs ?? defaultDebounceMs;
        this.outputChannel.appendLine(`[AI] Watching ${session.filePath}`);
        await this.performLookback(options.lookbackMs);
        this.startFsWatcher();
    }
    /** Stop watching and release resources. */
    stop() {
        if (this.watcher) {
            this.watcher.close();
            this.watcher = null;
        }
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = null;
        }
        this.filePath = null;
        this.byteOffset = 0;
        this.seenToolKeys.clear();
    }
    dispose() {
        this.disposed = true;
        this.stop();
        this._onEntries.dispose();
    }
    /** Read the tail of the file to find recent activity within the lookback window. */
    async performLookback(lookbackMs) {
        if (!this.filePath) {
            return;
        }
        const cutoff = new Date(Date.now() - lookbackMs);
        let stat;
        try {
            stat = await fs.promises.stat(this.filePath);
        }
        catch {
            return;
        }
        const fileSize = stat.size;
        const readStart = Math.max(0, fileSize - lookbackBytes);
        const chunk = await this.readRange(readStart, fileSize);
        if (!chunk) {
            return;
        }
        // Skip partial first line if we didn't start at byte 0
        const text = readStart > 0 ? chunk.substring(chunk.indexOf('\n') + 1) : chunk;
        const entries = (0, ai_jsonl_parser_1.parseJsonlChunk)(text).filter(e => e.timestamp >= cutoff);
        // Seed dedup set so tailing doesn't re-emit lookback entries
        for (const e of entries) {
            this.trackEntry(e);
        }
        this.byteOffset = fileSize;
        if (entries.length > 0) {
            this.outputChannel.appendLine(`[AI] Lookback found ${entries.length} entries`);
            this._onEntries.fire(entries);
        }
    }
    startFsWatcher() {
        if (!this.filePath || this.disposed) {
            return;
        }
        try {
            this.watcher = fs.watch(this.filePath, () => this.onFileChange());
        }
        catch (err) {
            this.outputChannel.appendLine(`[AI] Watch failed: ${err}`);
        }
    }
    onFileChange() {
        if (this.debounceTimer) {
            return;
        }
        this.debounceTimer = setTimeout(() => {
            this.debounceTimer = null;
            this.readNewBytes().catch(err => {
                this.outputChannel.appendLine(`[AI] Read error: ${err}`);
            });
        }, this.debounceMs);
    }
    async readNewBytes() {
        if (!this.filePath || this.disposed) {
            return;
        }
        let stat;
        try {
            stat = await fs.promises.stat(this.filePath);
        }
        catch {
            return;
        }
        if (stat.size <= this.byteOffset) {
            // File shrank (rotation) — reset to start
            if (stat.size < this.byteOffset) {
                this.byteOffset = 0;
            }
            return;
        }
        const chunk = await this.readRange(this.byteOffset, stat.size);
        this.byteOffset = stat.size;
        if (!chunk) {
            return;
        }
        const fresh = (0, ai_jsonl_parser_1.parseJsonlChunk)(chunk).filter(e => this.isNewEntry(e));
        if (fresh.length > 0) {
            this._onEntries.fire(fresh);
        }
    }
    /** Build a dedup key for tool-call entries: messageId:toolName:filePath. */
    toolKey(e) {
        if (e.type !== 'tool-call' || !e.toolCall) {
            return null;
        }
        return `${e.messageId ?? ''}:${e.toolCall.toolName}:${e.toolCall.filePath ?? ''}`;
    }
    /** Track an entry in the dedup set. */
    trackEntry(e) {
        const key = this.toolKey(e);
        if (key) {
            this.seenToolKeys.add(key);
        }
    }
    /** Returns true if the entry hasn't been emitted before (and tracks it). */
    isNewEntry(e) {
        const key = this.toolKey(e);
        if (!key) {
            return true;
        } // Non-tool entries always pass through
        if (this.seenToolKeys.has(key)) {
            return false;
        }
        // Prevent unbounded growth — clear and accept rare re-emission
        if (this.seenToolKeys.size >= AiWatcher.maxSeenKeys) {
            this.seenToolKeys.clear();
        }
        this.seenToolKeys.add(key);
        return true;
    }
    async readRange(start, end) {
        if (!this.filePath || start >= end) {
            return null;
        }
        return new Promise((resolve) => {
            const chunks = [];
            const stream = fs.createReadStream(this.filePath, {
                start, end: end - 1, encoding: undefined,
            });
            stream.on('data', (data) => chunks.push(Buffer.isBuffer(data) ? data : Buffer.from(data)));
            stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
            stream.on('error', () => resolve(null));
        });
    }
}
exports.AiWatcher = AiWatcher;
//# sourceMappingURL=ai-watcher.js.map
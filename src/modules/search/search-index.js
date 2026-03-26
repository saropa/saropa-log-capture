"use strict";
/**
 * Lazy on-disk search index for faster repeated searches.
 * Caches file line counts and content hashes to skip unchanged files.
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
exports.SearchIndexManager = void 0;
const vscode = __importStar(require("vscode"));
const config_1 = require("../config/config");
const INDEX_VERSION = 1;
/**
 * Manages a search index for log files.
 * Tracks file metadata to detect changes.
 */
class SearchIndexManager {
    logDirUri;
    index;
    indexUri;
    constructor(logDirUri) {
        this.logDirUri = logDirUri;
        this.indexUri = vscode.Uri.joinPath(logDirUri, '.search-index.json');
    }
    /** Load the index from disk if available. */
    async load() {
        if (this.index) {
            return this.index;
        }
        if (!this.indexUri) {
            return undefined;
        }
        try {
            const data = await vscode.workspace.fs.readFile(this.indexUri);
            const parsed = JSON.parse(Buffer.from(data).toString('utf-8'));
            if (parsed.version === INDEX_VERSION) {
                this.index = parsed;
                return this.index;
            }
        }
        catch {
            // Index doesn't exist or is invalid
        }
        return undefined;
    }
    /** Save the index to disk. */
    async save() {
        if (!this.index || !this.indexUri) {
            return;
        }
        try {
            const json = JSON.stringify(this.index, null, 2);
            await vscode.workspace.fs.writeFile(this.indexUri, Buffer.from(json, 'utf-8'));
        }
        catch {
            // Failed to save, ignore
        }
    }
    /** Build or update the index by scanning log files. */
    async rebuild() {
        const files = [];
        const { fileTypes, includeSubfolders } = (0, config_1.getConfig)();
        const tracked = await (0, config_1.readTrackedFiles)(this.logDirUri, fileTypes, includeSubfolders);
        for (const rel of tracked) {
            const entry = await this.indexFile(vscode.Uri.joinPath(this.logDirUri, rel));
            if (entry) {
                files.push(entry);
            }
        }
        this.index = {
            version: INDEX_VERSION,
            files,
            buildTime: Date.now(),
        };
        return this.index;
    }
    /** Index a single file, returning its metadata. */
    async indexFile(uri) {
        try {
            const stat = await vscode.workspace.fs.stat(uri);
            const data = await vscode.workspace.fs.readFile(uri);
            const content = Buffer.from(data).toString('utf-8');
            const lineCount = content.split('\n').length;
            return {
                uri: uri.toString(),
                lineCount,
                sizeBytes: stat.size,
                mtime: stat.mtime,
            };
        }
        catch {
            return undefined;
        }
    }
    /** Check if a file has changed since indexing. */
    async hasFileChanged(uri) {
        if (!this.index) {
            return true;
        }
        const entry = this.index.files.find(f => f.uri === uri.toString());
        if (!entry) {
            return true;
        }
        try {
            const stat = await vscode.workspace.fs.stat(uri);
            return stat.mtime !== entry.mtime || stat.size !== entry.sizeBytes;
        }
        catch {
            return true;
        }
    }
    /** Get the index if fresh enough, or rebuild. */
    async getOrRebuild(maxAgeMs = 60000) {
        const existing = await this.load();
        if (existing && Date.now() - existing.buildTime < maxAgeMs) {
            return existing;
        }
        return this.rebuild();
    }
    /** Get total line count across all indexed files. */
    getTotalLineCount() {
        if (!this.index) {
            return 0;
        }
        return this.index.files.reduce((sum, f) => sum + f.lineCount, 0);
    }
    /** Get total size in bytes across all indexed files. */
    getTotalSize() {
        if (!this.index) {
            return 0;
        }
        return this.index.files.reduce((sum, f) => sum + f.sizeBytes, 0);
    }
    /** Clear the cached index. */
    clear() {
        this.index = undefined;
    }
}
exports.SearchIndexManager = SearchIndexManager;
//# sourceMappingURL=search-index.js.map
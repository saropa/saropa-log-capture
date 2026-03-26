"use strict";
/**
 * Lightweight, delta-aware project indexer for docs/bugs/root and reports.
 * Index files live in .saropa/index/; reports use .session-metadata.json.
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
exports.ProjectIndexer = exports.setGlobalProjectIndexer = exports.getGlobalProjectIndexer = void 0;
const vscode = __importStar(require("vscode"));
const config_1 = require("../config/config");
const project_indexer_file_types_1 = require("./project-indexer-file-types");
const build_report_index_1 = require("./build-report-index");
const project_indexer_types_1 = require("./project-indexer-types");
const project_indexer_query_1 = require("./project-indexer-query");
var project_indexer_global_1 = require("./project-indexer-global");
Object.defineProperty(exports, "getGlobalProjectIndexer", { enumerable: true, get: function () { return project_indexer_global_1.getGlobalProjectIndexer; } });
Object.defineProperty(exports, "setGlobalProjectIndexer", { enumerable: true, get: function () { return project_indexer_global_1.setGlobalProjectIndexer; } });
const INDEX_VERSION = 1;
const BATCH_SIZE = 10;
class ProjectIndexer {
    workspaceFolder;
    manifest;
    sourceIndexes = new Map();
    dirtySources = new Set();
    buildPromise;
    watchers = [];
    constructor(workspaceFolder) {
        this.workspaceFolder = workspaceFolder;
    }
    get indexDir() {
        return (0, config_1.getSaropaIndexDirUri)(this.workspaceFolder);
    }
    manifestUri() {
        return vscode.Uri.joinPath(this.indexDir, 'manifest.json');
    }
    sourceIndexUri(sourceId) {
        return vscode.Uri.joinPath(this.indexDir, `${sourceId}.idx.json`);
    }
    /** Load manifest from disk. */
    async loadManifest() {
        try {
            const raw = await vscode.workspace.fs.readFile(this.manifestUri());
            const parsed = JSON.parse(Buffer.from(raw).toString('utf-8'));
            if (parsed.version === INDEX_VERSION) {
                this.manifest = parsed;
                return this.manifest;
            }
        }
        catch { /* no manifest or invalid */ }
        return undefined;
    }
    /** Load a single source index from disk. */
    async loadSourceIndex(sourceId) {
        try {
            const raw = await vscode.workspace.fs.readFile(this.sourceIndexUri(sourceId));
            const parsed = JSON.parse(Buffer.from(raw).toString('utf-8'));
            if (parsed.version === INDEX_VERSION) {
                this.sourceIndexes.set(sourceId, parsed);
                return parsed;
            }
        }
        catch { /* no file or invalid */ }
        return undefined;
    }
    /** Get or rebuild index; returns current in-memory state; if stale, triggers background rebuild. */
    async getOrRebuild(maxAgeMs) {
        const cfg = (0, config_1.getConfig)().projectIndex;
        if (!cfg.enabled) {
            return { manifest: undefined, getSourceIndex: () => undefined };
        }
        if (!this.manifest) {
            await this.loadManifest();
            const manifest = this.manifest;
            if (manifest) {
                for (const s of manifest.sources) {
                    await this.loadSourceIndex(s.id);
                }
            }
        }
        const now = Date.now();
        const updatedAt = this.manifest?.updatedAt ? new Date(this.manifest.updatedAt).getTime() : 0;
        const stale = !this.manifest || this.dirtySources.size > 0 || (maxAgeMs > 0 && now - updatedAt > maxAgeMs);
        if (stale) {
            if (!this.buildPromise) {
                this.buildPromise = this.build(undefined).finally(() => { this.buildPromise = undefined; });
            }
            this.buildPromise.catch(() => { });
        }
        const getSourceIndex = (id) => this.sourceIndexes.get(id);
        return { manifest: this.manifest, getSourceIndex };
    }
    /** Full rebuild. Optional getActiveLogUri: exclude that log from reports index. */
    async build(getActiveLogUri) {
        const cfg = (0, config_1.getConfig)().projectIndex;
        if (!cfg.enabled) {
            return;
        }
        await vscode.workspace.fs.createDirectory(this.indexDir);
        const now = new Date().toISOString();
        const sourcesMeta = [];
        for (const src of cfg.sources) {
            if (src.enabled === false) {
                continue;
            }
            const id = src.path === '.' ? 'root-files' : src.path.replace(/[/\\]/g, '_').replace(/^\./, '') || 'root';
            const idx = await this.buildSourceDocs(id, src);
            sourcesMeta.push({
                id, path: src.path, enabled: true, fileTypes: src.fileTypes,
                lastIndexed: now, fileCount: idx.files.length,
                tokenCount: idx.files.reduce((s, f) => s + (0, project_indexer_types_1.tokenCountOfEntry)(f), 0),
            });
            this.sourceIndexes.set(id, idx);
            await this.writeSourceIndex(id, idx);
        }
        if (cfg.includeRootFiles) {
            const rootIdx = await this.buildSourceDocs('root-files', { path: '.', fileTypes: [...project_indexer_file_types_1.DEFAULT_DOC_FILE_TYPES], enabled: true });
            sourcesMeta.push({
                id: 'root-files', path: '.', enabled: true, fileTypes: [...project_indexer_file_types_1.DEFAULT_DOC_FILE_TYPES], lastIndexed: now,
                fileCount: rootIdx.files.length, tokenCount: rootIdx.files.reduce((s, f) => s + (0, project_indexer_types_1.tokenCountOfEntry)(f), 0),
            });
            this.sourceIndexes.set('root-files', rootIdx);
            await this.writeSourceIndex('root-files', rootIdx);
        }
        if (cfg.includeReports) {
            const reportIdx = await (0, build_report_index_1.buildReportIndex)(this.workspaceFolder, getActiveLogUri);
            const tokenCount = reportIdx.files.reduce((s, f) => s + (0, project_indexer_types_1.tokenCountOfEntry)(f), 0);
            sourcesMeta.push({
                id: 'reports', path: 'reports', enabled: true, strategy: 'sidecar', lastIndexed: now,
                fileCount: reportIdx.files.length, tokenCount,
            });
            this.sourceIndexes.set('reports', reportIdx);
            await this.writeSourceIndex('reports', reportIdx);
        }
        this.manifest = { version: INDEX_VERSION, createdAt: this.manifest?.createdAt ?? now, updatedAt: now, sources: sourcesMeta };
        this.dirtySources.clear();
        await this.writeManifest();
    }
    /** Register file watchers for doc sources (not reports). Call from extension; dispose on deactivate. */
    startWatching() {
        const cfg = (0, config_1.getConfig)().projectIndex;
        if (!cfg.enabled) {
            return;
        }
        for (const src of cfg.sources) {
            if (src.enabled === false || src.path === '.' || src.path === 'reports') {
                continue;
            }
            const sourceId = src.path.replace(/[/\\]/g, '_').replace(/^\./, '') || 'root';
            const pattern = new vscode.RelativePattern(this.workspaceFolder, `${src.path}/**/*`);
            const watcher = vscode.workspace.createFileSystemWatcher(pattern);
            const mark = () => { this.dirtySources.add(sourceId); };
            watcher.onDidChange(mark);
            watcher.onDidCreate(mark);
            watcher.onDidDelete(mark);
            this.watchers.push(watcher);
        }
    }
    dispose() {
        for (const w of this.watchers) {
            w.dispose();
        }
        this.watchers = [];
    }
    async findRootFileUris(fileTypes, maxFiles, rel) {
        const patterns = (0, project_indexer_file_types_1.buildRootPatternsForDocFileTypes)(fileTypes);
        const results = await Promise.all(patterns.map((p) => vscode.workspace.findFiles(new vscode.RelativePattern(this.workspaceFolder, p), null, maxFiles)));
        const seen = new Set();
        const uris = [];
        for (const batch of results) {
            for (const u of batch) {
                const r = rel(u);
                if (!r.includes('/') && !seen.has(r)) {
                    seen.add(r);
                    uris.push(u);
                }
            }
        }
        return uris;
    }
    async buildSourceDocs(sourceId, src) {
        const maxFiles = (0, config_1.getConfig)().projectIndex.maxFilesPerSource;
        const fileTypes = (0, project_indexer_file_types_1.normalizeDocFileTypes)(src.fileTypes);
        const existing = this.sourceIndexes.get(sourceId)?.files ?? [];
        const existingByPath = new Map(existing.map((e) => [e.relativePath, e]));
        const rel = (u) => vscode.workspace.asRelativePath(u).replace(/\\/g, '/');
        const uris = src.path === '.'
            ? await this.findRootFileUris(fileTypes, maxFiles, rel)
            : await vscode.workspace.findFiles(new vscode.RelativePattern(this.workspaceFolder, `${src.path}/**/*`), project_indexer_file_types_1.FIND_FILES_EXCLUDE_GLOB, maxFiles);
        const filtered = uris.filter((u) => {
            const r = rel(u);
            if ((0, project_indexer_file_types_1.isBlockedRelativePath)(r)) {
                return false;
            }
            return (0, project_indexer_file_types_1.matchesDocFileType)(r, fileTypes);
        }).slice(0, maxFiles);
        const entries = [];
        for (let i = 0; i < filtered.length; i += BATCH_SIZE) {
            const batch = filtered.slice(i, i + BATCH_SIZE);
            const results = await Promise.all(batch.map((uri) => this.indexDocFile(uri, existingByPath, rel(uri))));
            for (const e of results) {
                if (e) {
                    entries.push(e);
                }
            }
        }
        return { version: INDEX_VERSION, sourceId, buildTime: Date.now(), files: entries };
    }
    async indexDocFile(uri, existingByPath, relativePath) {
        try {
            const stat = await vscode.workspace.fs.stat(uri);
            const existing = existingByPath.get(relativePath);
            if (existing && existing.mtime === stat.mtime && existing.sizeBytes === stat.size) {
                return existing;
            }
            const raw = await vscode.workspace.fs.readFile(uri);
            const content = Buffer.from(raw).toString('utf-8');
            const lineCount = content.split(/\r?\n/).length;
            const ext = uri.fsPath.slice(uri.fsPath.lastIndexOf('.'));
            const lowerPath = uri.fsPath.toLowerCase();
            const { tokens, headings } = (0, project_indexer_file_types_1.extractDocTokensByType)(content, ext, lowerPath);
            return {
                relativePath, uri: uri.toString(), sizeBytes: stat.size, mtime: stat.mtime,
                lineCount, tokens, headings,
            };
        }
        catch {
            return null;
        }
    }
    async writeManifest() {
        if (!this.manifest) {
            return;
        }
        await vscode.workspace.fs.writeFile(this.manifestUri(), Buffer.from(JSON.stringify(this.manifest, null, 2), 'utf-8'));
    }
    async writeSourceIndex(sourceId, idx) {
        await vscode.workspace.fs.writeFile(this.sourceIndexUri(sourceId), Buffer.from(JSON.stringify(idx, null, 2), 'utf-8'));
    }
    /** Inline update: add or replace one entry in a source index. */
    async upsertEntry(sourceId, entry) {
        const idx = await this.loadSourceIndex(sourceId) ?? { version: INDEX_VERSION, sourceId, buildTime: Date.now(), files: [] };
        const files = idx.files.filter((f) => f.relativePath !== entry.relativePath);
        files.push(entry);
        const updated = { ...idx, buildTime: Date.now(), files };
        this.sourceIndexes.set(sourceId, updated);
        await this.writeSourceIndex(sourceId, updated);
    }
    /** Build a report index entry from in-memory meta (e.g. from metadata store). */
    async upsertReportEntryFromMeta(logUri, meta) {
        const relativePath = vscode.workspace.asRelativePath(logUri).replace(/\\/g, '/');
        try {
            const stat = await vscode.workspace.fs.stat(logUri);
            const fingerprints = (meta.fingerprints ?? []).map((fp) => fp.n);
            const entry = {
                relativePath, uri: logUri.toString(), sizeBytes: stat.size, mtime: stat.mtime,
                displayName: meta.displayName, tags: meta.tags,
                correlationTokens: meta.correlationTags ?? [], fingerprints,
                errorCount: meta.errorCount, warningCount: meta.warningCount,
            };
            await this.upsertEntry('reports', entry);
        }
        catch { /* skip if file gone */ }
    }
    /** Inline update: remove one entry. */
    async removeEntry(sourceId, relativePath) {
        const idx = await this.loadSourceIndex(sourceId);
        if (!idx) {
            return;
        }
        const files = idx.files.filter((f) => f.relativePath !== relativePath);
        const updated = { ...idx, buildTime: Date.now(), files };
        this.sourceIndexes.set(sourceId, updated);
        await this.writeSourceIndex(sourceId, updated);
    }
    /** Query: return doc entries whose tokens intersect the given tokens (for docs sources). */
    queryDocEntriesByTokens(tokens) {
        return this.queryDocEntriesByTokensWithScores(tokens).map((item) => item.doc);
    }
    /** Query: return ranked doc entries and scores for debugging/tuning relevance. */
    queryDocEntriesByTokensWithScores(tokens) {
        return (0, project_indexer_query_1.queryDocEntriesByTokensWithScoresFromIndexes)(this.sourceIndexes, tokens);
    }
    /** Query: ranked doc entries and token-level score contributions for debugging/tuning relevance. */
    queryDocEntriesByTokensWithDebug(tokens) {
        return (0, project_indexer_query_1.queryDocEntriesByTokensWithDebugFromIndexes)(this.sourceIndexes, tokens);
    }
}
exports.ProjectIndexer = ProjectIndexer;
//# sourceMappingURL=project-indexer.js.map
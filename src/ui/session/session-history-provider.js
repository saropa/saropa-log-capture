"use strict";
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
exports.SessionHistoryProvider = void 0;
const vscode = __importStar(require("vscode"));
const config_1 = require("../../modules/config/config");
const session_metadata_1 = require("../../modules/session/session-metadata");
const session_history_grouping_1 = require("./session-history-grouping");
const session_display_1 = require("./session-display");
const session_history_helpers_1 = require("./session-history-helpers");
const session_history_fetching_1 = require("./session-history-fetching");
/** Extract the basename from a relative path (strip folder prefix). */
function getBasename(name) {
    const idx = name.lastIndexOf('/');
    return idx >= 0 ? name.substring(idx + 1) : name;
}
/** Non-log structured document extensions (plan 051). */
const structuredDocExts = new Set(['.md', '.json', '.jsonl', '.csv', '.html', '.htm']);
/** True if the filename is a structured document, not a log stream. */
function isStructuredDocFile(filename) {
    const dot = filename.lastIndexOf('.');
    if (dot < 0) {
        return false;
    }
    return structuredDocExts.has(filename.substring(dot).toLowerCase());
}
/** Tree data provider for listing past log sessions from the reports directory. */
class SessionHistoryProvider {
    _onDidChange = new vscode.EventEmitter();
    onDidChangeTreeData = this._onDidChange.event;
    watcher;
    activeUri;
    activeLineCount = 0;
    metaStore = new session_metadata_1.SessionMetadataStore();
    metaCache = new Map();
    displayOptions = session_display_1.defaultDisplayOptions;
    showTrash = false;
    refreshTimer;
    /** Cached result from the last successful fetch (default log dir only). */
    itemsCache;
    /** Guards against overlapping fetch calls — callers share the same promise. */
    fetchInFlight;
    /** Basenames that appear more than once — need subfolder for disambiguation. */
    duplicateBasenames = new Set();
    constructor() {
        this.setupWatcher();
    }
    /** Update display options used when rendering tree item labels. */
    setDisplayOptions(options) {
        this.displayOptions = options;
    }
    /** Toggle visibility of trashed sessions. Refreshes tree automatically. */
    setShowTrash(show) { this.showTrash = show; this.refresh(); }
    /** Whether trashed sessions are currently visible. */
    getShowTrash() { return this.showTrash; }
    /** Mark the currently-recording session so it gets a distinct icon. */
    setActiveUri(uri) {
        this.activeUri = uri;
        if (!uri) {
            this.activeLineCount = 0;
        }
    }
    /** Update the live line count for the active (recording) session. */
    setActiveLineCount(count) { this.activeLineCount = count; }
    /** Return the URI of the currently active (recording) session. */
    getActiveUri() {
        return this.activeUri;
    }
    /** Invalidate items cache and notify the tree view to re-fetch. */
    refresh() {
        this.itemsCache = undefined;
        this.fetchInFlight = undefined;
        this._onDidChange.fire();
    }
    getTreeItem(item) {
        if ((0, session_history_grouping_1.isSplitGroup)(item)) {
            return this.getSplitGroupTreeItem(item);
        }
        return this.getSessionTreeItem(item);
    }
    getSessionTreeItem(item) {
        const isActive = this.activeUri?.toString() === item.uri.toString();
        const fullLabel = item.displayName ?? item.filename;
        const bn = getBasename(fullLabel);
        const rawLabel = this.duplicateBasenames.has(bn) ? fullLabel : bn;
        const label = (0, session_display_1.applyDisplayOptions)(rawLabel, this.displayOptions);
        const displayLabel = isActive ? `● ${label}` : label;
        const ti = new vscode.TreeItem(displayLabel, vscode.TreeItemCollapsibleState.None);
        const renderItem = isActive ? { ...item, lineCount: this.activeLineCount } : item;
        ti.tooltip = (0, session_history_helpers_1.buildTooltip)(renderItem);
        const baseDescription = (0, session_history_helpers_1.buildDescription)(renderItem, this.displayOptions.showDayHeadings, isActive);
        ti.description = isActive ? `ACTIVE · ${baseDescription}` : baseDescription;
        if (item.trashed) {
            ti.iconPath = new vscode.ThemeIcon('trash', new vscode.ThemeColor('disabledForeground'));
        }
        else if (isStructuredDocFile(item.filename)) {
            /* Non-log files (markdown, JSON, CSV, HTML) get a document icon (plan 051). */
            ti.iconPath = new vscode.ThemeIcon('file');
        }
        else {
            ti.iconPath = new vscode.ThemeIcon(isActive ? 'record' : (item.hasTimestamps ? 'history' : 'output'), isActive ? new vscode.ThemeColor('charts.red') : undefined);
        }
        ti.command = { command: 'saropaLogCapture.openSession', title: 'Open', arguments: [item] };
        ti.contextValue = item.trashed ? 'trashed-session' : 'session';
        return ti;
    }
    getSplitGroupTreeItem(group) {
        const rawLabel = group.displayName ?? group.baseFilename;
        const label = (0, session_display_1.applyDisplayOptions)(rawLabel, this.displayOptions);
        const ti = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.Collapsed);
        ti.tooltip = (0, session_history_grouping_1.buildSplitGroupTooltip)(group);
        const total = (0, session_history_grouping_1.totalLineCount)(group);
        const linePart = total > 0 ? ` · ${(0, session_history_helpers_1.formatCount)(total)} lines` : '';
        ti.description = `${group.parts.length} parts${linePart} · ${(0, session_history_grouping_1.formatSize)(group.totalSize)}`;
        ti.iconPath = new vscode.ThemeIcon('files');
        ti.contextValue = 'split-group';
        return ti;
    }
    /** Expose the metadata store for use by commands. */
    getMetaStore() {
        return this.metaStore;
    }
    /** Return cached items if available (populated after first fetch). */
    getItemsCache() {
        return this.itemsCache;
    }
    /** Invalidate cached metadata for a URI (e.g. after metadata change). */
    invalidateMeta(uri) {
        const prefix = uri.toString() + '|';
        for (const key of this.metaCache.keys()) {
            if (key.startsWith(prefix)) {
                this.metaCache.delete(key);
                break;
            }
        }
        this.itemsCache = undefined;
    }
    /** Find a top-level tree item whose URI matches (or whose split group contains it). */
    async findByUri(uri) {
        const uriStr = uri.toString();
        const items = await this.getChildren();
        for (const item of items) {
            if ((0, session_history_grouping_1.isSplitGroup)(item)) {
                if (item.parts.some(p => p.uri.toString() === uriStr)) {
                    return item;
                }
            }
            else if (item.uri.toString() === uriStr) {
                return item;
            }
        }
        return undefined;
    }
    /** Find the previous (older) and next (newer) session relative to a URI. */
    async getAdjacentSessions(currentUri) {
        const items = await this.getChildren();
        const currentStr = currentUri.toString();
        const idx = items.findIndex(item => {
            if ((0, session_history_grouping_1.isSplitGroup)(item)) {
                return item.parts.some(p => p.uri.toString() === currentStr);
            }
            return item.uri.toString() === currentStr;
        });
        const total = items.length;
        if (idx < 0) {
            return { index: 0, total };
        }
        return {
            next: idx > 0 ? (0, session_history_grouping_1.getTreeItemUri)(items[idx - 1]) : undefined,
            prev: idx < total - 1 ? (0, session_history_grouping_1.getTreeItemUri)(items[idx + 1]) : undefined,
            index: total - idx,
            total,
        };
    }
    async getChildren(element) {
        if (element && (0, session_history_grouping_1.isSplitGroup)(element)) {
            return element.parts.sort((a, b) => (a.partNumber ?? 0) - (b.partNumber ?? 0));
        }
        const all = await this.getCachedOrFetch();
        return this.showTrash ? all : all.filter(i => (0, session_history_grouping_1.isSplitGroup)(i) || !i.trashed);
    }
    /** Fetch all items including trashed (for the webview session panel). */
    async getAllChildren() {
        return this.getCachedOrFetch();
    }
    /** Like getAllChildren but from an optional root folder (for Logs panel override). */
    async getAllChildrenFromRoot(logDirOverride) {
        if (logDirOverride) {
            return (0, session_history_fetching_1.fetchItemsCore)(this, logDirOverride);
        }
        return this.getCachedOrFetch();
    }
    /** Fetch all items, calling onItemLoaded as each file's metadata resolves. Populates the cache when done. */
    async getAllChildrenStreaming(onItemLoaded, logDirOverride, onFilesFound) {
        if (!logDirOverride && this.itemsCache) {
            return this.itemsCache;
        }
        const items = await (0, session_history_fetching_1.fetchItemsCore)(this, logDirOverride, { onItemLoaded, onFilesFound });
        if (!logDirOverride) {
            this.itemsCache = items;
            this.fetchInFlight = undefined;
            this.computeDuplicateBasenames(items);
        }
        return items;
    }
    /** Return cached items if available, or deduplicate a single in-flight fetch. */
    async getCachedOrFetch() {
        if (this.itemsCache) {
            return this.itemsCache;
        }
        if (this.fetchInFlight) {
            return this.fetchInFlight;
        }
        const promise = (0, session_history_fetching_1.fetchItemsCore)(this).then(items => {
            if (this.fetchInFlight === promise) {
                this.itemsCache = items;
                this.fetchInFlight = undefined;
                this.computeDuplicateBasenames(items);
            }
            return items;
        }).catch(() => {
            if (this.fetchInFlight === promise) {
                this.fetchInFlight = undefined;
            }
            return [];
        });
        this.fetchInFlight = promise;
        return promise;
    }
    dispose() {
        if (this.refreshTimer) {
            clearTimeout(this.refreshTimer);
        }
        this.watcher?.dispose();
        this._onDidChange.dispose();
    }
    setupWatcher() {
        const folder = vscode.workspace.workspaceFolders?.[0];
        if (!folder) {
            return;
        }
        const logDir = (0, config_1.getLogDirectoryUri)(folder);
        const { fileTypes, includeSubfolders } = (0, config_1.getConfig)();
        const glob = includeSubfolders ? `**/${(0, config_1.getFileTypeGlob)(fileTypes)}` : (0, config_1.getFileTypeGlob)(fileTypes);
        const pattern = new vscode.RelativePattern(logDir, glob);
        this.watcher = vscode.workspace.createFileSystemWatcher(pattern);
        this.watcher.onDidCreate(() => this.refresh());
        this.watcher.onDidDelete(() => this.refresh());
        this.watcher.onDidChange(() => this.debouncedRefresh());
    }
    debouncedRefresh() {
        if (this.refreshTimer) {
            clearTimeout(this.refreshTimer);
        }
        this.refreshTimer = setTimeout(() => { this.refresh(); }, this.getRefreshInterval());
    }
    getRefreshInterval() {
        const cfg = (0, config_1.getConfig)().treeRefreshInterval;
        if (cfg > 0) {
            return cfg * 1000;
        }
        if (this.activeLineCount > 10_000) {
            return 30_000;
        }
        if (this.activeLineCount > 1_000) {
            return 10_000;
        }
        return 3_000;
    }
    /** Find basenames that appear more than once (need subfolder prefix). */
    computeDuplicateBasenames(items) {
        const counts = new Map();
        for (const item of items) {
            const label = (0, session_history_grouping_1.isSplitGroup)(item)
                ? (item.displayName ?? item.baseFilename)
                : (item.displayName ?? item.filename);
            const bn = getBasename(label);
            counts.set(bn, (counts.get(bn) ?? 0) + 1);
        }
        this.duplicateBasenames = new Set();
        for (const [bn, count] of counts) {
            if (count > 1) {
                this.duplicateBasenames.add(bn);
            }
        }
    }
}
exports.SessionHistoryProvider = SessionHistoryProvider;
//# sourceMappingURL=session-history-provider.js.map